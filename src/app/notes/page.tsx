"use client"

import { useState, useEffect, useMemo } from "react"
import { FileText, Plus, MoreVertical, Mic, Play, Lock, Unlock, Box } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import DashboardSidebar from "@/components/DashboardSidebar"
import { listenToUserDocuments, createDocument, updateDocumentStorageInfo, listenToUserSpaces, updateDocument, deleteDocument, listenToMindMaps, listenToUserChats } from "@/lib/firestore"
import { uploadDocument } from "@/lib/storage"
import type { Document as UserDoc, Space as SpaceType, MindMap, Chat } from "@/lib/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Image from 'next/image'

export default function NotesPage() {
    const { user } = useAuth()
    const [documents, setDocuments] = useState<UserDoc[]>([])
    const [creating, setCreating] = useState(false)
    const [spaces, setSpaces] = useState<SpaceType[]>([])
    const [mindmaps, setMindmaps] = useState<MindMap[]>([])
    const [chats, setChats] = useState<Chat[]>([])

    type CombinedItem = { id: string; kind: 'document' | 'mindmap' | 'chat'; createdAtMs: number; ref: UserDoc | MindMap | Chat }

    const combinedItems = useMemo<CombinedItem[]>(() => {
      // Accept unknown timestamp-like values (Firestore Timestamp, Date, number, string)
      const toMs = (val: unknown): number => {
        if (!val) return 0
        if (val instanceof Date) return val.getTime()
        if (typeof val === 'object' && val && 'toDate' in (val as Record<string, unknown>)) {
          try { return (val as { toDate: () => Date }).toDate().getTime() } catch { return 0 }
        }
        const t = new Date(val as string | number).getTime(); return isNaN(t) ? 0 : t
      }
      const docs: CombinedItem[] = documents.map(d => ({ id: d.id, kind: 'document', createdAtMs: toMs(d.createdAt), ref: d }))
      const mms: CombinedItem[] = mindmaps.map(m => ({ id: m.id, kind: 'mindmap', createdAtMs: toMs(m.createdAt), ref: m }))
      const ch: CombinedItem[] = chats.map(c => ({ id: c.id, kind: 'chat', createdAtMs: toMs(c.createdAt), ref: c }))
      return [...docs, ...mms, ...ch].sort((a,b) => b.createdAtMs - a.createdAtMs)
    }, [documents, mindmaps, chats])

    // listeners
    useEffect(() => {
      if (!user?.uid) { setDocuments([]); return }
      const unsub = listenToUserDocuments(user.uid, setDocuments)
      return () => { try { unsub() } catch {} }
    }, [user?.uid])

    useEffect(() => {
      if (!user?.uid) { setSpaces([]); return }
      const unsub = listenToUserSpaces(user.uid, setSpaces)
      return () => { try { unsub() } catch {} }
    }, [user?.uid])

    useEffect(() => {
      if (!user?.uid) { setMindmaps([]); return }
      const unsub = listenToMindMaps(user.uid, setMindmaps)
      return () => { try { unsub() } catch {} }
    }, [user?.uid])

    useEffect(() => {
      if (!user?.uid) { setChats([]); return }
      const unsub = listenToUserChats(user.uid, setChats)
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
      } finally { setCreating(false) }
    }

    const relativeTime = (date: unknown) => {
      try {
        let d: Date
        if (!date) d = new Date()
        else if (date instanceof Date) d = date
        else if (typeof date === 'object' && date && 'toDate' in (date as Record<string, unknown>)) d = (date as { toDate: () => Date }).toDate()
        else d = new Date(date as string | number)
        const diff = Date.now() - d.getTime()
        const s = Math.floor(diff/1000); if (s < 60) return 'just now'
        const m = Math.floor(s/60); if (m < 60) return `${m}m ago`
        const h = Math.floor(m/60); if (h < 24) return `${h}h ago`
        const days = Math.floor(h/24); return `${days}d ago`
      } catch { return '' }
    }

    // helper actions
    const toggleVisibility = async (doc: UserDoc) => {
      if (!user?.uid) return
      try { await updateDocument(doc.id, user.uid, { isPublic: !doc.isPublic }) } catch(e) { console.error(e) }
    }
    const addDocToSpace = async (doc: UserDoc, spaceId: string) => {
      if (!user?.uid) return
      try { await updateDocument(doc.id, user.uid, { spaceId }) } catch(e) { console.error(e) }
    }
    const removeDocFromSpace = async (doc: UserDoc) => {
      if (!user?.uid) return
      try { await updateDocument(doc.id, user.uid, { spaceId: undefined }) } catch(e) { console.error(e) }
    }
    const deleteDocPermanently = async (doc: UserDoc) => {
      if (!user?.uid) return
      if (!confirm('Delete this document permanently?')) return
      try { await deleteDocument(doc.id, user.uid) } catch(e) { console.error(e) }
    }

    const renderPreview = (doc: UserDoc) => {
      const mime = doc.metadata?.mimeType || ''
      const url = doc.metadata?.downloadURL
      if (mime.startsWith('image/') && url) {
        return <Image src={url} alt={doc.title || 'image'} fill className="object-cover" />
      }
      if (mime.startsWith('audio/')) return <Mic className="h-8 w-8 text-muted-foreground" />
      if (mime.startsWith('video/')) return <Play className="h-8 w-8 text-muted-foreground" />
      if (mime.includes('pdf')) return <FileText className="h-8 w-8 text-muted-foreground" />
      return <FileText className="h-8 w-8 text-muted-foreground" />
    }

    return (
      <ProtectedRoute>
        <div className="flex h-full">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-3 flex items-center justify-between">
              <h1 className="text-2xl font-semibold">Notes</h1>
              <div className="flex items-center gap-2">
                <Button onClick={createNewNote} disabled={creating} variant="default">
                  <Plus className="h-4 w-4 mr-1" /> New Doc
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-10">
              <div className="flex items-center justify-between mb-4 mt-2">
                <h2 className="text-lg font-semibold">All Items</h2>
                <span className="text-xs text-muted-foreground">{combinedItems.length} total</span>
              </div>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {combinedItems.map(item => {
                  if (item.kind === 'document') {
                    const note = item.ref as UserDoc
                    return (
                      <div key={`doc-${note.id}`} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer relative">
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
                                </>
                              )}
                              {note.spaceId && <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); removeDocFromSpace(note) }}>Remove from space</DropdownMenuItem>}
                              <div className="my-1 h-px bg-border" />
                              <DropdownMenuItem className="text-destructive" onSelect={(e)=>{ e.preventDefault(); deleteDocPermanently(note) }}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">Doc</span>
                        </div>
                        <div className="p-4" onClick={() => window.location.href = `/notes/${note.id}`}>        
                          <p className="font-medium text-card-foreground truncate mb-1" title={note.title}>{note.title || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{relativeTime(note.createdAt)}</p>
                        </div>
                      </div>
                    )
                  }
                  if (item.kind === 'mindmap') {
                    const mm = item.ref as MindMap
                    return (
                      <div key={`mm-${mm.id}`} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-purple-500 transition-colors cursor-pointer relative" onClick={()=> window.location.href=`/mindmaps/${mm.id}` }>
                        <div className="p-4 h-32 flex flex-col justify-between bg-gradient-to-br from-purple-500/10 to-purple-800/10">
                          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-medium">Map</span>
                          <div>
                            <p className="font-medium truncate mb-1">{mm.title || 'Untitled Mindmap'}</p>
                            <p className="text-xs text-muted-foreground mb-2">{relativeTime(mm.createdAt)}</p>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="px-2 py-0.5 rounded-full bg-background/70 border border-border">{mm.status}</span>
                            {mm.language && <span className="opacity-70">{mm.language}</span>}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  const chat = item.ref as Chat
                  return (
                    <div key={`chat-${chat.id}`} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-green-500 transition-colors cursor-pointer relative" onClick={()=> window.location.href=`/chat/${chat.id}` }>
                      <div className="p-4 h-32 flex flex-col justify-between bg-gradient-to-br from-green-500/10 to-emerald-800/10">
                        <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Chat</span>
                        <div>
                          <p className="font-medium truncate mb-1">{chat.title || 'Chat'}</p>
                          <p className="text-xs text-muted-foreground mb-2">{relativeTime(chat.createdAt)}</p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          {Array.isArray(chat.contextDocIds) && chat.contextDocIds.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-background/70 border border-border">{chat.contextDocIds.length} docs</span>
                          ) : <span className="opacity-70">No context</span>}
                          {chat.language && <span className="opacity-70">{chat.language}</span>}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {combinedItems.length === 0 && (
                  <div className="col-span-full text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">No items yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }