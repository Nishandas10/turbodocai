"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useParams } from "next/navigation"
import { ArrowRight, Camera, ChevronRight, FileText, Globe, Mic, Play, Pencil, BarChart3 } from "lucide-react"
import ProtectedRoute from "@/components/ProtectedRoute"
import DashboardSidebar from "@/components/DashboardSidebar"
import AudioModal from "@/app/components/AudioModal"
import DocumentUploadModal from "@/app/components/DocumentUploadModal"
import YouTubeVideoModal from "@/app/components/YouTubeVideoModal"
import WebsiteLinkModal from "@/app/components/WebsiteLinkModal"
import CameraModal from "@/app/components/CameraModal"
import CreateTestModal from "@/app/components/CreateTestModal"
import { useAuth } from "@/contexts/AuthContext"
import { listenToSpace, listenToSpaceDocuments, updateSpace } from "@/lib/firestore"
import type { Document as UserDoc, Space as SpaceType } from "@/lib/types"

export default function SpacePage() {
  const params = useParams<{ spacesId: string }>()
  const { user } = useAuth()
  const [space, setSpace] = useState<SpaceType | null>(null)
  const [docs, setDocs] = useState<UserDoc[]>([])
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [documentUploadModalOpen, setDocumentUploadModalOpen] = useState(false)
  const [youtubeVideoModalOpen, setYoutubeVideoModalOpen] = useState(false)
  const [websiteLinkModalOpen, setWebsiteLinkModalOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState("")
  const [createExamOpen, setCreateExamOpen] = useState(false)
  const [latestSessionId, setLatestSessionId] = useState<string | null>(null)

  const spaceId = params?.spacesId

  useEffect(() => {
    let unsubDocs: (() => void) | undefined
    let unsubSpace: (() => void) | undefined
    ;(async () => {
      if (!spaceId) return
      // Live space info
      unsubSpace = listenToSpace(spaceId, (sp) => {
        setSpace(sp)
        if (!editing) setNameInput(sp?.name || "")
      })
      // Space-scoped documents
      if (user?.uid) {
        unsubDocs = listenToSpaceDocuments(user.uid, spaceId, (d) => setDocs(d.slice(0, 9)))
      }
    })()
    return () => {
      try { if (unsubDocs) unsubDocs() } catch {}
      try { if (unsubSpace) unsubSpace() } catch {}
    }
  }, [spaceId, user?.uid, editing])

  // Load latest test session for this space from localStorage
  useEffect(() => {
    if (!spaceId) return
    try {
      if (typeof window === 'undefined') return
      const keys = Object.keys(localStorage).filter(k => k.startsWith('testSession:'))
      let latest: { id: string; ts: number } | null = null
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k)
          if (!raw) continue
            const parsed = JSON.parse(raw)
            if (parsed.spaceId === spaceId) {
              const ts = Number(parsed.sessionId) || parsed.endTime || 0
              if (!latest || ts > latest.ts) latest = { id: parsed.sessionId, ts }
            }
        } catch {}
      }
      setLatestSessionId(latest?.id || null)
    } catch {}
  }, [spaceId, createExamOpen])

  const username = (user?.displayName?.split(' ')[0]) || (user?.email?.split('@')[0]) || 'User'

  const renderDocPreview = (doc: UserDoc) => {
    const url = doc?.metadata?.downloadURL
    const mime = doc?.metadata?.mimeType || ''
    const text = (doc.summary || doc.content?.processed || doc.content?.raw || '').trim()
    const iconCls = "h-8 w-8 text-muted-foreground"

    if (url && mime.startsWith('image/')) {
      return (
        <div className="absolute inset-0 w-full h-full">
          <Image src={url} alt={doc.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        </div>
      )
    }
    if (doc.type === 'youtube') return <Play className={iconCls} />
    if (doc.type === 'website') return <Globe className={iconCls} />
    if (doc.type === 'audio') return <Mic className={iconCls} />

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

  // Legacy modal open handlers retained for existing quick action tiles, but Add content button now routes to dashboard
  const openAudioModal = () => setAudioModalOpen(true)
  const openDocumentUploadModal = () => setDocumentUploadModalOpen(true)
  const openYoutubeVideoModal = () => setYoutubeVideoModalOpen(true)
  const openWebsiteLinkModal = () => setWebsiteLinkModalOpen(true)

  const closeCamera = () => setCameraModalOpen(false)
  const closeAudioModal = () => setAudioModalOpen(false)
  const closeDocumentUploadModal = () => setDocumentUploadModalOpen(false)
  const closeYoutubeVideoModal = () => setYoutubeVideoModalOpen(false)
  const closeWebsiteLinkModal = () => setWebsiteLinkModalOpen(false)

  // Helper reserved for future actions

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background flex overflow-hidden">
  <DashboardSidebar onAddContentClick={() => { window.location.href = '/dashboard' }} onSearchClick={() => {}} />

        <div className="flex-1 p-8 overflow-y-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              {editing ? (
                <input
                  className="text-3xl font-bold bg-transparent border-b border-border focus:outline-none focus:border-blue-500 px-1"
                  value={nameInput}
                  autoFocus
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && user?.uid && spaceId) {
                      const val = nameInput.trim() || 'Untitled'
                      await updateSpace(user.uid, spaceId, { name: val })
                      setEditing(false)
                    } else if (e.key === 'Escape') {
                      setEditing(false)
                      setNameInput(space?.name || '')
                    }
                  }}
                  onBlur={async () => {
                    if (user?.uid && spaceId) {
                      const val = nameInput.trim() || 'Untitled'
                      await updateSpace(user.uid, spaceId, { name: val })
                    }
                    setEditing(false)
                  }}
                />
              ) : (
                <h1 className="text-3xl font-bold text-foreground">{space?.name || 'Untitled'}</h1>
              )}
              {!editing && (
                <button
                  type="button"
                  className="p-2 rounded-md border border-border hover:bg-muted"
                  title="Rename"
                  onClick={() => {
                    setNameInput(space?.name || '')
                    setEditing(true)
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-muted-foreground">Upload documents and create exams for this space</p>
          </div>

          {/* Create New Notes Section (same as dashboard) */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={openDocumentUploadModal}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Upload document</h3>
                <p className="text-muted-foreground text-xs">Any PDF, DOC, PPT, etc</p>
              </div>

              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={openAudioModal}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Mic className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Record or upload audio</h3>
                <p className="text-muted-foreground text-xs">Upload an audio file</p>
              </div>

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

              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={() => setCameraModalOpen(true)}>
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

          {/* Space header and quick actions */}
          <div className="max-w-6xl mx-auto mt-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{space?.name || `${username}'s Space`}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setCreateExamOpen(true)} className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/15">
                  <span>Create Test</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  disabled={!latestSessionId}
                  onClick={() => latestSessionId && window.location.assign(`/spaces/${spaceId}/test/results?session=${latestSessionId}`)}
                  className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-blue-600 dark:text-blue-300 ${latestSessionId ? 'hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-300/60 bg-blue-500/10' : 'opacity-40 cursor-not-allowed border-border'} `}
                  title={latestSessionId ? 'View latest test results' : 'No test results yet'}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>View Results</span>
                </button>
              </div>
            </div>

            {docs.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">No documents in this space yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {docs.map((d) => (
                  <div key={d.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer">
                    <div className="relative h-32 bg-muted flex items-center justify-center">
                      {renderDocPreview(d)}
                      <span className="absolute left-3 bottom-3 text-xs bg-background/80 border border-border rounded-full px-2 py-0.5">{space?.name || `${username}'s Space`}</span>
                    </div>
                    <div className="p-4">
                      <p className="font-medium text-card-foreground truncate" title={d.title}>{d.title || 'Untitled'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modals - pass spaceId so created docs are associated */}
        <CameraModal isOpen={cameraModalOpen} onClose={closeCamera} />
  <AudioModal isOpen={audioModalOpen} onClose={closeAudioModal} spaceId={spaceId as string} />
  <DocumentUploadModal isOpen={documentUploadModalOpen} onClose={closeDocumentUploadModal} spaceId={spaceId as string} />
        <YouTubeVideoModal isOpen={youtubeVideoModalOpen} onClose={closeYoutubeVideoModal} spaceId={spaceId as string} />
        <WebsiteLinkModal isOpen={websiteLinkModalOpen} onClose={closeWebsiteLinkModal} spaceId={spaceId as string} />
  {/* Create Test Modal */}
  <CreateTestModal isOpen={createExamOpen} onClose={() => setCreateExamOpen(false)} spaceId={spaceId as string} />
      </div>
    </ProtectedRoute>
  )
}
