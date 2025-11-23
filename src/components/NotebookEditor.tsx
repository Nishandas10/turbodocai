/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import { $generateHtmlFromNodes } from '@lexical/html'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
// FloatingToolbar removed per request
import EditorConfig from './editor/EditorConfig'
import LexicalToolbar from './editor/LexicalToolbar'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, TextFormatType, $getSelection, $isRangeSelection, $createTextNode, $getRoot, $createParagraphNode } from 'lexical'
import { $createHeadingNode } from '@lexical/rich-text'
import { $createListNode, $createListItemNode } from '@lexical/list'
import { TOGGLE_LINK_COMMAND, $createLinkNode } from '@lexical/link'
import { getDocument as getFirestoreDocument, updateDocument as updateFirestoreDocument, createFeedback } from '@/lib/firestore'
import { generateDocumentSummaryWithRetry } from '@/lib/ragService'
import SummaryRating from './SummaryRating'

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
      // Build a lightweight HTML export of the current editor content
      getExportHTML?: () => string
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
    // Create a fresh paragraph at the end and stream into it
    editor.update(() => {
      try {
        const root = $getRoot()
        const p = $createParagraphNode()
        p.append($createTextNode(''))
        root.append(p)
        p.selectStart()
      } catch { /* ignore */ }
    })
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
          const p = $createParagraphNode(); p.append($createTextNode(''))
          if (children.length > 0) { children[0].insertBefore(p) } else { root.append(p) }
          p.selectStart()
        } else if (placement === 'end') {
          const p = $createParagraphNode(); p.append($createTextNode(''))
          root.append(p)
          p.selectStart()
        } else if (placement === 'after-heading') {
          let lastHeadingIndex = -1
          children.forEach((child, idx) => { try { if ((child as any).getType?.() === 'heading') lastHeadingIndex = idx } catch {} })
          if (lastHeadingIndex >= 0) {
            const p = $createParagraphNode(); p.append($createTextNode(''))
            children[lastHeadingIndex].insertAfter(p)
            p.selectStart()
          } else {
            const p = $createParagraphNode(); p.append($createTextNode(''))
            root.append(p)
            p.selectStart()
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

  // Export current editor content to rich HTML using Lexical's serializer
  const getExportHTML = useCallback(() => {
    let html = ''
    editor.getEditorState().read(() => {
      const body = $generateHtmlFromNodes(editor, null)
      const style = `
        <style>
          @page { margin: 18mm; }
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; background: #fff; line-height: 1.6; }
          a { color: #1d4ed8; text-decoration: underline; }
          img { max-width: 100%; height: auto; }
          pre { background: #0f0f0f; color: #e5e7eb; padding: 12px; border-radius: 8px; overflow: auto; }
          code { font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 8px; }
          hr { border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0; }
          mark { background: #fef08a; }
          .underline { text-decoration: underline; }
          .line-through { text-decoration: line-through; }
          /* Ensure highlights and background colors render in print/PDF */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          span[style*="background-color"], mark {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            padding: 0 .08em; border-radius: .15em;
          }
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        </style>
      `
      html = `<!doctype html><html><head><meta charset="utf-8"/>${style}</head><body>${body}</body></html>`
    })
    return html
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
      getExportHTML,
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
        delete window.editorHandlers.getExportHTML
      }
    }
  }, [insertText, replaceSelection, typeText, typeTextAtPlacement, getDocumentStructure, insertAtBeginning, insertAtEnd, insertAfterLastHeading, getExportHTML])

  return null
}

