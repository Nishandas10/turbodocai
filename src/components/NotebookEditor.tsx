/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { FloatingToolbar } from './editor'
import EditorConfig from './editor/EditorConfig'
import LexicalToolbar from './editor/LexicalToolbar'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, TextFormatType, $getSelection, $isRangeSelection, $createTextNode, $getRoot, $createParagraphNode } from 'lexical'
import { TOGGLE_LINK_COMMAND, $createLinkNode } from '@lexical/link'
import { getDocument as getFirestoreDocument, updateDocument as updateFirestoreDocument } from '@/lib/firestore'
import { generateDocumentSummaryWithRetry } from '@/lib/ragService'

declare global {
  interface Window {
    editorHandlers?: {
      handleLink: () => void
      handleFormatting: (format: string) => void
      // Insert plain text at the current cursor or end
      insertText?: (text: string) => void
      // Replace current selection with text (non-streaming)
      replaceSelection?: (text: string) => void
      // Type text with a cursor-like streaming effect at the end of the doc
      typeText?: (text: string, options?: { delayMs?: number }) => void
  // Type text with a cursor-like streaming effect at a specified placement
  typeTextAtPlacement?: (text: string, placement: 'beginning' | 'end' | 'after-heading' | 'replace-selection', options?: { delayMs?: number }) => void
      // Get current document structure for AI context
      getDocumentStructure?: () => {
        headings: Array<{ level: number; text: string; position: number }>
        paragraphs: string[]
        totalLength: number
        structure: string
      }
      // Insert at specific locations
      insertAtBeginning?: (text: string) => void
      insertAtEnd?: (text: string) => void
      insertAfterLastHeading?: (text: string) => void
    }
  }
}

