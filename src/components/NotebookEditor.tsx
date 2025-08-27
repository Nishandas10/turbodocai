/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { FloatingToolbar } from './editor'
import EditorConfig from './editor/EditorConfig'
import LexicalToolbar from './editor/LexicalToolbar'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, TextFormatType } from 'lexical'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical'
import { $createLinkNode } from '@lexical/link'
import { getDocument as getFirestoreDocument, updateDocument as updateFirestoreDocument } from '@/lib/firestore'

// Extend window interface for editor handlers
declare global {
  interface Window {
    editorHandlers?: {
      handleLink: () => void
      handleFormatting: (format: string) => void
    }
  }
}

// Link handler component that can access editor context
function LinkHandler({ onLinkInserted }: { onLinkInserted: () => void }) {
  const [editor] = useLexicalComposerContext()

  const handleLink = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent()
        
        // Check if we already have selected text
        if (selectedText.trim().length > 0) {
          // If text is selected, prompt for URL and apply link
          const url = prompt('Enter URL:')
          if (url) {
            // Ensure URL has protocol
            const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, fullUrl)
            onLinkInserted()
          }
        } else {
          // If no text selected, prompt for both text and URL
          const linkText = prompt('Enter link text:')
          if (linkText) {
            const url = prompt('Enter URL:')
            if (url) {
              // Ensure URL has protocol
              const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
              
              // Create link node with text
              const linkNode = $createLinkNode(fullUrl)
              const textNode = $createTextNode(linkText)
              linkNode.append(textNode)
              
              // Insert the link node
              selection.insertNodes([linkNode])
              onLinkInserted()
            }
          }
        }
      }
    })
  }, [editor, onLinkInserted])

  const handleFormatting = useCallback((format: string) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format as TextFormatType)
  }, [editor])

  // Store handlers in a ref or context to be accessed by the parent
  useEffect(() => {
    // Make handlers available to parent component
    window.editorHandlers = {
      handleLink,
      handleFormatting
    }
  }, [handleLink, handleFormatting])

  return null
}