// Injects the summary text into the editor replacing a placeholder or appending
function SummaryInjector({ summary }: { summary: string }) {
  const [editor] = useLexicalComposerContext()
  const lastInjected = useRef<string>('')

  // Helper: parse plain summary (possibly markdown-ish) to structured tokens
  const parseSummary = useCallback((text: string) => {
    const lines = text.split(/\n+/).map(l => l.trimEnd()).filter(l => l.length)
    interface Block { type: 'heading' | 'ol' | 'ul' | 'p'; level?: number; items?: string[]; text?: string }
    const blocks: Block[] = []
    let currentList: Block | null = null
    const flush = () => { if (currentList) { blocks.push(currentList); currentList = null } }

    for (const raw of lines) {
      const line = raw.trim()
      const h = /^(#{1,6})\s+(.*)$/.exec(line)
      if (h) { flush(); blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() }); continue }
      const ol = /^\d+[\.)]\s+(.*)$/.exec(line)
      if (ol) { if (!currentList || currentList.type !== 'ol') { flush(); currentList = { type: 'ol', items: [] } } currentList.items!.push(ol[1].trim()); continue }
      const ul = /^[-*+]\s+(.*)$/.exec(line)
      if (ul) { if (!currentList || currentList.type !== 'ul') { flush(); currentList = { type: 'ul', items: [] } } currentList.items!.push(ul[1].trim()); continue }
      flush(); blocks.push({ type: 'p', text: line })
    }
    flush(); return blocks
  }, [])

  // Build text nodes with inline bold support from **markdown** and label: patterns
  const buildRichTextNodes = (text: string) => {
    const nodes: any[] = []
    if (!text) return nodes
    // Prefer explicit **bold** segments if balanced
    if (text.includes('**')) {
      const parts = text.split('**')
      const balanced = parts.length % 2 === 1
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i]
        if (!seg) continue
        const tn = $createTextNode(seg)
        if (balanced && i % 2 === 1) { try { (tn as any).setFormat?.('bold'); } catch { /* TS typing differences */ } (tn as any).__bold = true }
        nodes.push(tn)
      }
      if (nodes.length) return nodes
    }
    // Fallback: Boldify leading label like "Key Points:"
    const m = /^(?:([A-Z][A-Za-z\s]{1,30}?):)\s+(.*)$/.exec(text)
    if (m) {
      const bold = $createTextNode(`${m[1]}: `); try { (bold as any).setFormat?.('bold') } catch {}
      nodes.push(bold)
      nodes.push($createTextNode(m[2]))
      return nodes
    }
    nodes.push($createTextNode(text))
    return nodes
  }

  useEffect(() => {
    if (!summary || summary === lastInjected.current) return
    editor.update(() => {
      const root = $getRoot()
      // If already has a node annotated with data-summary-root, abort to prevent duplicates
      const existing = (root.getChildren() as any[]).find(c => { try { return c.getLatest().__summaryInjected } catch { return false } })
      if (existing) { lastInjected.current = summary; return }

      let placeholderParent: any = null
      const findPlaceholder = (node: any) => {
        if (!node) return
        if (typeof node.getTextContent === 'function') {
          try { if (node.getTextContent() === 'Show here') { placeholderParent = node.getParent() || node; return } } catch {}
        }
        if (typeof node.getChildren === 'function') node.getChildren().forEach((ch: any) => { if (!placeholderParent) findPlaceholder(ch) })
      }
      root.getChildren().forEach(findPlaceholder)

      const blocks = parseSummary(summary)
      const newNodes: any[] = []

      // local factories
      const createHeading = $createHeadingNode
      const createList = $createListNode
      const createListItem = $createListItemNode

      blocks.forEach(b => {
        if (b.type === 'heading' && createHeading) {
          const lvl = Math.min(Math.max(b.level || 1,1),6) as 1|2|3|4|5|6
          const tag = (`h${lvl}`) as any
          const node = createHeading(tag)
          ;(buildRichTextNodes(b.text || '')).forEach(n => node.append(n))
          newNodes.push(node)
        } else if ((b.type === 'ol' || b.type === 'ul')) {
          const listNode = createList(b.type === 'ol' ? 'number' : 'bullet')
          ;(b.items || []).forEach(it => { const li = createListItem(); (buildRichTextNodes(it)).forEach(n => li.append(n)); listNode.append(li) })
          newNodes.push(listNode)
        } else { // paragraph
          const p = $createParagraphNode(); (buildRichTextNodes(b.text || '')).forEach(n => p.append(n)); newNodes.push(p)
        }
      })

      if (newNodes.length) { try { (newNodes[0] as any).__summaryInjected = true } catch {} }

      if (placeholderParent) { const anchor = placeholderParent; newNodes.reverse().forEach(n => anchor.insertAfter(n)); placeholderParent.remove() } else { newNodes.forEach(n => root.append(n)) }

      lastInjected.current = summary
    })
  }, [summary, editor, parseSummary])

  return null
}

import dynamic from 'next/dynamic'
const ShareModal = dynamic(() => import('./ShareModal'), { ssr: false })

