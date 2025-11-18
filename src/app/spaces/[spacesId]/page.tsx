"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { ArrowRight, Camera, ChevronRight, FileText, Globe, Mic, Play, Pencil, BarChart3, MoreHorizontal } from "lucide-react"
import ProtectedRoute from "@/components/ProtectedRoute"
import DashboardSidebar from "@/components/DashboardSidebar"
import AudioModal from "@/app/components/AudioModal"
import DocumentUploadModal from "@/app/components/DocumentUploadModal"
import YouTubeVideoModal from "@/app/components/YouTubeVideoModal"
import WebsiteLinkModal from "@/app/components/WebsiteLinkModal"
import CameraModal from "@/app/components/CameraModal"
import CreateTestModal from "@/app/components/CreateTestModal"
import { useAuth } from "@/contexts/AuthContext"
import { listenToSpace, listenToSpaceDocuments, updateSpace, listenToUserSpaces, updateDocument, deleteDocument } from "@/lib/firestore"
import type { Document as UserDoc, Space as SpaceType } from "@/lib/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import PdfThumbnail from "@/components/PdfThumbnail"
import DocxThumbnail from "@/components/DocxThumbnail"
import PptxThumbnail from "@/components/PptxThumbnail"
import WebsiteThumbnail from "@/components/WebsiteThumbnail"
import AudioThumbnail from "@/components/AudioThumbnail"
import Favicon from "@/components/Favicon"

export default function SpacePage() {
  const params = useParams<{ spacesId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [space, setSpace] = useState<SpaceType | null>(null)
  const [docs, setDocs] = useState<UserDoc[]>([])
  const [spaces, setSpaces] = useState<SpaceType[]>([])
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
    let unsubUserSpaces: (() => void) | undefined
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
        // All spaces for dropdown menu actions
        unsubUserSpaces = listenToUserSpaces(user.uid, (sps) => setSpaces(sps))
      }
    })()
    return () => {
      try { if (unsubDocs) unsubDocs() } catch {}
      try { if (unsubSpace) unsubSpace() } catch {}
      try { if (unsubUserSpaces) unsubUserSpaces() } catch {}
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

  // Extract a YouTube video ID from common URL formats (same logic as dashboard)
  const getYouTubeId = (input?: string | null): string | null => {
    if (!input) return null
    try {
      if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input
      const url = new URL(input)
      const host = url.hostname.replace(/^www\./, '')
      if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0]
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
      }
      if (host.endsWith('youtube.com')) {
        const v = url.searchParams.get('v')
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v
        const parts = url.pathname.split('/').filter(Boolean)
        const idx = parts.findIndex(p => ['embed', 'shorts', 'live', 'v'].includes(p))
        if (idx !== -1 && parts[idx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[idx + 1])) {
          return parts[idx + 1]
        }
        const last = parts[parts.length - 1]
        if (last && /^[a-zA-Z0-9_-]{11}$/.test(last)) return last
      }
    } catch {}
    return null
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
            <Image src={thumb} alt={doc.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
          </div>
        )
      }
      return <Play className={iconCls} />
    }

    if (url && mime.startsWith('image/')) {
      return (
        <div className="absolute inset-0 w-full h-full">
          <Image src={url} alt={doc.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        </div>
      )
    }

    if (doc.type === 'website') {
      const rawUrl = (doc.metadata?.url || '') as string
      if (rawUrl) {
        return <WebsiteThumbnail url={rawUrl} className="absolute inset-0" />
      }
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

    const isPdf = doc.type === 'pdf' || mime.includes('pdf') || fileName.endsWith('.pdf')
    const isDocx = doc.type === 'docx' || mime.includes('word') || fileName.endsWith('.docx')
    const isPptx = doc.type === 'pptx' || mime.includes('presentation') || fileName.endsWith('.pptx')
    if (isPdf && typeof url === 'string' && url) {
      return <PdfThumbnail fileUrl={url} className="absolute inset-0" />
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
  const addDocToSpace = async (doc: UserDoc, destSpaceId: string) => {
    if (!user?.uid) return
    try {
      await updateDocument(doc.id, user.uid, { spaceId: destSpaceId })
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
      alert('Failed to remove from space')
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

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background flex overflow-hidden">
  <DashboardSidebar onAddContentClick={() => { window.location.href = '/dashboard' }} />

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{space?.name || `${username}'s Space`}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-2 sm:mt-0 w-full sm:w-auto">
                <button onClick={() => setCreateExamOpen(true)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/15">
                  <span>Create Test</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  disabled={!latestSessionId}
                  onClick={() => latestSessionId && window.location.assign(`/spaces/${spaceId}/test/results?session=${latestSessionId}`)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-blue-600 dark:text-blue-300 ${latestSessionId ? 'hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-300/60 bg-blue-500/10' : 'opacity-40 cursor-not-allowed border-border'} `}
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
                  <div
                    key={d.id}
                    className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer"
                    onClick={() => router.push(`/notes/${d.id}`)}
                  >
                    <div className="relative h-32 bg-muted flex items-center justify-center">
                      {renderDocPreview(d)}
                      <span className="absolute left-3 bottom-3 text-xs bg-background/80 border border-border rounded-full px-2 py-0.5">{space?.name || `${username}'s Space`}</span>
                      {/* Three dots menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="absolute top-2 right-2 opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
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
