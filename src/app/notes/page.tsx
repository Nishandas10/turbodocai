"use client"

import { useState, useEffect } from "react"
import { 
  FileText,
  Plus,
  MoreVertical
} from "lucide-react"
import { Button } from "@/components/ui/button"
// Link import removed after removing Edit/Share buttons
import { useAuth } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import DashboardSidebar from "@/components/DashboardSidebar"
import { listenToUserDocuments, createDocument, updateDocumentStorageInfo, listenToUserSpaces, updateDocument, deleteDocument } from "@/lib/firestore"
import { uploadDocument } from "@/lib/storage"
import type { Document as UserDoc, Space as SpaceType } from "@/lib/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Globe, Mic, Play, Image as ImageIcon, Lock, Unlock, Box } from "lucide-react"
import Image from 'next/image'

export default function NotesPage() {
  const { user } = useAuth()
  const [documents, setDocuments] = useState<UserDoc[]>([])
  const [creating, setCreating] = useState(false)
  const [spaces, setSpaces] = useState<SpaceType[]>([])

  // Realtime documents (all user docs)
  useEffect(() => {
    if (!user?.uid) { setDocuments([]); return }
    const unsub = listenToUserDocuments(user.uid, (docs) => setDocuments(docs))
    return () => { try { unsub() } catch {} }
  }, [user?.uid])

  // Spaces listener
  useEffect(() => {
    if (!user?.uid) { setSpaces([]); return }
    const unsub = listenToUserSpaces(user.uid, (sps) => setSpaces(sps))
    return () => { try { unsub() } catch {} }
  }, [user?.uid])

  const createNewNote = async () => {
    if (!user?.uid || creating) return
    try {
      setCreating(true)
      const documentData = {
        title: 'Untitled Document',
        type: 'text' as const,
        content: { raw: '', processed: '' },
        metadata: { fileName: 'Untitled Document.txt', fileSize: 0, mimeType: 'text/plain' },
        tags: ['blank-document'],
        isPublic: false,
      }
      const documentId = await createDocument(user.uid, documentData)
      const txtFile = new File([''], 'Untitled Document.txt', { type: 'text/plain' })
      const uploadResult = await uploadDocument(txtFile, user.uid, documentId)
      if (uploadResult.success) {
        await updateDocumentStorageInfo(documentId, user.uid, uploadResult.storagePath!, uploadResult.downloadURL!)
      }
      window.location.href = `/notes/${documentId}`
    } catch (e) {
      console.error('Create note failed', e)
      alert('Failed to create note')
    } finally {
      setCreating(false)
    }
  }

  // Relative time helper
  const relativeTime = (date: unknown) => {
    try {
      let d: Date
      if (!date) d = new Date()
      else if (date instanceof Date) d = date
      else if (typeof date === 'object' && date !== null && 'toDate' in date) d = (date as { toDate: () => Date }).toDate()
      else d = new Date(date as string)
      const diff = Date.now() - d.getTime()
      const s = Math.floor(diff/1000)
      if (s < 60) return 'just now'
      const m = Math.floor(s/60)
      if (m < 60) return `${m}m ago`
      const h = Math.floor(m/60)
      if (h < 24) return `${h}h ago`
      const days = Math.floor(h/24)
      return `${days}d ago`
    } catch { return '' }
  }

  // Document preview renderer (mirrors dashboard recents style)
  const renderPreview = (doc: UserDoc) => {
    const url = doc.metadata?.downloadURL
    const mime = doc.metadata?.mimeType || ''
    const text = (doc.summary || doc.content?.processed || doc.content?.raw || '').trim()
    const iconCls = "h-8 w-8 text-muted-foreground"
    if (url && mime.startsWith('image/')) {
      return (
        <div className="absolute inset-0 w-full h-full">
          <Image src={url} alt={doc.title || 'Document image'} fill className="object-cover" sizes="(max-width:768px) 100vw, 25vw" />
        </div>
      )
    }
    if (doc.type === 'youtube') return <Play className={iconCls} />
    if (doc.type === 'website') return <Globe className={iconCls} />
    if (doc.type === 'audio') return <Mic className={iconCls} />
    if (doc.type === 'image') return <ImageIcon className={iconCls} />
    if (text) {
      const excerpt = text.split(/\n+/).slice(0,4).join('\n')
      return <div className="absolute inset-0 p-3 text-[11px] leading-4 text-foreground/80 whitespace-pre-line overflow-hidden">{excerpt}</div>
    }
    return <FileText className={iconCls} />
  }

  // Per-card actions
  const toggleVisibility = async (doc: UserDoc) => {
    if (!user?.uid) return
    try { await updateDocument(doc.id, user.uid, { isPublic: !doc.isPublic }) } catch (e) { console.error(e); alert('Failed to update visibility') }
  }
  const addDocToSpace = async (doc: UserDoc, spaceId: string) => {
    if (!user?.uid) return
    try { await updateDocument(doc.id, user.uid, { spaceId }) } catch (e) { console.error(e); alert('Failed to add to space') }
  }
  const removeDocFromSpace = async (doc: UserDoc) => {
    if (!user?.uid) return
    try { await updateDocument(doc.id, user.uid, { spaceId: '' as unknown as undefined }) } catch (e) { console.error(e); alert('Failed to remove from space') }
  }
  const deleteDocPermanently = async (doc: UserDoc) => {
    if (!user?.uid) return
    if (!confirm('Delete this document permanently?')) return
    try { await deleteDocument(doc.id, user.uid) } catch (e) { console.error(e); alert('Failed to delete') }
  }

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background flex overflow-hidden">
  <DashboardSidebar />

        {/* Main Content */}
  <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="bg-background border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">All Notes</h1>
                <p className="text-muted-foreground">Manage and organize your notes</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button disabled={creating} onClick={createNewNote} className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60">
                  <Plus className="h-4 w-4 mr-2" />
                  {creating ? 'Creating...' : 'New Note'}
                </Button>
              </div>
            </div>
          </div>

          {/* Notes Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {documents.map((note) => (
                <div key={note.id} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer relative">
                  <div className="relative h-32 bg-muted flex items-center justify-center" onClick={() => window.location.href = `/notes/${note.id}`}>
                    {renderPreview(note)}
                    <span className="absolute left-3 bottom-3 text-xs bg-background/80 border border-border rounded-full px-2 py-0.5 max-w-[60%] truncate">{(note.spaceId && spaces.find(s=>s.id===note.spaceId)?.name) || 'No Space'}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                          onClick={(e) => { e.stopPropagation() }}
                          aria-label="Document menu"
                        >
                          <MoreVertical className="h-4 w-4 text-black" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-56">
                        <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); toggleVisibility(note) }} className="flex items-center gap-2">
                          {note.isPublic ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                          <span>{note.isPublic ? 'Make private' : 'Make public'}</span>
                        </DropdownMenuItem>
                        <div className="my-1 h-px bg-border" />
                        {spaces.length === 0 ? (
                          <DropdownMenuItem disabled>Add to space (none)</DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem disabled className="opacity-70">Add to space</DropdownMenuItem>
                            {spaces.slice(0,6).map(sp => (
                              <DropdownMenuItem key={sp.id} onSelect={(e)=>{ e.preventDefault(); addDocToSpace(note, sp.id) }}>
                                <Box className="h-4 w-4 mr-2" /> {sp.name || 'Untitled'}
                              </DropdownMenuItem>
                            ))}
                            {note.spaceId && <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); removeDocFromSpace(note) }}>Remove from space</DropdownMenuItem>}
                          </>
                        )}
                        <div className="my-1 h-px bg-border" />
                        <DropdownMenuItem className="text-destructive" onSelect={(e)=>{ e.preventDefault(); deleteDocPermanently(note) }}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="p-4" onClick={() => window.location.href = `/notes/${note.id}`}>
                    <p className="font-medium text-card-foreground truncate mb-1" title={note.title}>{note.title || 'Untitled'}</p>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{relativeTime(note.createdAt)}</p>
                    {/* Action buttons removed per request */}
                  </div>
                </div>
              ))}
              {documents.length === 0 && (
                <div className="col-span-full text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">No documents yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 