export type NotebookEditorProps = { ownerId?: string }
export default function NotebookEditor(props: NotebookEditorProps) {
  const { ownerId: ownerFromProps } = props || {}
  const params = useParams()
  const { user } = useAuth()
  const noteId = params?.noteId as string
  const ownerId = ownerFromProps || user?.uid

  const [shareOpen, setShareOpen] = useState(false)
  const [canEdit, setCanEdit] = useState(true)

  const [title, setTitle] = useState('Untitled Document')
  const [content, setContent] = useState('')
  const [fontSize, setFontSize] = useState(12)
  const [fontFamily, setFontFamily] = useState('Clarika')
  // Floating selection toolbar disabled
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [loadedLexicalState, setLoadedLexicalState] = useState<unknown>(null)
  const [summary, setSummary] = useState('')
  const [summaryRating, setSummaryRating] = useState<number | undefined>(undefined)
  const [docType, setDocType] = useState<string>('text')

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
    if (!noteId || !ownerId) return
    try {
      setIsLoading(true)
  const doc = await getFirestoreDocument(noteId, ownerId)
      if (!doc) return
  setDocType((doc as any)?.type || 'text')
      // decide editability
      const uid = user?.uid
      let editable = false
      if (uid) {
        if (doc.userId === uid) editable = true
        else if (doc.collaborators?.editors?.includes(uid)) editable = true
        else if (doc.publicCanEdit) editable = true
      }
      setCanEdit(!!editable)
      setTitle(doc.title || 'Untitled Document')
      // Load existing summary & rating if present
      if (doc.summary) {
        setSummary(doc.summary)
      } else if ((doc.processingStatus === 'completed' || doc.status === 'ready') && user?.uid) {
      // Existing rating (1-5)
      if (typeof (doc as any).summaryRating === 'number') {
        setSummaryRating((doc as any).summaryRating)
      }
        // Skip auto summary generation for brand-new blank documents
        const fileSize = (doc.metadata?.fileSize ?? 0)
        const rawEmpty = !doc.content?.raw || doc.content.raw.trim().length === 0
        const processedEmpty = !doc.content?.processed || doc.content.processed.trim().length === 0
        const hasBlankTag = Array.isArray(doc.tags) && doc.tags.includes('blank-document')
        const isBlank = fileSize === 0 && rawEmpty && processedEmpty && hasBlankTag
        if (isBlank) {
          // Do not attempt summary generation; blank documents start directly in editor
        } else {
        // Attempt auto-fetch once after processing if no stored summary
        try {
          const auto = await generateDocumentSummaryWithRetry(noteId, user.uid, 4000)
          setSummary(auto)
        } catch (e:any) {
          console.warn('Auto summary failed:', e?.message)
        }
        }
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
  }, [noteId, ownerId, user?.uid, extractPlainTextFromLexical])

  const loadFromRemote = async (doc: any) => {
    // Prefer Firestore raw content (works for collaborator edits without Storage permissions)
    if (doc?.content?.raw && typeof doc.content.raw === 'string' && doc.content.raw.length > 0) {
      setContent(doc.content.raw)
      editorStateRef.current = doc.content.raw
      return
    }
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
    if (!noteId || !ownerId || isSaving) return
    if (!canEdit) return
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
      const isOwner = user?.uid && user.uid === ownerId
      // Never overwrite the original uploaded file in Storage from the editor.
      // For text docs, persist editor content in Firestore content.raw only.
      if (isOwner && docType === 'text') {
        await updateFirestoreDocument(noteId, ownerId, {
          title: currentTitle,
          content: { raw: currentContent, processed: '' },
          // Do not modify metadata.storagePath or downloadURL here
          metadata: {
            fileName: `${currentTitle}.txt`,
            fileSize: new Blob([currentContent]).size,
            mimeType: 'text/plain',
          },
        })
      } else {
        // Collaborator edits OR owner editing non-text doc (e.g., PDF): store raw content only
        await updateFirestoreDocument(noteId, ownerId, {
          title: currentTitle,
          content: { raw: currentContent, processed: '' },
        })
      }
      setLastSaved(new Date())
      editorStateRef.current = currentContent
    } catch (e) {
      console.error('Error saving document:', e)
    } finally {
      setIsSaving(false)
    }
  }, [noteId, ownerId, isSaving, clearOldDocumentsFromLocalStorage, canEdit, user?.uid, docType])

  const debouncedSave = useCallback((t: string, c: string, lexicalState?: unknown) => {
    if (!canEdit) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      if (c !== editorStateRef.current) saveDocument(t, c, lexicalState)
    }, 1000)
  }, [saveDocument, canEdit])

  const handleTitleChange = useCallback((t: string) => { setTitle(t); debouncedSave(t, content) }, [debouncedSave, content])
  const handleContentChange = useCallback((c: string, lexicalState?: unknown) => { setContent(c); debouncedSave(title, c, lexicalState) }, [debouncedSave, title])

  // Handle rating update
  const handleSummaryRatingChange = useCallback(async (rating: number) => {
    if (!noteId || !user?.uid) return
    setSummaryRating(rating)
    try {
      await createFeedback(user.uid, user.email || '', 'summaries', rating, '')
    } catch (e) {
      console.warn('Failed to save summary rating', e)
    }
  }, [noteId, user?.uid, user?.email])

  useEffect(() => () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }, [])

  // Removed manual regenerate summary action

  // Removed selection listeners that triggered the floating toolbar

  // Removed floating toolbar handlers

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
      {/* Header with inline title, share & actions */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left cluster: Title only (rating moved to right actions) */}
          <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
            <span className="text-foreground">✏️</span>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="text-foreground bg-transparent border border-transparent focus:border-border rounded px-2 py-1 text-lg font-medium outline-none min-w-[12rem]"
              placeholder="Untitled Document"
              disabled={!canEdit}
            />
          </div>

          {/* Right cluster: rating + actions */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Summary rating now positioned before export/share */}
            <SummaryRating
              value={summaryRating}
              onChange={handleSummaryRatingChange}
              disabled={!user?.uid || !summary}
              loading={isSaving}
              label="Rate summary:"
            />
            {/* Export button with options */}
            <ExportButton
              onExportDoc={() => {
                const html = (typeof window !== 'undefined' && window.editorHandlers?.getExportHTML?.()) ||
                  `<html><body><pre>${(content || '').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch] as string))}</pre></body></html>`
                const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${(title || 'Document').replace(/\s+/g,'_')}.doc`
                document.body.appendChild(a); a.click(); a.remove()
                URL.revokeObjectURL(url)
              }}
              onExportPdf={() => {
                const html = (typeof window !== 'undefined' && window.editorHandlers?.getExportHTML?.()) ||
                  `<html><body><pre>${(content || '').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch] as string))}</pre></body></html>`
                const win = window.open('', '_blank')
                if (win) {
                  win.document.open()
                  win.document.write(html + '<script>window.onload=()=>{window.focus();window.print();}</script>')
                  win.document.close()
                }
              }}
            />
            <button onClick={() => setShareOpen(true)} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm">Share</button>
            {!canEdit && (
              <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">View only</span>
            )}
            {isSaving ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">Saving...</span>
            ) : lastSaved ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">Saved {lastSaved.toLocaleTimeString()}</span>
            ) : null}
          </div>
        </div>
        {/* Removed manual regenerate summary error UI */}
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
                editable={canEdit}
              >
                {/* Removed local cache status banner */}
                <LinkHandler onLinkInserted={() => { /* toolbar removed */ }} />
                <EditorAgentBridge />
                <SummaryInjector summary={summary} />
                <LexicalToolbar
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                  fontFamily={fontFamily}
                  onFontFamilyChange={setFontFamily}
                />
              </EditorConfig>
            </div>
          </div>
          {/* FloatingToolbar removed */}
        </div>
      </div>
      <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} documentId={noteId} ownerId={ownerId} />
    </div>
  )
}

// Small stateless export dropdown/button
function ExportButton({ onExportDoc, onExportPdf }: { onExportDoc: () => void; onExportPdf: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="px-3 py-1.5 rounded border border-border text-sm bg-card hover:bg-muted"
        title="Export"
      >
        Export
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-md border border-border bg-card shadow-lg z-50">
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setOpen(false); onExportDoc() }}>Download .doc</button>
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setOpen(false); onExportPdf() }}>Download PDF</button>
        </div>
      )}
    </div>
  )
}