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
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const editorStateRef = useRef<string>('')

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
        
        // Load content from Firebase Storage if available
        if (doc.metadata?.downloadURL) {
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

  // Auto-save function - save content to Firebase Storage, metadata to Firestore
  const saveDocument = useCallback(async (currentTitle: string, currentContent: string, lexicalState?: unknown) => {
    if (!noteId || !user?.uid || isSaving) return
    
    try {
      setIsSaving(true)
      
      // Save content to Firebase Storage as .txt file
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
          raw: '', // Content is in Firebase Storage, not here
          processed: '', // Content is in Firebase Storage, not here
          ...(lexicalState ? { lexicalState } : {}),
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
            >
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