function LinkHandler({ onLinkInserted }: { onLinkInserted: () => void }) {
  const [editor] = useLexicalComposerContext()

  const handleLink = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent()
        if (selectedText.trim().length > 0) {
          const url = prompt('Enter URL:')
          if (url) {
            const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, fullUrl)
            onLinkInserted()
          }
        } else {
          const linkText = prompt('Enter link text:')
            if (linkText) {
              const url = prompt('Enter URL:')
              if (url) {
                const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
                const linkNode = $createLinkNode(fullUrl)
                const textNode = $createTextNode(linkText)
                linkNode.append(textNode)
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

  useEffect(() => {
  const prev = (window.editorHandlers || {}) as any
  window.editorHandlers = { ...prev, handleLink, handleFormatting }
  }, [handleLink, handleFormatting])

  return null
}

// Exposes agent-friendly editor functions on window.editorHandlers
function EditorAgentBridge() {
  const [editor] = useLexicalComposerContext()
  const typingAbortRef = useRef<{ abort: boolean } | null>(null)

  const insertText = useCallback((text: string) => {
    if (!text) return
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertText(text)
      } else {
        const root = $getRoot()
        const p = $createParagraphNode()
        p.append($createTextNode(text))
        root.append(p)
      }
    })
  }, [editor])

  const replaceSelection = useCallback((text: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.insertText(text)
      } else {
        const root = $getRoot()
        const p = $createParagraphNode()
        p.append($createTextNode(text))
        root.append(p)
      }
    })
  }, [editor])

  // Low-level streaming that uses the CURRENT selection; does not change it
  const streamTypeWithCurrentSelection = useCallback((text: string, options?: { delayMs?: number }) => {
    const delayMs = Math.max(5, Math.min(options?.delayMs ?? 20, 200))
    if (!text) return
    if (typingAbortRef.current) typingAbortRef.current.abort = true
    typingAbortRef.current = { abort: false }

    try { editor.focus(); editor.getRootElement()?.focus() } catch { /* ignore */ }

    let idx = 0
    const step = () => {
      if (typingAbortRef.current?.abort) return
      const char = text.charAt(idx)
      editor.update(() => {
        const root = $getRoot()
        try {
          let selection = $getSelection()
          if (!$isRangeSelection(selection)) {
            // Fallback to end if no valid selection exists
            root.selectEnd()
            selection = $getSelection()
          }
          if ($isRangeSelection(selection)) {
            selection.insertText(char)
          } else {
            const p = $createParagraphNode()
            p.append($createTextNode(char))
            root.append(p)
          }
        } catch { /* ignore */ }
      })
      idx++
      if (idx < text.length) setTimeout(step, delayMs)
    }
    setTimeout(step, delayMs)
  }, [editor])

  const typeText = useCallback((text: string, options?: { delayMs?: number }) => {
    // Ensure caret at end then stream type
    editor.update(() => { try { $getRoot().selectEnd() } catch { /* ignore */ } })
    streamTypeWithCurrentSelection(text, options)
  }, [editor, streamTypeWithCurrentSelection])

  const typeTextAtPlacement = useCallback((text: string, placement: 'beginning' | 'end' | 'after-heading' | 'replace-selection', options?: { delayMs?: number }) => {
    if (!text) return
    // Position the selection according to placement, then stream
    editor.update(() => {
      const root = $getRoot()
      const children = root.getChildren()
      try {
        if (placement === 'beginning') {
          if (children.length === 0) {
            const p = $createParagraphNode(); p.append($createTextNode('')); root.append(p); p.selectStart()
          } else {
            const first = children[0] as any
            if (typeof first.selectStart === 'function') first.selectStart()
            else if (typeof (root as any).selectStart === 'function') (root as any).selectStart()
            else root.selectStart?.()
          }
        } else if (placement === 'end') {
          root.selectEnd()
        } else if (placement === 'after-heading') {
          let lastHeadingIndex = -1
          children.forEach((child, idx) => { try { if ((child as any).getType?.() === 'heading') lastHeadingIndex = idx } catch {} })
          if (lastHeadingIndex >= 0) {
            const p = $createParagraphNode(); p.append($createTextNode(''))
            children[lastHeadingIndex].insertAfter(p)
            p.selectStart()
          } else {
            root.selectEnd()
          }
        } else if (placement === 'replace-selection') {
          // Keep current selection as is; streaming will replace via insertText
        }
      } catch { /* ignore */ }
    })
    // now stream at positioned selection
    streamTypeWithCurrentSelection(text, options)
  }, [editor, streamTypeWithCurrentSelection])

  // Get document structure for AI context
  const getDocumentStructure = useCallback(() => {
    const structure = {
      headings: [] as Array<{ level: number; text: string; position: number }>,
      paragraphs: [] as string[],
      totalLength: 0,
      structure: 'rich'
    }

    editor.getEditorState().read(() => {
      const root = $getRoot()
      const children = root.getChildren()
      let position = 0

      children.forEach((child) => {
        try {
          const text = child.getTextContent()
          if (child.getType() === 'heading') {
            const level = (child as any).getTag()?.replace('h', '') || '1'
            structure.headings.push({
              level: parseInt(level),
              text: text.trim(),
              position
            })
          } else if (text.trim()) {
            structure.paragraphs.push(text.trim())
          }
          position += text.length
        } catch { /* ignore malformed nodes */ }
      })
      
      structure.totalLength = position
    })

    return structure
  }, [editor])

  // Insert at beginning of document
  const insertAtBeginning = useCallback((text: string) => {
    editor.update(() => {
      const root = $getRoot()
      const p = $createParagraphNode()
      p.append($createTextNode(text))
      
      const children = root.getChildren()
      if (children.length > 0) {
        children[0].insertBefore(p)
      } else {
        root.append(p)
      }
    })
  }, [editor])

  // Insert at end of document
  const insertAtEnd = useCallback((text: string) => {
    editor.update(() => {
      const root = $getRoot()
      const p = $createParagraphNode()
      p.append($createTextNode(text))
      root.append(p)
    })
  }, [editor])

  // Insert after the last heading
  const insertAfterLastHeading = useCallback((text: string) => {
    editor.update(() => {
      const root = $getRoot()
      const children = root.getChildren()
      let lastHeadingIndex = -1

      // Find the last heading
      children.forEach((child, index) => {
        try {
          if (child.getType() === 'heading') {
            lastHeadingIndex = index
          }
        } catch { /* ignore */ }
      })

      const p = $createParagraphNode()
      p.append($createTextNode(text))

      if (lastHeadingIndex >= 0 && lastHeadingIndex < children.length - 1) {
        // Insert after the last heading
        children[lastHeadingIndex].insertAfter(p)
      } else {
        // No headings found, append at end
        root.append(p)
      }
    })
  }, [editor])

  useEffect(() => {
    const prev = (window.editorHandlers || {}) as any
    window.editorHandlers = {
      handleLink: prev.handleLink || (() => {}),
      handleFormatting: prev.handleFormatting || (() => {}),
      ...prev,
      insertText,
      replaceSelection,
      typeText,
      typeTextAtPlacement,
      getDocumentStructure,
      insertAtBeginning,
      insertAtEnd,
      insertAfterLastHeading,
    }
    return () => {
      // do not remove other handlers
      if (window.editorHandlers) {
        delete window.editorHandlers.insertText
        delete window.editorHandlers.replaceSelection
        delete window.editorHandlers.typeText
        delete window.editorHandlers.typeTextAtPlacement
        delete window.editorHandlers.getDocumentStructure
        delete window.editorHandlers.insertAtBeginning
        delete window.editorHandlers.insertAtEnd
        delete window.editorHandlers.insertAfterLastHeading
      }
    }
  }, [insertText, replaceSelection, typeText, typeTextAtPlacement, getDocumentStructure, insertAtBeginning, insertAtEnd, insertAfterLastHeading])

  return null
}

