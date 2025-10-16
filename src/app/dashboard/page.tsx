"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, FileText, Mic, Play, ArrowRight, Search, Globe, Camera } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import CameraModal from "../components/CameraModal"
import AudioModal from "../components/AudioModal"
import DocumentUploadModal from "../components/DocumentUploadModal"
import YouTubeVideoModal from "../components/YouTubeVideoModal"
import WebsiteLinkModal from "../components/WebsiteLinkModal"
import DashboardSidebar from "@/components/DashboardSidebar"
import { createSpace, listenToUserSpaces, listenToSpaceDocuments, listenToExploreDocuments, getDocument as getUserDoc } from "@/lib/firestore"
import { useRouter } from "next/navigation"
import { listenToUserDocuments } from "@/lib/firestore"
import type { Document as UserDoc, Space as SpaceType } from "@/lib/types"
import type { PublicDocumentMeta } from "@/lib/firestore"
import PromptBar from "./components/PromptBar"
import SpacesSection from "./components/SpacesSection"
import RecentsSection from "./components/RecentsSection"
import ExploreSection from "./components/ExploreSection"

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
  // prompt UI moved into PromptBar component
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [documentUploadModalOpen, setDocumentUploadModalOpen] = useState(false)
  const [youtubeVideoModalOpen, setYoutubeVideoModalOpen] = useState(false)
  const [websiteLinkModalOpen, setWebsiteLinkModalOpen] = useState(false)
  const [recentDocs, setRecentDocs] = useState<UserDoc[]>([])
  const [spaces, setSpaces] = useState<SpaceType[]>([])
  const [spaceCounts, setSpaceCounts] = useState<Record<string, number>>({})
  const [exploreDocs, setExploreDocs] = useState<PublicDocumentMeta[]>([])
  const [explorePreviewMap, setExplorePreviewMap] = useState<Record<string, string>>({})
  // Prompt, voice, and context UI state have been moved into PromptBar component

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

  // Listen to public Explore docs (newest first)
  useEffect(() => {
    const unsub = listenToExploreDocuments((docs) => {
      setExploreDocs(docs.slice(0, 8))
    })
    return () => { try { unsub() } catch {} }
  }, [])

  // Fetch preview text for Explore docs from source userDocuments (summary/content)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!exploreDocs.length) { setExplorePreviewMap({}); return }
      try {
        const pairs = await Promise.all(exploreDocs.map(async (d) => {
          const idx = d.id.indexOf('_')
          const parsedOwner = idx === -1 ? '' : d.id.slice(0, idx)
          const ownerId = d.ownerId || parsedOwner
          const documentId = idx === -1 ? d.id : d.id.slice(idx + 1)
          if (!ownerId || !documentId) return [d.id, ''] as const
          try {
            const full = await getUserDoc(documentId, ownerId)
            const text = (full?.summary || full?.content?.processed || full?.content?.raw || '').trim()
            return [d.id, text] as const
          } catch {
            return [d.id, ''] as const
          }
        }))
        if (!cancelled) {
          const map: Record<string, string> = {}
          for (const [id, text] of pairs) map[id] = text
          setExplorePreviewMap(map)
        }
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [exploreDocs])

  // relativeTime no longer used here; sections handle their own timestamps
  // Preview rendering moved into modular components

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

  // Chat creation logic is encapsulated in PromptBar

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

  // Recents and Explore actions are handled within their respective components

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
          <PromptBar userId={user?.uid} username={username} recentDocs={recentDocs} />

          {/* Spaces Section */}
          <SpacesSection spaces={spaces} spaceCounts={spaceCounts} userId={user?.uid} />

          {/* Recents Section */}
          <RecentsSection username={username} recentDocs={recentDocs} spaces={spaces} userId={user?.uid} />

          {/* Explore Section */}
          <ExploreSection exploreDocs={exploreDocs} spaces={spaces} explorePreviewMap={explorePreviewMap} userId={user?.uid} />
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