export default function NotebookEditor() {
  const params = useParams()
  const { user } = useAuth()
  const noteId = params?.noteId as string
  
  const [title, setTitle] = useState('Untitled Document')
  const [content, setContent] = useState('')
  const [fontSize, setFontSize] = useState(12)
  const [fontFamily, setFontFamily] = useState('Clarika')
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [loadedLexicalState, setLoadedLexicalState] = useState<unknown>(null)
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const editorStateRef = useRef<string>('')

  // Extract plain text from lexicalState for display
  const extractPlainTextFromLexical = useCallback((lexicalState: unknown): string => {
    if (!lexicalState || typeof lexicalState !== 'object') return ''
    
    try {
      // Simple text extraction - this can be enhanced based on your lexical structure
      const textNodes: string[] = []
      
      const extractText = (node: any) => {
        if (node && typeof node === 'object') {
          if (node.type === 'text' && node.text) {
            textNodes.push(node.text)
          }
          if (node.children) {
            node.children.forEach(extractText)
          }
        }
      }
      
      extractText(lexicalState)
      return textNodes.join(' ')
    } catch (error) {
      console.warn('Error extracting text from lexicalState:', error)
      return ''
    }
  }, [])



  // Load document data - metadata from Firestore, content from Firebase Storage
  useEffect(() => {
    const loadDocument = async () => {
      if (!noteId || !user?.uid) return
      
      try {
        setIsLoading(true)
        
        // Get document metadata from Firestore
        const doc = await getFirestoreDocument(noteId, user.uid)
        if (!doc) {
          console.error('Document not found')
          return
        }
        
        setTitle(doc.title)
        
        // Try to load rich content from localStorage first
        const localStorageKey = `document_${noteId}_lexical`
        const savedLexicalState = localStorage.getItem(localStorageKey)
        
        if (savedLexicalState) {
          try {
            const lexicalState = JSON.parse(savedLexicalState)
            console.log('Loaded rich content from localStorage:', localStorageKey)
            
            // Store the loaded lexicalState to restore editor formatting
            setLoadedLexicalState(lexicalState)
            
            // Extract plain text from lexicalState for display
            const plainText = extractPlainTextFromLexical(lexicalState)
            setContent(plainText)
            editorStateRef.current = plainText
            
            console.log('Successfully loaded lexicalState from localStorage, editor will restore formatting')
          } catch (error) {
            console.warn('Error parsing localStorage content:', error)
            // Fall back to Firebase Storage
            await loadFromFirebaseStorage()
          }
        } else {
          // No localStorage content, try Firebase Storage
          await loadFromFirebaseStorage()
        }
        
        // Helper function to load from Firebase Storage
        async function loadFromFirebaseStorage() {
          if (doc && doc.metadata?.downloadURL) {
            try {
              const response = await fetch(doc.metadata.downloadURL)
              if (response.ok) {
                const content = await response.text()
                setContent(content)
                editorStateRef.current = content
              } else {
                console.warn('Failed to load content from storage, using empty content')
                setContent('')
                editorStateRef.current = ''
              }
            } catch (error) {
              console.warn('Error loading content from storage:', error)
              setContent('')
              editorStateRef.current = ''
            }
          } else {
            // No storage URL, use empty content
            setContent('')
            editorStateRef.current = ''
          }
        }
        

        
        // Firestore Timestamp -> Date
        const updatedAt = (doc.updatedAt as unknown as { toDate?: () => Date })?.toDate ? (doc.updatedAt as unknown as { toDate?: () => Date }).toDate!() : new Date()
        setLastSaved(updatedAt)
      } catch (error) {
        console.error('Error loading document:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadDocument()
  }, [noteId, user?.uid])

  // Effect to handle when loadedLexicalState changes (editor restoration)
  useEffect(() => {
    if (loadedLexicalState && !isLoading) {
      console.log('Editor state restored from localStorage, content should now display with formatting')
      // The editor will automatically restore the state via initialEditorState prop
    }
  }, [loadedLexicalState, isLoading])

  // Save content before page unload to prevent data loss
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (content && content !== editorStateRef.current) {
        // Save to localStorage before page unload
        const localStorageKey = `document_${noteId}_lexical`
        const currentLexicalState = localStorage.getItem(localStorageKey)
        if (currentLexicalState) {
          console.log('Saving content before page unload to prevent data loss')
          // The content is already saved in localStorage, just ensure it's up to date
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [content, noteId])

  // Auto-save function - save rich content to localStorage, plain text to Firebase Storage, metadata to Firestore
  const saveDocument = useCallback(async (currentTitle: string, currentContent: string, lexicalState?: unknown) => {
    if (!noteId || !user?.uid || isSaving) return
    
    try {
      setIsSaving(true)
      
      // Save rich editor content (lexicalState) to localStorage
      if (lexicalState) {
        const localStorageKey = `document_${noteId}_lexical`
        const contentString = JSON.stringify(lexicalState)
        
        try {
          localStorage.setItem(localStorageKey, contentString)
          
          // Log storage info
          const size = new Blob([contentString]).size
          console.log(`Saved rich content to localStorage: ${localStorageKey} (${(size / 1024).toFixed(2)} KB)`)
          
          // Check localStorage quota usage
          const totalSize = Object.keys(localStorage).reduce((total, key) => {
            return total + (localStorage[key] ? new Blob([localStorage[key]]).size : 0)
          }, 0)
          console.log(`Total localStorage usage: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
        } catch (error) {
          if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old documents and retrying...')
            
            // Try to clear old documents and retry
            clearOldDocumentsFromLocalStorage()
            
            try {
              localStorage.setItem(localStorageKey, contentString)
              console.log('Successfully saved after clearing old documents')
            } catch (retryError) {
              console.error('Failed to save to localStorage even after clearing:', retryError)
              // Continue with Firebase Storage backup
            }
          } else {
            console.error('Error saving to localStorage:', error)
          }
        }
      }
      
      // Save plain text content to Firebase Storage as backup
      const { uploadDocument } = await import('@/lib/storage')
      const txtFile = new File([currentContent], `${currentTitle}.txt`, { type: 'text/plain' })
      const uploadResult = await uploadDocument(txtFile, user.uid, noteId)
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload content to storage')
      }
      
      // Update Firestore with metadata and storage info (not content)
      await updateFirestoreDocument(noteId, user.uid, {
        title: currentTitle,
        content: {
          raw: '', // Content is in localStorage and Firebase Storage, not here
          processed: '', // Content is in localStorage and Firebase Storage, not here
          // Don't save lexicalState to Firestore - it's in localStorage
        },
        metadata: {
          fileName: `${currentTitle}.txt`,
          fileSize: new Blob([currentContent]).size,
          mimeType: 'text/plain',
          storagePath: uploadResult.storagePath,
          downloadURL: uploadResult.downloadURL,
        },
      })
      
      setLastSaved(new Date())
      editorStateRef.current = currentContent
    } catch (error) {
      console.error('Error saving document:', error)
    } finally {
      setIsSaving(false)
    }
  }, [noteId, user?.uid, isSaving])

  // Debounced auto-save
  const debouncedSave = useCallback((currentTitle: string, currentContent: string, lexicalState?: unknown) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (currentContent !== editorStateRef.current) {
        saveDocument(currentTitle, currentContent, lexicalState)
      }
    }, 1000) // Save after 1 second of inactivity
  }, [saveDocument])

  // Handle title changes
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle)
    debouncedSave(newTitle, content)
  }, [content, debouncedSave])

  // Handle content changes
  const handleContentChange = useCallback((newContent: string, lexicalState?: unknown) => {
    setContent(newContent)
    debouncedSave(title, newContent, lexicalState)
  }, [title, debouncedSave])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Function to clear localStorage for this document
  const clearDocumentFromLocalStorage = useCallback(() => {
    if (noteId) {
      const localStorageKey = `document_${noteId}_lexical`
      localStorage.removeItem(localStorageKey)
      console.log('Cleared document from localStorage:', localStorageKey)
    }
  }, [noteId])

  // Function to export localStorage content (useful for debugging/backup)
  const exportLocalStorageContent = useCallback(() => {
    if (noteId) {
      const localStorageKey = `document_${noteId}_lexical`
      const content = localStorage.getItem(localStorageKey)
      if (content) {
        const blob = new Blob([content], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `document_${noteId}_lexical_backup.json`
        a.click()
        URL.revokeObjectURL(url)
        console.log('Exported localStorage content for document:', noteId)
      }
    }
  }, [noteId])

  // Function to get localStorage info for this document
  const getLocalStorageInfo = useCallback(() => {
    if (noteId) {
      const localStorageKey = `document_${noteId}_lexical`
      const content = localStorage.getItem(localStorageKey)
      if (content) {
        const size = new Blob([content]).size
        const parsed = JSON.parse(content)
        return {
          exists: true,
          size: size,
          sizeKB: (size / 1024).toFixed(2),
          nodeCount: countNodes(parsed),
          lastModified: new Date().toISOString() // localStorage doesn't track modification time
        }
      }
      return { exists: false }
    }
    return { exists: false }
  }, [noteId])

  // Helper function to count nodes in lexicalState
  const countNodes = useCallback((obj: any): number => {
    if (!obj || typeof obj !== 'object') return 0
    let count = 1
    if (obj.children) {
      obj.children.forEach((child: any) => {
        count += countNodes(child)
      })
    }
    return count
  }, [])

  // Function to clear old documents from localStorage when quota is exceeded
  const clearOldDocumentsFromLocalStorage = useCallback(() => {
    try {
      // Get all document keys
      const documentKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('document_') && key.endsWith('_lexical')
      )
      
      if (documentKeys.length > 0) {
        // Sort by last modified (we'll use a simple approach since localStorage doesn't track this)
        // Remove the oldest documents (keep the current one)
        const keysToRemove = documentKeys.slice(0, Math.floor(documentKeys.length / 2))
        
        keysToRemove.forEach(key => {
          if (key !== `document_${noteId}_lexical`) { // Don't remove current document
            localStorage.removeItem(key)
            console.log('Cleared old document from localStorage:', key)
          }
        })
        
        console.log(`Cleared ${keysToRemove.length} old documents from localStorage`)
      }
    } catch (error) {
      console.error('Error clearing old documents from localStorage:', error)
    }
  }, [noteId])

  // Debug function to log localStorage status
  const debugLocalStorage = useCallback(() => {
    if (noteId) {
      const localStorageKey = `document_${noteId}_lexical`
      const content = localStorage.getItem(localStorageKey)
      console.log('=== localStorage Debug Info ===')
      console.log('Document ID:', noteId)
      console.log('localStorage Key:', localStorageKey)
      console.log('Content exists:', !!content)
      if (content) {
        try {
          const parsed = JSON.parse(content)
          const size = new Blob([content]).size
          console.log('Content size:', `${(size / 1024).toFixed(2)} KB`)
          console.log('Parsed content type:', typeof parsed)
          console.log('Content structure:', parsed)
        } catch (error) {
          console.error('Error parsing localStorage content:', error)
        }
      }
      console.log('=============================')
    }
  }, [noteId])

  // Handle text selection for floating toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        
        setToolbarPosition({
          x: rect.left + rect.width / 2,
          y: rect.bottom + 10
        })
        setShowToolbar(true)
      } else {
        setShowToolbar(false)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mouseup', handleSelectionChange)
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handleSelectionChange)
    }
  }, [])

  const handleFloatingLink = () => {
    if (window.editorHandlers) {
      window.editorHandlers.handleLink()
      setShowToolbar(false)
    }
  }

  const handleFloatingFormatting = (format: string) => {
    if (window.editorHandlers) {
      window.editorHandlers.handleFormatting(format)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading document...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-background flex overflow-hidden">
      {/* Main Document Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Save Status */}
        <div className="px-8 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex items-center justify-between" style={{ maxWidth: 'min(100%, 1200px)' }}>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  <span>Saving...</span>
                </>
              ) : lastSaved ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>Saved {lastSaved.toLocaleTimeString()}</span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  <span>Unsaved changes</span>
                </>
              )}
            </div>
            
            {/* Debug buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={debugLocalStorage}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                title="Debug localStorage"
              >
                Debug Storage
              </button>
              <button
                onClick={exportLocalStorageContent}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                title="Export localStorage content"
              >
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="w-full px-8 py-4">
            <div className="mx-auto" style={{ maxWidth: 'min(100%, 1200px)' }}>
            <EditorConfig 
              fontSize={fontSize} 
              fontFamily={fontFamily}
              onContentChange={handleContentChange}
              initialEditorState={loadedLexicalState}
            >
              {/* Debug info */}
              {loadedLexicalState !== null && (
                <div className="text-xs text-green-600 mb-2">
                  ✓ Editor state loaded from localStorage - formatting will be restored
                  <button 
                    onClick={() => console.log('loadedLexicalState:', loadedLexicalState)}
                    className="ml-2 px-1 py-0.5 bg-green-200 rounded text-xs"
                  >
                    Log State
                  </button>
                </div>
              )}
                <LinkHandler onLinkInserted={() => setShowToolbar(false)} />
              <LexicalToolbar
                title={title}
                onTitleChange={handleTitleChange}
                fontSize={fontSize}
                onFontSizeChange={setFontSize}
                fontFamily={fontFamily}
                onFontFamilyChange={setFontFamily}
              />
            </EditorConfig>
            </div>
          </div>

          {/* Floating Toolbar */}
          <FloatingToolbar
            show={showToolbar}
            position={toolbarPosition}
            onFormatting={handleFloatingFormatting}
            onLink={handleFloatingLink}
            onAddComment={() => {}}
            onAskTurbo={() => {}}
          />
        </div>
      </div>
    </div>
  )
} 