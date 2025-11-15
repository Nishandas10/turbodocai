"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import useSpeechToText from "@/hooks/useSpeechToText"
import Image from "next/image"
import { 
  ChevronLeft,
  FileText,
  Mic,
  Play,
  ArrowRight,
  Search,
  Globe,
  Camera,
  AtSign,
  ChevronDown,
  ArrowUp,
  Plus,
  Box,
  MoreHorizontal,
  X,
  Brain,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import CameraModal from "../components/CameraModal"
import AudioModal from "../components/AudioModal"
import DocumentUploadModal from "../components/DocumentUploadModal"
import YouTubeVideoModal from "../components/YouTubeVideoModal"
import WebsiteLinkModal from "../components/WebsiteLinkModal"
import DashboardSidebar from "@/components/DashboardSidebar"
import { createSpace, listenToUserSpaces, listenToSpaceDocuments, updateSpace, deleteSpace, updateDocument, deleteDocument, listenToUserChats, getUserOnboarding } from "@/lib/firestore"
import { useRouter } from "next/navigation"
import { listenToUserDocuments } from "@/lib/firestore"
import type { Document as UserDoc, Space as SpaceType, Chat } from "@/lib/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { functions } from "@/lib/firebase"
import Favicon from "@/components/Favicon"
import { httpsCallable } from "firebase/functions"
import PdfThumbnail from "@/components/PdfThumbnail"
import DocxThumbnail from "@/components/DocxThumbnail"
import PptxThumbnail from "@/components/PptxThumbnail"
import WebsiteThumbnail from "@/components/WebsiteThumbnail"
import ChatThumbnail from "@/components/ChatThumbnail"
import AudioThumbnail from "@/components/AudioThumbnail"

export default function Dashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const username = (user?.displayName?.split(' ')[0]) || (user?.email?.split('@')[0]) || 'User'
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: number
    title: string
    type: 'audio' | 'document'
    lastOpened: string
  }>>([])
  const [prompt, setPrompt] = useState('')
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [documentUploadModalOpen, setDocumentUploadModalOpen] = useState(false)
  const [youtubeVideoModalOpen, setYoutubeVideoModalOpen] = useState(false)
  const [websiteLinkModalOpen, setWebsiteLinkModalOpen] = useState(false)
  const [recentDocs, setRecentDocs] = useState<UserDoc[]>([])
  const [recentChats, setRecentChats] = useState<Chat[]>([])
  const [spaces, setSpaces] = useState<SpaceType[]>([])
  const [spaceCounts, setSpaceCounts] = useState<Record<string, number>>({})
  // Explore removed
  // Prompt options
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [thinkModeEnabled, setThinkModeEnabled] = useState(false)
  // Add Context state
  const [contextOpen, setContextOpen] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [contextSearch, setContextSearch] = useState('')
  const contextWrapperRef = useRef<HTMLDivElement | null>(null)
  // Translation removed; overlay uses interimTranscript only
  const userEditedRef = useRef<boolean>(false)
  const userEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Track onboarding check state
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  const { supported: speechSupported, listening, interimTranscript, start: startSpeech, stop: stopSpeech, reset: resetSpeech } = useSpeechToText({
    lang: 'en-US',
    fallbackLangs: ['en-US'],
    continuous: false,
    interimResults: true,
    onPartial: () => { /* no-op: interim overlay handled via interimTranscript */ },
    onSegment: (seg) => {
      // If the user manually edited while mic active, do not auto-append
      if (!userEditedRef.current) {
        setPrompt(prev => prev ? prev + ' ' + seg : seg)
      }
    }
  })

  const [voiceActive, setVoiceActive] = useState(false)
  const deactivateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wantVoiceRef = useRef(false)

  const handleStartVoice = () => {
    if (!speechSupported) return
    if (deactivateTimerRef.current) { clearTimeout(deactivateTimerRef.current); deactivateTimerRef.current = null }
    wantVoiceRef.current = true
    resetSpeech()
  userEditedRef.current = false
    setVoiceActive(true)
    startSpeech()
  }
  const handleStopVoice = () => {
    wantVoiceRef.current = false
    stopSpeech()
    if (deactivateTimerRef.current) clearTimeout(deactivateTimerRef.current)
    setVoiceActive(false)
  userEditedRef.current = false
  }

  useEffect(() => {
    if (listening) {
      if (wantVoiceRef.current && !voiceActive) setVoiceActive(true)
      if (deactivateTimerRef.current) { clearTimeout(deactivateTimerRef.current); deactivateTimerRef.current = null }
    } else {
      if (wantVoiceRef.current) {
        setTimeout(() => { if (wantVoiceRef.current) startSpeech() }, 120)
      } else {
        if (voiceActive) setVoiceActive(false)
      }
    }
  }, [listening, voiceActive, startSpeech])

  useEffect(() => {
    return () => {
  if (userEditTimerRef.current) clearTimeout(userEditTimerRef.current)
    }
  }, [])

  const effectivePromptValue = (voiceActive && !userEditedRef.current && interimTranscript)
    ? (prompt ? prompt + ' ' + interimTranscript : interimTranscript)
    : prompt
  

  // Close context popover on outside click / Escape
  useEffect(() => {
    if (!contextOpen) return
    const onDown = (e: MouseEvent) => {
      if (contextWrapperRef.current && !contextWrapperRef.current.contains(e.target as Node)) {
        setContextOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [contextOpen])

  // Gate: ensure onboarding is completed before using dashboard
  useEffect(() => {
    const run = async () => {
      if (!user?.uid) return
      try {
        const res = await getUserOnboarding(user.uid)
        if (!res.completed) {
          router.replace('/onboarding')
        } else {
          setOnboardingChecked(true)
        }
      } catch (error) {
        console.error('Error checking onboarding:', error)
        // On error, allow access to dashboard
        setOnboardingChecked(true)
      }
    }
    run()
  }, [user?.uid, router])

  // Note: we do not early-return here to avoid conditional Hooks order.

  // Listen to user's recent documents
  useEffect(() => {
    if (!user?.uid) {
      setRecentDocs([])
      return
    }
    const unsubscribe = listenToUserDocuments(user.uid, (docs) => {
      setRecentDocs(docs.slice(0, 8))
    })
    return () => {
      try { unsubscribe() } catch {}
    }
  }, [user?.uid])

  // Listen to user's recent chats
  useEffect(() => {
    if (!user?.uid) {
      setRecentChats([])
      return
    }
    const unsubscribe = listenToUserChats(user.uid, (chats) => {
      setRecentChats(chats.slice(0, 8))
    })
    return () => {
      try { unsubscribe() } catch {}
    }
  }, [user?.uid])

  // Listen to user's spaces (recent first)
  useEffect(() => {
    if (!user?.uid) {
      setSpaces([])
      setSpaceCounts({})
      return
    }
    const unsub = listenToUserSpaces(user.uid, (sps) => {
      setSpaces(sps)
    })
    return () => { try { unsub() } catch {} }
  }, [user?.uid])

  // For first few spaces, keep a live count of documents
  useEffect(() => {
    if (!user?.uid) return
    const limit = 6
    const targets = spaces.slice(0, limit)
    const unsubs: Array<() => void> = []
    targets.forEach((sp) => {
      const u = listenToSpaceDocuments(user.uid!, sp.id, (docs) => {
        setSpaceCounts((prev) => ({ ...prev, [sp.id]: docs.length }))
      })
      unsubs.push(u)
    })
    return () => { unsubs.forEach((u) => { try { u() } catch {} }) }
  }, [spaces, user?.uid])

  // Explore removed

  const relativeTime = (date: unknown) => {
    try {
      let d: Date;
      
      if (!date) {
        d = new Date();
      } else if (date instanceof Date) {
        d = date;
      } else if (typeof date === 'object' && date !== null && 'toDate' in date && typeof (date as { toDate: () => Date }).toDate === 'function') {
        d = (date as { toDate: () => Date }).toDate();
      } else if (typeof date === 'number' || typeof date === 'string') {
        d = new Date(date);
      } else {
        d = new Date();
      }
      
      const diff = Date.now() - d.getTime()
      const s = Math.floor(diff / 1000)
      if (s < 60) return `just now`
      const m = Math.floor(s / 60)
      if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`
      const h = Math.floor(m / 60)
      if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
      const days = Math.floor(h / 24)
      return `${days} day${days > 1 ? 's' : ''} ago`
    } catch {
      return ''
    }
  }
  // Extract a YouTube video ID from common URL formats
  const getYouTubeId = (input?: string | null): string | null => {
    if (!input) return null
    try {
      // Handle bare IDs passed by mistake
      if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input

      const url = new URL(input)
      const host = url.hostname.replace(/^www\./, '')

      // youtu.be/<id>
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0]
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
      }

      if (host.endsWith('youtube.com')) {
        // youtube.com/watch?v=<id>
        const v = url.searchParams.get('v')
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
        // youtube.com/embed/<id>, /shorts/<id>, /live/<id>
        const parts = url.pathname.split('/').filter(Boolean)
        const idx = parts.findIndex(p => ['embed', 'shorts', 'live', 'v'].includes(p))
        if (idx !== -1 && parts[idx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[idx + 1])) {
          return parts[idx + 1]
        }
        // Sometimes path directly is the id
        const last = parts[parts.length - 1]
        if (last && /^[a-zA-Z0-9_-]{11}$/.test(last)) return last
      }
    } catch {}
    return null
  }
  // Explore removed

  const renderChatPreview = (chatId: string) => {
    return <ChatThumbnail chatId={chatId} />
  }

  const renderDocPreview = (doc: UserDoc) => {
    const url = doc?.metadata?.downloadURL
    const mime = doc?.metadata?.mimeType || ''
    const fileName = (doc?.metadata?.fileName || '').toLowerCase()
    const text = (doc.summary || doc.content?.processed || doc.content?.raw || '').trim()
    const iconCls = "h-8 w-8 text-muted-foreground"

    if (doc.type === 'youtube') {
      const videoId = getYouTubeId(doc?.metadata?.url || null)
      if (videoId) {
        const thumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        return (
          <div className="absolute inset-0 w-full h-full">
            <Image
              src={thumb}
              alt={doc.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          </div>
        )
      }
      return <Play className={iconCls} />
    }

    if (url && mime.startsWith('image/')) {
      return (
        <div className="absolute inset-0 w-full h-full">
          <Image 
            src={url}
            alt={doc.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      )
    }
    if (doc.type === 'website') {
      const rawUrl = (doc.metadata?.url || '') as string
      if (rawUrl) {
        return <WebsiteThumbnail url={rawUrl} className="absolute inset-0" />
      }
      // Fallback to favicon + host label if URL missing
      const host = (() => { try { return new URL(rawUrl).hostname.replace(/^www\./,'') } catch { return '' } })()
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          {host ? <Favicon host={host} className="h-8 w-8 mb-1 rounded" /> : <Globe className={iconCls} />}
          <p className="text-[10px] font-medium truncate w-full">{host || 'Website'}</p>
        </div>
      )
    }
    if (doc.type === 'audio') {
      const audioUrl = doc?.metadata?.downloadURL
      if (audioUrl && typeof audioUrl === 'string') {
        return <AudioThumbnail audioUrl={audioUrl} title={doc.title} className="absolute inset-0" />
      }
      return <Mic className={iconCls} />
    }

    // Default: show text excerpt if available
    // If this is a PDF and we have a direct URL, render a first-page thumbnail like in notes/[id]/chat
    const isPdf = doc.type === 'pdf' || mime.includes('pdf') || fileName.endsWith('.pdf')
    const isDocx = doc.type === 'docx' || mime.includes('word') || fileName.endsWith('.docx')
    const isPptx = doc.type === 'pptx' || mime.includes('presentation') || fileName.endsWith('.pptx')
    if (isPdf && typeof url === 'string' && url) {
      return (
        <PdfThumbnail fileUrl={url} className="absolute inset-0" />
      )
    }
    if (isDocx && typeof url === 'string' && url) {
      return <DocxThumbnail fileUrl={url} className="absolute inset-0" />
    }
    if (isPptx && typeof url === 'string' && url) {
      return <PptxThumbnail fileUrl={url} className="absolute inset-0" />
    }

    if (text) {
      const excerpt = text.split(/\n+/).slice(0, 4).join('\n')
      return (
        <div className="absolute inset-0 p-3 text-[11px] leading-4 text-foreground/80 whitespace-pre-line overflow-hidden">
          {excerpt}
        </div>
      )
    }
    return <FileText className={iconCls} />
  }

  // Mock search results - in real app this would come from API
  const mockDocuments: Array<{
    id: number
    title: string
    type: 'audio' | 'document'
    lastOpened: string
  }> = [
    { id: 1, title: "Icelandic: What Is It?", type: "audio", lastOpened: "less than a minute ago" },
    { id: 2, title: "Notex", type: "document", lastOpened: "less than a minute ago" },
    { id: 3, title: "Metabolomics Technologies and Identification Methods Overview", type: "document", lastOpened: "1 day ago" },
    { id: 4, title: "Machine Learning Basics", type: "document", lastOpened: "2 days ago" },
    { id: 5, title: "React Development Notes", type: "document", lastOpened: "3 days ago" },
    { id: 6, title: "Project Planning", type: "document", lastOpened: "1 week ago" }
  ]

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      setSearchResults([])
      return
    }
    
    const filtered = mockDocuments.filter(doc => 
      doc.title.toLowerCase().includes(query.toLowerCase())
    )
    setSearchResults(filtered)
  }


  const openCamera = () => {
    setCameraModalOpen(true)
  }

  const closeCamera = () => {
    setCameraModalOpen(false)
  }

  const openAudioModal = () => {
    setAudioModalOpen(true)
  }

  const closeAudioModal = () => {
    setAudioModalOpen(false)
  }

  const openDocumentUploadModal = () => {
    setDocumentUploadModalOpen(true)
  }

  const closeDocumentUploadModal = () => {
    setDocumentUploadModalOpen(false)
  }

  const openYoutubeVideoModal = () => {
    setYoutubeVideoModalOpen(true)
  }

  const closeYoutubeVideoModal = () => {
    setYoutubeVideoModalOpen(false)
  }

  const openWebsiteLinkModal = () => {
    setWebsiteLinkModalOpen(true)
  }

  const closeWebsiteLinkModal = () => {
    setWebsiteLinkModalOpen(false)
  }

  const handleSendPrompt = async () => {
    if (!prompt.trim() || !user?.uid) return
    try {
      const initial = prompt.trim()
      setPrompt('')

      // Create chat immediately
      const callCreate = httpsCallable(functions, 'createChat')
      const createRes = (await callCreate({
        userId: user.uid,
        language: 'en',
        title: initial,
        contextDocIds: selectedDocIds,
        webSearch: webSearchEnabled,
        thinkMode: thinkModeEnabled,
      })) as unknown as { data: { success: boolean; data?: { chatId?: string } } }
      const chatId = createRes?.data?.data?.chatId
      if (chatId) {
        // Redirect immediately with the prompt in query to auto-send
        const q = new URLSearchParams({ prompt: initial })
        // Pass toggle states and selected context so Chat page can trigger modes on first send
        q.set('webSearch', webSearchEnabled ? '1' : '0')
        q.set('thinkMode', thinkModeEnabled ? '1' : '0')
        if (selectedDocIds.length) {
          q.set('docs', selectedDocIds.join(','))
        }
        window.location.href = `/chat/${chatId}?${q.toString()}`
      } else {
        throw new Error('Failed to create chat')
      }
    } catch (e) {
      console.error('Start chat failed', e)
      alert('Failed to start chat')
    }
  }

  const createNewNote = async () => {
    if (!user?.uid) {
      console.error('User not authenticated')
      return
    }

    try {
      // Import Firebase functions directly
      const { createDocument } = await import('@/lib/firestore')
      const { uploadDocument } = await import('@/lib/storage')
      
      // Create document data
      const documentData = {
        title: 'Untitled Document',
        type: 'text' as const,
        content: {
          raw: '',
          processed: '',
        },
        metadata: {
          fileName: 'Untitled Document.txt',
          fileSize: 0,
          mimeType: 'text/plain',
        },
        tags: ['blank-document'],
        isPublic: false,
      }

      // Create document in Firestore first
      const documentId = await createDocument(user.uid, documentData)

      // Create a .txt file and upload to Firebase Storage
      const txtFile = new File([''], 'Untitled Document.txt', { type: 'text/plain' })
      const uploadResult = await uploadDocument(txtFile, user.uid, documentId)

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload document to storage')
      }

      // Update document with storage information
      const { updateDocumentStorageInfo } = await import('@/lib/firestore')
      await updateDocumentStorageInfo(
        documentId,
        user.uid,
        uploadResult.storagePath!,
        uploadResult.downloadURL!
      )

      // Redirect to the new note
      window.location.href = `/notes/${documentId}`
    } catch (error) {
      console.error('Error creating note:', error)
      alert('Error creating document. Please try again.')
    }
  }

  const handleCreateSpace = async () => {
    if (!user?.uid) return
    try {
      const id = await createSpace(user.uid, { name: 'Untitled' })
      router.push(`/spaces/${id}`)
    } catch (e) {
      console.error('Create space failed', e)
      alert('Failed to create space')
    }
  }
  
  const addDocToSpace = async (doc: UserDoc, spaceId: string) => {
    if (!user?.uid) return
    try {
      await updateDocument(doc.id, user.uid, { spaceId })
    } catch (e) {
      console.error('Add to space failed', e)
      alert('Failed to add to space')
    }
  }

  const removeDocFromSpace = async (doc: UserDoc) => {
    if (!user?.uid) return
    try {
      await updateDocument(doc.id, user.uid, { spaceId: '' as unknown as undefined })
    } catch (e) {
      console.error('Remove from space failed', e)
    }
  }

  const deleteDocPermanently = async (doc: UserDoc) => {
    if (!user?.uid) return
    if (!confirm('Delete this document permanently?')) return
    try {
      await deleteDocument(doc.id, user.uid)
    } catch (e) {
      console.error('Delete doc failed', e)
      alert('Failed to delete')
    }
  }

  // Open a user's own recent document
  const openRecentDoc = (doc: UserDoc) => {
    router.push(`/notes/${doc.id}`)
  }

  // Open a recent chat
  const openRecentChat = (chat: Chat) => {
    router.push(`/chat/${chat.id}`)
  }

  // Combine and sort recent documents and chats
  const combinedRecentItems = useMemo(() => {
    type RecentItem = { type: 'document'; item: UserDoc } | { type: 'chat'; item: Chat }
    
    const docItems: RecentItem[] = recentDocs.map(doc => ({ type: 'document' as const, item: doc }))
    const chatItems: RecentItem[] = recentChats.map(chat => ({ type: 'chat' as const, item: chat }))
    
    const allItems = [...docItems, ...chatItems]
    
    // Sort by updatedAt/lastAccessed (most recent first)
    allItems.sort((a, b) => {
      const aTime = a.type === 'document' 
        ? (a.item.lastAccessed || a.item.updatedAt)
        : (a.item.lastAccessed || a.item.updatedAt)
      const bTime = b.type === 'document'
        ? (b.item.lastAccessed || b.item.updatedAt)
        : (b.item.lastAccessed || b.item.updatedAt)
        
      // Convert Timestamp to number for comparison
      const aTimestamp = aTime instanceof Date ? aTime.getTime() : aTime.toMillis()
      const bTimestamp = bTime instanceof Date ? bTime.getTime() : bTime.toMillis()
      
      return bTimestamp - aTimestamp
    })
    
    return allItems.slice(0, 9) // Limit to 8 total items
  }, [recentDocs, recentChats])

  // Parse mirror id of public docs: `${ownerId}_${documentId}`
  // Explore removed

  // Show loading screen while checking onboarding status
  if (!onboardingChecked) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background flex overflow-hidden">
  {/* Left Sidebar */}
  <DashboardSidebar onCreateSpaceClick={handleCreateSpace} />

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome {username}</h1>
            <p className="text-muted-foreground">Create new notes</p>
          </div>

          {/* Create New Notes Section */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Blank Document */}
              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={createNewNote}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Blank document</h3>
                <p className="text-muted-foreground text-xs">Start from scratch</p>
              </div>

              {/* Record or Upload Audio */}
              <div 
                className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm"
                onClick={openAudioModal}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Mic className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Record or upload audio</h3>
                <p className="text-muted-foreground text-xs">Upload an audio file</p>
              </div>

              {/* Document Upload */}
              <div 
                className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm"
                onClick={openDocumentUploadModal}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">DOC</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Document upload</h3>
                <p className="text-muted-foreground text-xs">Any PDF, DOC, PPT, etc</p>
              </div>

              {/* YouTube Video */}
              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={openYoutubeVideoModal}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">YouTube video</h3>
                <p className="text-muted-foreground text-xs">Paste a YouTube link</p>
              </div>

              {/* Website Link */}
              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={openWebsiteLinkModal}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Website link</h3>
                <p className="text-muted-foreground text-xs">Paste a website URL</p>
              </div>

              {/* Camera */}
              <div 
                className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm"
                onClick={openCamera}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Camera</h3>
                <p className="text-muted-foreground text-xs">Open camera to capture</p>
              </div>
            </div>
          </div>

          {/* Prompt Bar Section */}
          <div className="max-w-3xl mx-auto">
            {/* Prompt Input */}
            <div className="bg-card border border-border rounded-2xl shadow-sm relative">
              {/* Top row: input + Send button */}
              <div className="flex items-center gap-3 px-4 pt-3">
                <textarea
                  className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground px-2 py-2 resize-none min-h-10 max-h-40"
                  placeholder={`Greetings ${username}`}
                  value={effectivePromptValue}
                  onChange={(e) => {
                    const v = e.target.value
                    const interimShown = interimTranscript || ''
                    let base = v
                    if (voiceActive && interimShown) {
                      // Strip trailing interim overlay (with or without a leading space)
                      if (base.endsWith(' ' + interimShown)) base = base.slice(0, -(' '.length + interimShown.length))
                      else if (base.endsWith(interimShown)) base = base.slice(0, -interimShown.length)
                    }
                    setPrompt(base)
                    if (voiceActive) {
                      userEditedRef.current = true
                      if (userEditTimerRef.current) clearTimeout(userEditTimerRef.current)
                      userEditTimerRef.current = setTimeout(() => { userEditedRef.current = false }, 1200)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendPrompt()
                    }
                    // Shift+Enter inserts a newline by default
                  }}
                  rows={1}
                />

                <button
                  type="button"
                  onClick={handleSendPrompt}
                  disabled={!prompt.trim()}
                  className="rounded-full p-2 bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send"
                  aria-label="Send"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>

              {/* Bottom row: model, add context, language toggle, icons */}
              <div className="flex items-center justify-between px-4 pb-3 mt-2">
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                        <span className="hidden sm:inline">{thinkModeEnabled ? 'Learn Pro' : 'Learn+'}</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); setThinkModeEnabled(v=>!v) }} className="flex items-center gap-3">
                        <Brain className="h-4 w-4 text-emerald-600" />
                        <span className="flex-1">Learn Pro</span>
                        <span role="switch" aria-checked={thinkModeEnabled} className={`relative shrink-0 w-16 h-7 rounded-full transition-colors duration-200 ${thinkModeEnabled ? 'bg-violet-600' : 'bg-muted'}`}>
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${thinkModeEnabled ? 'text-white opacity-100' : 'opacity-0'}`}>ON</span>
                          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${thinkModeEnabled ? 'opacity-0' : 'text-foreground/60 opacity-100'}`}>OFF</span>
                          <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${thinkModeEnabled ? 'translate-x-8' : ''}`} />
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); setWebSearchEnabled(v=>!v) }} className="flex items-center gap-3">
                        <Globe className="h-4 w-4 text-blue-600" />
                        <span className="flex-1">Search</span>
                        <span role="switch" aria-checked={webSearchEnabled} className={`relative shrink-0 w-16 h-7 rounded-full transition-colors duration-200 ${webSearchEnabled ? 'bg-blue-600' : 'bg-muted'}`}>
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${webSearchEnabled ? 'text-white opacity-100' : 'opacity-0'}`}>ON</span>
                          <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${webSearchEnabled ? 'opacity-0' : 'text-foreground/60 opacity-100'}`}>OFF</span>
                          <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${webSearchEnabled ? 'translate-x-8' : ''}`} />
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="relative" ref={contextWrapperRef}>
                    <button type="button" onClick={() => setContextOpen(o=>!o)} className="flex items-center gap-2 text-sm rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground">
                      <AtSign className="h-4 w-4" />
                      <span>Add Context{selectedDocIds.length ? ` (${selectedDocIds.length})` : ''}</span>
                    </button>
                    {contextOpen && (
                      <div className="absolute left-0 mt-2 w-96 bg-card border border-border rounded-xl shadow-xl z-50 p-3">
                        <div className="mb-2 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                          <span>Recents</span>
                          <button onClick={()=>{setContextOpen(false)}} className="text-muted-foreground hover:text-foreground text-xs">Done</button>
                        </div>
                        <div className="relative mb-3">
                          <input
                            value={contextSearch}
                            onChange={(e)=>setContextSearch(e.target.value)}
                            placeholder="Search"
                            className="w-full text-sm px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                          {recentDocs
                            .filter(d => !contextSearch.trim() || d.title.toLowerCase().includes(contextSearch.toLowerCase()))
                            .slice(0,4)
                            .map(d => {
                              const active = selectedDocIds.includes(d.id)
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  onClick={() => setSelectedDocIds(prev => prev.includes(d.id) ? prev.filter(x=>x!==d.id) : [...prev, d.id].slice(0,4))}
                                  className={`w-full text-left text-sm rounded-lg px-3 py-2 border transition-colors ${active ? 'border-blue-500 bg-blue-500/10 text-foreground' : 'border-transparent hover:bg-muted/60 text-muted-foreground'}`}
                                >
                                  {d.title || 'Untitled'}
                                </button>
                              )
                            })}
                          {recentDocs.length === 0 && <div className="text-xs text-muted-foreground px-1 py-6">No documents yet.</div>}
                        </div>
                      </div>
                    )}
                  </div>
                  {webSearchEnabled && (
                    <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 rounded-full pl-2 pr-1 py-0.5 border border-blue-500/30">
                      <Globe className="h-3 w-3" />
                      <span>@WebSearch</span>
                      <button type="button" onClick={() => setWebSearchEnabled(false)} className="hover:text-destructive/80 ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}

                  {/* Language toggle removed */}
                </div>

                <div className="flex items-center gap-4 text-muted-foreground">
                  <div className="h-9 flex items-center">
                    {voiceActive ? (
                      <div className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1 pr-3 transition-all duration-200 ease-in-out">
                        <div className="flex items-center gap-1 mr-1" aria-label={listening ? 'Listening…' : 'Processing voice…'}>
                          <span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite]" />
                          <span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite_0.15s]" />
                          <span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite_0.3s]" />
                        </div>
                        <button
                          type="button"
                          onClick={handleStopVoice}
                          className="p-1.5 rounded-full bg-red-500/90 text-white hover:bg-red-600 transition-colors"
                          title="Stop voice input"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        title={speechSupported ? 'Start voice input' : 'Speech not supported'}
                        onClick={handleStartVoice}
                        className="hover:text-foreground p-2 transition-colors duration-200"
                        type="button"
                      >
                        <Mic className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {selectedDocIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 px-1">
                {selectedDocIds.map(id => {
                  const title = recentDocs.find(r=>r.id===id)?.title || 'Document'
                  return (
                    <span key={id} className="inline-flex items-center gap-1 text-xs bg-muted/70 rounded-full pl-2 pr-1 py-0.5">
                      {title.length>22?title.slice(0,22)+'…':title}
                      <button type="button" onClick={()=>setSelectedDocIds(prev=>prev.filter(x=>x!==id))} className="hover:text-destructive">×</button>
                    </span>
                  )
                })}
              </div>
            )}
            {/* Language toggle removed; default English */}
          </div>

          {/* Spaces Section */}
          <div className="max-w-6xl mx-auto mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Spaces</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {spaces.map((sp) => (
                <div key={sp.id} className="group relative bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-blue-500 transition-colors cursor-pointer"
                  onClick={() => router.push(`/spaces/${sp.id}`)}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Box className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-card-foreground truncate">{sp.name || 'Untitled Space'}</p>
                    <p className="text-xs text-muted-foreground">{spaceCounts[sp.id] ?? 0} { (spaceCounts[sp.id] ?? 0) === 1 ? 'content' : 'contents' }</p>
                  </div>

                  {/* Hover menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Space menu"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={async (e) => {
                        e.preventDefault()
                        try {
                          const url = `${window.location.origin}/spaces/${sp.id}`
                          await navigator.clipboard.writeText(url)
                          alert('Space link copied')
                        } catch {}
                      }}>Share</DropdownMenuItem>
                      <DropdownMenuItem onSelect={async (e) => {
                        e.preventDefault()
                        const newName = window.prompt('Rename space', sp.name || 'Untitled')?.trim()
                        if (newName && user?.uid) await updateSpace(user.uid, sp.id, { name: newName })
                      }}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={async (e) => {
                        e.preventDefault()
                        if (confirm('Delete this space? This does not remove documents.')) {
                          if (user?.uid) await deleteSpace(user.uid, sp.id)
                        }
                      }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}

              {/* Add space */}
              <div className="bg-card border border-dashed border-border rounded-2xl p-4 flex items-center justify-center hover:border-blue-500 transition-colors cursor-pointer" onClick={handleCreateSpace}>
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Recents Section */}
          <div className="max-w-6xl mx-auto mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Recents</h2>
              <button
                onClick={() => router.push('/notes')}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                View all
              </button>
            </div>

            {combinedRecentItems.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">No recent documents or chats yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {combinedRecentItems.map((item) => {
                  if (item.type === 'document') {
                    const d = item.item
                    return (
                      <div
                        key={`doc-${d.id}`}
                        className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer relative"
                        onClick={() => openRecentDoc(d)}
                      >
                        <div className="relative h-32 bg-muted flex items-center justify-center">
                          {renderDocPreview(d)}
                          {d.spaceId ? (
                            <span className="absolute left-3 bottom-3 text-xs bg-background/80 border border-border rounded-full px-2 py-0.5">
                              {spaces.find(sp => sp.id === d.spaceId)?.name || 'Space'}
                            </span>
                          ) : null}
                          {/* Three dots menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Document menu"
                              >
                                <MoreHorizontal className="h-4 w-4 text-black" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-56">
                              {spaces.length === 0 ? (
                                <DropdownMenuItem disabled>Add to space (none)</DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem disabled className="opacity-70">Add to space</DropdownMenuItem>
                                  {spaces.slice(0,6).map(sp => (
                                    <DropdownMenuItem key={sp.id} onSelect={(e)=>{ e.preventDefault(); addDocToSpace(d, sp.id) }}>
                                      {sp.name || 'Untitled'}
                                    </DropdownMenuItem>
                                  ))}
                                  {d.spaceId ? (
                                    <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); removeDocFromSpace(d) }}>Remove from space</DropdownMenuItem>
                                  ) : null}
                                </>
                              )}
                              <div className="my-1 h-px bg-border" />
                              <DropdownMenuItem className="text-destructive" onSelect={(e)=>{ e.preventDefault(); deleteDocPermanently(d) }}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="p-4">
                          <p className="font-medium text-card-foreground truncate" title={d.title}>{d.title || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">{relativeTime(d.createdAt || d.updatedAt)}</p>
                        </div>
                      </div>
                    )
                  } else {
                    // Chat item
                    const c = item.item
                    return (
                      <div
                        key={`chat-${c.id}`}
                        className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer relative"
                        onClick={() => openRecentChat(c)}
                      >
                        <div className="relative h-32 bg-muted flex items-center justify-center">
                          {renderChatPreview(c.id)}
                          <span className="absolute left-3 bottom-3 text-xs bg-background/80 border border-border rounded-full px-2 py-0.5">Chat</span>
                        </div>
                        <div className="p-4">
                          <p className="font-medium text-card-foreground truncate" title={c.title}>{c.title || 'Untitled Chat'}</p>
                          <p className="text-xs text-muted-foreground">{relativeTime(c.updatedAt || c.createdAt)}</p>
                        </div>
                      </div>
                    )
                  }
                })}
              </div>
            )}
          </div>

          {/* Explore section removed */}
        </div>

        {/* Camera Modal */}
        <CameraModal 
          isOpen={cameraModalOpen} 
          onClose={closeCamera} 
        />

        {/* Audio Modal */}
        <AudioModal 
          isOpen={audioModalOpen} 
          onClose={closeAudioModal} 
        />

        {/* Document Upload Modal */}
        <DocumentUploadModal 
          isOpen={documentUploadModalOpen} 
          onClose={closeDocumentUploadModal} 
        />

        {/* YouTube Video Modal */}
        <YouTubeVideoModal 
          isOpen={youtubeVideoModalOpen} 
          onClose={closeYoutubeVideoModal} 
        />

        {/* Website Link Modal */}
        <WebsiteLinkModal 
          isOpen={websiteLinkModalOpen} 
          onClose={closeWebsiteLinkModal} 
        />

        {/* Search Modal */}
        {searchModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-card-foreground">Search Documents</h2>
                  <button
                    onClick={() => setSearchModalOpen(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5 rotate-45" />
                  </button>
                </div>
              </div>

              {/* Search Input */}
              <div className="p-6 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              {/* Search Results */}
              <div className="p-6 overflow-y-auto max-h-96">
                {searchQuery.trim() === '' ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Start typing to search...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <p>No documents found for &quot;{searchQuery}&quot;</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchResults.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-blue-500 transition-colors cursor-pointer group"
                      >
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                          {doc.type === 'audio' ? (
                            <Mic className="h-5 w-5 text-white" />
                          ) : (
                            <FileText className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-card-foreground font-medium truncate">{doc.title}</h3>
                          <p className="text-muted-foreground text-sm">Last opened {doc.lastOpened}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}