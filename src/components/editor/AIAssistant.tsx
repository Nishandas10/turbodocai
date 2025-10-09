"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  MessageSquare,
  Edit3,
  Send,
  ChevronRight,
  MapPin,
  Mic
} from 'lucide-react'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import { useAuth } from '@/contexts/AuthContext'
import { queryDocuments } from '@/lib/ragService'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: number
  placement?: 'beginning' | 'end' | 'after-heading' | 'replace-selection'
  awaitingPlacement?: boolean
  originalQuery?: string
}

interface AIAssistantProps {
  onCollapse?: () => void
  isCollapsed?: boolean
}

export default function AIAssistant({ onCollapse, isCollapsed = false }: AIAssistantProps) {
  const { user } = useAuth()
  const params = useParams()
  const documentId = params?.noteId as string
  const [mode, setMode] = useState<'chat' | 'write' | 'comment'>('chat')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [sending, setSending] = useState(false)
  const [streamToDoc] = useState(true)
  const [pendingContent, setPendingContent] = useState('')
  const [pendingMessageId, setPendingMessageId] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const userEditedRef = useRef<boolean>(false)
  const userEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { supported: speechSupported, listening, interimTranscript, start: startSpeech, stop: stopSpeech, reset: resetSpeech } = useSpeechToText({
    lang: 'en-US',
    fallbackLangs: ['en-US'],
    continuous: false,
    interimResults: true,
    onPartial: () => { /* no-op for now */ },
    onSegment: (seg) => {
      if (!userEditedRef.current) {
        setInput(prev => (prev ? prev + ' ' : '') + seg)
      }
    }
  })

  // Auto-scroll
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Simple streaming helper to animate text in UI and optionally in editor
  const streamOutput = useCallback(async (full: string, update: (partial: string) => void) => {
    const delay = 18
    let i = 0
    while (i < full.length) {
      i += 2
      update(full.slice(0, i))
      await new Promise(r => setTimeout(r, delay))
    }
  }, [])

  const getEditorHandlers = () => (typeof window !== 'undefined' ? window.editorHandlers : undefined)

  // Get current document structure from the editor
  const getCurrentDocumentStructure = useCallback(() => {
    const handlers = getEditorHandlers()
    if (!handlers?.getDocumentStructure) {
      // Fallback: try to get basic text content
      return { 
        headings: [], 
        paragraphs: ['Document content not accessible'], 
        totalLength: 0,
        structure: 'basic'
      }
    }
    return handlers.getDocumentStructure()
  }, [])

  // Detect if user wants to add content and where
  const parseContentIntent = useCallback((text: string) => {
    const lower = text.toLowerCase()
    
    // Check for explicit placement instructions
    if (
      lower.includes('at the beginning') ||
      lower.includes('at the start') ||
      lower.includes('at start') ||
      lower.includes('start of doc') ||
      lower.includes('start of the doc') ||
      lower.includes('beginning of doc')
    ) {
      return { placement: 'beginning', isContentRequest: true }
    }
    if (
      lower.includes('at the end') ||
      lower.includes('at the bottom') ||
      lower.includes('end of doc') ||
      lower.includes('end of the doc') ||
      lower.includes('bottom of doc')
    ) {
      return { placement: 'end', isContentRequest: true }
    }
    if (
      (lower.includes('after') || lower.includes('below')) &&
      (lower.includes('heading') || lower.includes('section') || lower.includes('title'))
    ) {
      return { placement: 'after-heading', isContentRequest: true }
    }
    if (
      (lower.includes('replace') || lower.includes('overwrite')) &&
      (lower.includes('selection') || lower.includes('highlighted'))
    ) {
      return { placement: 'replace-selection', isContentRequest: true }
    }
    
    // Check for content creation keywords
    const contentKeywords = ['write', 'add', 'insert', 'create', 'generate', 'include']
    const hasContentKeyword = contentKeywords.some(keyword => lower.includes(keyword))
    
    if (hasContentKeyword) {
      return { placement: null, isContentRequest: true }
    }
    
    return { placement: null, isContentRequest: false }
  }, [])

  // Place content at specified location
  const placeContentAtLocation = useCallback((content: string, placement: string) => {
    const handlers = getEditorHandlers()
    if (!handlers) return

    switch (placement) {
      case 'beginning':
        if (handlers.typeTextAtPlacement) {
          handlers.typeTextAtPlacement(content + '\n\n', 'beginning', { delayMs: 16 })
        } else if (handlers.insertAtBeginning) {
          handlers.insertAtBeginning(content + '\n\n')
        }
        break
      case 'end':
        if (handlers.typeTextAtPlacement) {
          handlers.typeTextAtPlacement(content + '\n\n', 'end', { delayMs: 16 })
        } else if (handlers.insertAtEnd) {
          handlers.insertAtEnd(content + '\n\n')
        }
        break
      case 'after-heading':
        if (handlers.typeTextAtPlacement) {
          handlers.typeTextAtPlacement(content + '\n\n', 'after-heading', { delayMs: 16 })
        } else if (handlers.insertAfterLastHeading) {
          handlers.insertAfterLastHeading(content + '\n\n')
        }
        break
      case 'replace-selection':
        if (handlers.typeTextAtPlacement) {
          handlers.typeTextAtPlacement(content, 'replace-selection', { delayMs: 16 })
        } else if (handlers.replaceSelection) {
          handlers.replaceSelection(content)
        }
        break
      default:
        // Default to end if no specific placement
        handlers.typeText?.(content + '\n\n', { delayMs: 18 })
    }
  }, [])

  const handleSend = useCallback(async () => {
    if (!input.trim()) return
    if (sending) return

    const text = input.trim()
    setInput('')

    // Add user message
    const userMsg: ChatMsg = { id: `${Date.now()}`, role: 'user', text, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])

    if (mode === 'write') {
      // In write mode, interpret the user's prompt as instructions, generate content using RAG, then insert it.
      const intent = parseContentIntent(text)

      // If we can't infer a placement, ask for it first (but still generate content once chosen)
      if (intent.isContentRequest && !intent.placement) {
        const askMsg: ChatMsg = {
          id: `${Date.now()}-ask`,
          role: 'assistant',
          text: 'Where would you like me to add this content?',
          ts: Date.now(),
          awaitingPlacement: true,
          originalQuery: text,
        }
        setMessages(prev => [...prev, askMsg])
        // Store the original prompt; we'll generate content once placement is picked
        setPendingContent(text)
        setPendingMessageId(askMsg.id)
        return
      }

      // We have or will assume a placement; generate content using document context.
      if (!user?.uid) {
        const warn: ChatMsg = { id: `${Date.now()}-noauth`, role: 'assistant', text: 'Please sign in to write into your document.', ts: Date.now() }
        setMessages(prev => [...prev, warn])
        return
      }

      setSending(true)
      const asstId = `${Date.now()}-asst`;
      setMessages(prev => [...prev, { id: asstId, role: 'assistant', text: 'Generating…', ts: Date.now() }])
      try {
        // Build a generation prompt that asks for expository content rather than parroting the instruction
        const docStructure = getCurrentDocumentStructure()
        const generationPrompt = `Write a clear, concise section based on this instruction: "${text}".\n\nGuidelines:\n- Follow the document's tone and be factual.\n- Use 2-4 short paragraphs unless a list is better.\n- Avoid prefacing like "as requested".\n- If a topic is specified (e.g., a field like metabolomics), give a brief overview, key concepts, and why it matters.\n\nDocument structure context: ${docStructure.headings.map(h => `H${h.level}:${h.text}`).join(', ') || 'none'}`

        const res = await queryDocuments({ question: generationPrompt, userId: user.uid, documentId })
        const generated = (res.answer || '').trim() || 'Unable to generate content for that request.'

        // Update sidebar message progressively for feedback
        await streamOutput(generated, (partial) => {
          setMessages(prev => prev.map(m => m.id === asstId ? { ...m, text: partial } : m))
        })

        // Insert into document at the requested placement (default to end if missing)
        const placement = intent.placement || 'end'
        placeContentAtLocation(generated, placement)

        const ack: ChatMsg = {
          id: `${Date.now()}-ack`,
          role: 'assistant',
          text: `Added generated content to the document (${placement}).`,
          ts: Date.now(),
        }
        setMessages(prev => [...prev, ack])
  } catch {
        setMessages(prev => prev.map(m => m.id === asstId ? { ...m, text: 'Error generating content. Try again.' } : m))
      } finally {
        setSending(false)
      }
      return
    }

    // Chat mode: call RAG with document context and stream answer
    if (!user?.uid) {
      const warn: ChatMsg = { id: `${Date.now()}-noauth`, role: 'assistant', text: 'Please sign in to chat with your documents.', ts: Date.now() }
      setMessages(prev => [...prev, warn])
      return
    }

    setSending(true)
    // Placeholder assistant message to be updated
    const asstId = `${Date.now()}-asst`
    setMessages(prev => [...prev, { id: asstId, role: 'assistant', text: '', ts: Date.now() }])
    
    try {
      // Get current document structure for context
      const docStructure = getCurrentDocumentStructure()
      
      // Enhanced query with document context
      const contextualQuery = text + (docStructure.headings.length > 0 
        ? `\n\nCurrent document structure: ${docStructure.headings.map(h => `H${h.level}: ${h.text}`).join(', ')}`
        : '')
      
      // Query with document ID for better context from Pinecone
      const res = await queryDocuments({ 
        question: contextualQuery, 
        userId: user.uid,
        documentId: documentId // Include current document for context
      })
      const answer = res.answer || 'I could not find an answer.'

      // Check if this is a content generation request
      const intent = parseContentIntent(text)
      let finalAnswer = answer

      if (intent.isContentRequest && !intent.placement) {
        finalAnswer += '\n\nWhere would you like me to add this content? (beginning, end, after heading, etc.)'
        // Set up for placement selection
        setPendingContent(answer)
        setPendingMessageId(asstId)
      }

      // Stream into sidebar UI
      await streamOutput(finalAnswer, (partial) => {
        setMessages(prev => prev.map(m => m.id === asstId ? { ...m, text: partial } : m))
      })

      // Optionally stream to document with intelligent placement
      if (streamToDoc && intent.isContentRequest && intent.placement) {
        placeContentAtLocation(answer, intent.placement)
      } else if (streamToDoc && !intent.isContentRequest) {
        // For regular Q&A, just add at end
        getEditorHandlers()?.typeText?.('\n' + answer + '\n\n', { delayMs: 18 })
      }
      
    } catch {
      setMessages(prev => prev.map(m => m.id === asstId ? { ...m, text: 'Error fetching answer. Try again.' } : m))
    } finally {
      setSending(false)
    }
  }, [input, sending, mode, user?.uid, streamToDoc, documentId, parseContentIntent, placeContentAtLocation, getCurrentDocumentStructure, streamOutput])

  // Handle placement selection
  const handlePlacementSelection = useCallback(async (placement: string) => {
    if (!pendingContent || !pendingMessageId) return
    // pendingContent here holds the original instruction from write mode
    if (!user?.uid) {
      setMessages(prev => prev.map(m => m.id === pendingMessageId ? { ...m, text: 'Please sign in to write into your document.', awaitingPlacement: false } : m))
      setPendingContent('')
      setPendingMessageId('')
      return
    }

    // Provide quick feedback
    setMessages(prev => prev.map(m => m.id === pendingMessageId ? { ...m, text: 'Generating…', awaitingPlacement: false } : m))
    try {
      const docStructure = getCurrentDocumentStructure()
      const generationPrompt = `Write a clear, concise section based on this instruction: "${pendingContent}".\n\nGuidelines:\n- Follow the document's tone and be factual.\n- Use 2-4 short paragraphs unless a list is better.\n- Avoid prefacing like "as requested".\n- If a topic is specified (e.g., a field like metabolomics), give a brief overview, key concepts, and why it matters.\n\nDocument structure context: ${docStructure.headings.map(h => `H${h.level}:${h.text}`).join(', ') || 'none'}`
      const res = await queryDocuments({ question: generationPrompt, userId: user.uid, documentId })
      const generated = (res.answer || '').trim() || 'Unable to generate content for that request.'
      placeContentAtLocation(generated, placement)
      setMessages(prev => prev.map(m => m.id === pendingMessageId ? { ...m, text: `Added generated content to the document (${placement}).` } : m))
    } catch {
      setMessages(prev => prev.map(m => m.id === pendingMessageId ? { ...m, text: 'Error generating content. Try again.' } : m))
    } finally {
      setPendingContent('')
      setPendingMessageId('')
    }
  }, [pendingContent, pendingMessageId, user?.uid, getCurrentDocumentStructure, documentId, placeContentAtLocation])

  return (
    <div className={`w-full h-full bg-gray-900 flex flex-col relative overflow-hidden ${isCollapsed ? 'min-w-0' : ''}`}>
      {/* Collapse Button */}
      {onCollapse && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCollapse}
          className="absolute top-4 right-4 z-10 text-gray-400 hover:text-white hover:bg-gray-800 px-3 py-1.5 text-sm"
        >
          <ChevronRight className="h-4 w-4 mr-1" />
          Collapse
        </Button>
      )}

      {/* Header / Greeting */}
      <div className="px-4 pt-6 pb-3 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-white">Hey, I&apos;m Blume AI</h1>
        <p className="text-gray-400 text-sm md:text-base mt-1">Ask questions or tell me what to write — I can type into your doc with a live cursor.</p>
      </div>

      {/* Messages list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`w-full text-left ${m.role === 'user' ? 'text-blue-200' : 'text-gray-100'}`}>
            <div className={`inline-block px-3 py-2 rounded-lg ${m.role === 'user' ? 'bg-blue-700/50' : 'bg-gray-800/70'}`}>
              {m.text}
              
              {/* Placement options for content requests */}
              {m.awaitingPlacement && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button 
                    onClick={() => handlePlacementSelection('beginning')}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    <MapPin className="h-3 w-3 inline mr-1" />
                    Beginning
                  </button>
                  <button 
                    onClick={() => handlePlacementSelection('end')}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    <MapPin className="h-3 w-3 inline mr-1" />
                    End
                  </button>
                  <button 
                    onClick={() => handlePlacementSelection('after-heading')}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    <MapPin className="h-3 w-3 inline mr-1" />
                    After Heading
                  </button>
                  <button 
                    onClick={() => handlePlacementSelection('replace-selection')}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                  >
                    <MapPin className="h-3 w-3 inline mr-1" />
                    Replace Selection
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="text-gray-300 text-sm">Thinking…</div>
        )}
      </div>

      {/* Input Field */}
      <div className="w-full px-3 pb-3">
        <div className="relative bg-gray-700 border border-gray-600 rounded-lg overflow-hidden">
          <input
            type="text"
            value={input}
            onChange={e => {
              setInput(e.target.value)
              userEditedRef.current = true
              if (userEditTimerRef.current) clearTimeout(userEditTimerRef.current)
              userEditTimerRef.current = setTimeout(() => { userEditedRef.current = false }, 1500)
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={mode === 'chat' ? 'Ask a question…' : 'Type what to write into the doc…'}
            className="w-full bg-transparent px-4 py-3 text-white placeholder-gray-400 focus:outline-none text-sm"
            disabled={sending}
          />
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              {listening && (
                <div className="text-xs text-gray-300 truncate max-w-[60%]" aria-live="polite">
                  {interimTranscript || 'Listening…'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!speechSupported || sending) return
                  if (listening) {
                    stopSpeech()
                  } else {
                    resetSpeech()
                    userEditedRef.current = false
                    startSpeech()
                  }
                }}
                disabled={!speechSupported || sending}
                title={speechSupported ? (listening ? 'Stop voice input' : 'Start voice input') : 'Voice not supported on this browser'}
                className={`p-1 rounded ${listening ? 'text-red-400' : 'text-gray-300 hover:text-white'}`}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              >
                <Mic className="h-5 w-5" />
              </button>
              <button onClick={handleSend} disabled={!input.trim() || sending} className="text-gray-300 hover:text-white p-1">
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full px-3 pb-4">
        <button onClick={() => setMode('chat')} className={`w-full sm:flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center font-medium ${mode === 'chat' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 border border-gray-600'}`}>
          <MessageSquare className="h-4 w-4 mr-2" /> Chat
        </button>
        <button onClick={() => setMode('write')} className={`w-full sm:flex-1 px-3 py-2 rounded-lg transition-colors flex items-center justify-center font-medium ${mode === 'write' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 border border-gray-600'}`}>
          <Edit3 className="h-4 w-4 mr-2" /> Write
        </button>
      </div>

      {/* Branding */}
      <div className="p-3 border-t border-gray-700 min-w-0">
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">⚡</span>
            </div>
            <span className="text-gray-300 font-medium text-sm truncate">BlumeNote AI</span>
          </div>
        </div>
      </div>
    </div>
  )
}