// Injects the summary text into the editor replacing a placeholder or appending
function SummaryInjector({ summary }: { summary: string }) {
  const [editor] = useLexicalComposerContext()
  const lastInjected = useRef<string>('')

  useEffect(() => {
    if (!summary || summary === lastInjected.current) return
    editor.update(() => {
      const root = $getRoot()
      let placeholderParent: any = null

      const findPlaceholder = (node: any) => {
        if (node == null) return
        if (typeof node.getTextContent === 'function') {
          try {
            if (node.getTextContent() === 'Show here') {
              placeholderParent = node.getParent() || node
              return
            }
          } catch {/* ignore */}
        }
        if (typeof node.getChildren === 'function') {
          const children = node.getChildren()
          for (const child of children) {
            if (!placeholderParent) findPlaceholder(child)
          }
        }
      }

      root.getChildren().forEach(findPlaceholder)

      // Build paragraph nodes from summary
      const paragraphs = summary.split(/\n{2,}/).map(block => block.trim()).filter(Boolean)
      const newNodes = paragraphs.map(text => {
        const p = $createParagraphNode()
        p.append($createTextNode(text))
        return p
      })

      if (placeholderParent) {
        // Replace placeholder parent's position with new nodes
        const insertAfter = placeholderParent
        newNodes.reverse().forEach(n => insertAfter.insertAfter(n))
        placeholderParent.remove()
      } else {
        // Append at end
        newNodes.forEach(n => root.append(n))
      }
      lastInjected.current = summary
    })
  }, [summary, editor])

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
  const [summary, setSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const editorStateRef = useRef<string>('')

  const extractPlainTextFromLexical = useCallback((lexicalState: any): string => {
    if (!lexicalState || typeof lexicalState !== 'object') return ''
    const textNodes: string[] = []
    const extract = (n: any) => {
      if (n?.type === 'text' && n.text) textNodes.push(n.text)
      if (Array.isArray(n?.children)) n.children.forEach(extract)
    }
    try { extract(lexicalState) } catch { /* ignore */ }
    return textNodes.join(' ')
  }, [])

  const loadDocument = useCallback(async () => {
    if (!noteId || !user?.uid) return
    try {
      setIsLoading(true)
      const doc = await getFirestoreDocument(noteId, user.uid)
      if (!doc) return
      setTitle(doc.title || 'Untitled Document')
      // Load existing summary if present
    if (doc.summary) {
        setSummary(doc.summary)
      } else if (doc.processingStatus === 'completed' || doc.status === 'ready') {
        // Attempt auto-fetch once after processing if no stored summary
        setSummaryLoading(true)
        try {
      const auto = await generateDocumentSummaryWithRetry(noteId, user.uid, 350)
          setSummary(auto)
        } catch (e:any) {
          console.warn('Auto summary failed:', e?.message)
        } finally { setSummaryLoading(false) }
      }
      const localStorageKey = `document_${noteId}_lexical`
      const stored = typeof window !== 'undefined' ? localStorage.getItem(localStorageKey) : null
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setLoadedLexicalState(parsed)
          const plain = extractPlainTextFromLexical(parsed)
            setContent(plain)
            editorStateRef.current = plain
        } catch {
          await loadFromRemote(doc)
        }
      } else {
        await loadFromRemote(doc)
      }
      const updatedAt = (doc.updatedAt as any)?.toDate ? (doc.updatedAt as any).toDate() : new Date()
      setLastSaved(updatedAt)
    } finally {
      setIsLoading(false)
    }
  }, [noteId, user?.uid, extractPlainTextFromLexical])

  const loadFromRemote = async (doc: any) => {
    if (doc?.metadata?.downloadURL) {
      try {
        const res = await fetch(doc.metadata.downloadURL)
        if (res.ok) {
          const txt = await res.text()
          setContent(txt)
          editorStateRef.current = txt
        } else {
          setContent('')
        }
      } catch { setContent('') }
    } else {
      setContent('')
    }
  }

  useEffect(() => { loadDocument() }, [loadDocument])

  const clearOldDocumentsFromLocalStorage = useCallback(() => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('document_') && k.endsWith('_lexical'))
      const toRemove = keys.slice(0, Math.floor(keys.length / 2))
      toRemove.forEach(k => { if (k !== `document_${noteId}_lexical`) localStorage.removeItem(k) })
    } catch {/* ignore */}
  }, [noteId])

  const saveDocument = useCallback(async (currentTitle: string, currentContent: string, lexicalState?: unknown) => {
    if (!noteId || !user?.uid || isSaving) return
    setIsSaving(true)
    try {
      const localStorageKey = `document_${noteId}_lexical`
      if (lexicalState) {
        const serialized = JSON.stringify(lexicalState)
        try {
          localStorage.setItem(localStorageKey, serialized)
        } catch (e: any) {
          if (e?.name === 'QuotaExceededError') {
            clearOldDocumentsFromLocalStorage()
            try { localStorage.setItem(localStorageKey, serialized) } catch {/* ignore */}
          }
        }
      }
      const { uploadDocument } = await import('@/lib/storage')
      const file = new File([currentContent], `${currentTitle}.txt`, { type: 'text/plain' })
      const uploadResult = await uploadDocument(file, user.uid, noteId)
      if (!uploadResult.success) throw new Error(uploadResult.error || 'Upload failed')
      await updateFirestoreDocument(noteId, user.uid, {
        title: currentTitle,
        content: { raw: '', processed: '' },
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
    } catch (e) {
      console.error('Error saving document:', e)
    } finally {
      setIsSaving(false)
    }
  }, [noteId, user?.uid, isSaving, clearOldDocumentsFromLocalStorage])

  const debouncedSave = useCallback((t: string, c: string, lexicalState?: unknown) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      if (c !== editorStateRef.current) saveDocument(t, c, lexicalState)
    }, 1000)
  }, [saveDocument])

  const handleTitleChange = useCallback((t: string) => { setTitle(t); debouncedSave(t, content) }, [debouncedSave, content])
  const handleContentChange = useCallback((c: string, lexicalState?: unknown) => { setContent(c); debouncedSave(title, c, lexicalState) }, [debouncedSave, title])

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }, [])

  const fetchSummary = useCallback(async () => {
    if (!noteId || !user?.uid) return
    setSummaryError(null)
    setSummaryLoading(true)
    try {
      const result = await generateDocumentSummaryWithRetry(noteId, user.uid, 350)
      setSummary(result)
    } catch (e: any) {
      setSummaryError(e?.message || 'Failed to load summary')
    } finally { setSummaryLoading(false) }
  }, [noteId, user?.uid])

  const exportLocalStorageContent = useCallback(() => {
    const key = `document_${noteId}_lexical`
    const data = localStorage.getItem(key)
    if (!data) return
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${key}_backup.json`; a.click(); URL.revokeObjectURL(url)
  }, [noteId])

  const debugLocalStorage = useCallback(() => {
    const key = `document_${noteId}_lexical`
    const data = localStorage.getItem(key)
    console.log('Debug localStorage', { key, exists: !!data, sizeKB: data ? (new Blob([data]).size / 1024).toFixed(2) : 0 })
  }, [noteId])

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection()
      if (sel && sel.toString().trim()) {
        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        setToolbarPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 10 })
        setShowToolbar(true)
      } else setShowToolbar(false)
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mouseup', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handleSelectionChange)
    }
  }, [])

  const handleFloatingLink = () => { window.editorHandlers?.handleLink(); setShowToolbar(false) }
  const handleFloatingFormatting = (f: string) => { window.editorHandlers?.handleFormatting(f) }

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
    <div className="h-full bg-background flex overflow-hidden flex-col">
      {/* Header with title & actions */}
      <div className="border-b border-border p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <button
            onClick={fetchSummary}
            disabled={summaryLoading}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
          >
            {summaryLoading ? 'Generating summary...' : summary ? 'Regenerate Summary' : 'Generate Summary'}
          </button>
          {isSaving ? (
            <span className="text-xs text-muted-foreground">Saving...</span>
          ) : lastSaved ? (
            <span className="text-xs text-muted-foreground">Saved {lastSaved.toLocaleTimeString()}</span>
          ) : null}
          <button onClick={debugLocalStorage} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">Debug</button>
          <button onClick={exportLocalStorageContent} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">Export</button>
        </div>
        {summaryError && <p className="text-sm text-red-500">{summaryError}</p>}
      </div>
      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="w-full px-8 py-4">
            <div className="mx-auto" style={{ maxWidth: 'min(100%, 1200px)' }}>
              <EditorConfig
                fontSize={fontSize}
                fontFamily={fontFamily}
                onContentChange={handleContentChange}
                initialEditorState={loadedLexicalState}
              >
                {loadedLexicalState !== null && (
                  <div className="text-xs text-green-600 mb-2">
                    ✓ Restored from local cache
                    <button
                      onClick={() => console.log('loadedLexicalState:', loadedLexicalState)}
                      className="ml-2 px-1 py-0.5 bg-green-200 rounded text-xs"
                    >Log State</button>
                  </div>
                )}
                <LinkHandler onLinkInserted={() => setShowToolbar(false)} />
                <EditorAgentBridge />
                <SummaryInjector summary={summary} />
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