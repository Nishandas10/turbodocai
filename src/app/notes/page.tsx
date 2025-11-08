"use client"

import { useState, useEffect, useMemo } from "react"
import { FileText, MoreVertical, Mic, Play, Lock, Unlock, Box, Globe } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import DashboardSidebar from "@/components/DashboardSidebar"
import { listenToUserDocuments, listenToUserSpaces, updateDocument, deleteDocument, listenToMindMaps, listenToUserChats } from "@/lib/firestore"
import type { Document as UserDoc, Space as SpaceType, MindMap, Chat } from "@/lib/types"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Image from 'next/image'
import Favicon from '@/components/Favicon'

export default function NotesPage() {
    const { user } = useAuth()
    const [documents, setDocuments] = useState<UserDoc[]>([])
    const [spaces, setSpaces] = useState<SpaceType[]>([])
    const [mindmaps, setMindmaps] = useState<MindMap[]>([])
    const [chats, setChats] = useState<Chat[]>([])

  type CombinedItem = { id: string; kind: 'document' | 'mindmap' | 'chat'; createdAtMs: number; ref: UserDoc | MindMap | Chat }

  const [filter, setFilter] = useState<'all' | 'document' | 'mindmap' | 'chat' | 'audio' | 'image' | 'website' | 'youtube'>('all')

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

    const filteredItems = useMemo(() => {
      if (filter === 'all') return combinedItems
      // top-level kinds
      if (['document','mindmap','chat'].includes(filter)) {
        return combinedItems.filter(i => i.kind === filter)
      }
      // document subtypes
      return combinedItems.filter(i => i.kind === 'document' && (i.ref as UserDoc).type === filter)
    }, [combinedItems, filter])

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
      const subtype = doc.type
      const mime = doc.metadata?.mimeType || ''
      const url = doc.metadata?.downloadURL || null
      // IMAGE
      if (subtype === 'image' && url) {
        return <Image src={url} alt={doc.title || 'image'} fill className="object-cover" />
      }
      // AUDIO
      if (subtype === 'audio' && url) {
        return (
          <div className="flex flex-col items-center justify-center w-full px-2">
            <Mic className="h-6 w-6 text-muted-foreground mb-2" />
            <audio controls preload="metadata" src={url} className="w-full h-8" />
          </div>
        )
      }
      // YOUTUBE
      if (subtype === 'youtube') {
  const ytUrl = doc.metadata?.url || ''
        const extractId = (u: string): string | null => {
          try {
            const m = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) || u.match(/embed\/([a-zA-Z0-9_-]{11})/)
            return m ? (m[1] || m[0]) : null
          } catch { return null }
        }
        const vid = extractId(ytUrl)
        const thumb = vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : null
        return thumb ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Image src={thumb} alt={doc.title || 'YouTube'} fill className="object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Play className="h-10 w-10 text-white drop-shadow" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <Play className="h-8 w-8 text-muted-foreground" />
            <p className="text-[10px] mt-1 opacity-70 px-2 text-center">YouTube video</p>
          </div>
        )
      }
      // WEBSITE
      if (subtype === 'website') {
  const rawUrl = doc.metadata?.url || ''
        let host = ''
        try { host = new URL(rawUrl).hostname.replace(/^www\./,'') } catch {}
        const snippet = (doc.summary || doc.content?.raw || '').slice(0, 120)
        return (
          <div className="flex flex-col items-center justify-center w-full h-full p-3 text-center">
            {host ? <Favicon host={host} className="h-7 w-7 mb-1 rounded" /> : <Globe className="h-7 w-7 text-muted-foreground mb-1" />}
            <p className="text-[10px] font-medium truncate w-full">{host || 'Website'}</p>
            {snippet && <p className="text-[10px] opacity-70 line-clamp-2">{snippet}</p>}
          </div>
        )
      }
      // Generic textual document
      if ((doc.summary || doc.content?.processed || doc.content?.raw)) {
        return (
          <div className="absolute inset-0 bg-background flex items-center justify-center p-3">
            <p className="text-xs text-foreground line-clamp-4 text-center leading-relaxed">
              {(doc.summary || doc.content?.processed || doc.content?.raw || '').substring(0, 200)}...
            </p>
          </div>
        )
      }
      // Fallback icon based on mime
      if (mime.startsWith('image/') && url) return <Image src={url} alt={doc.title || 'image'} fill className="object-cover" />
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
              {/* New document creation removed as requested */}
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-10">
              <div className="flex flex-col gap-3 mb-4 mt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">All Items</h2>
                  <span className="text-xs text-muted-foreground">{filteredItems.length} shown • {combinedItems.length} total</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['all','document','mindmap','chat','audio','image','website','youtube'] as const).map(f => (
                    <button
                      key={f}
                      onClick={()=> setFilter(f)}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${filter===f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}
                    >
                      {f === 'document' ? 'Docs' :
                       f === 'mindmap' ? 'Maps' :
                       f === 'chat' ? 'Chats' :
                       f === 'audio' ? 'Audio' :
                       f === 'image' ? 'Images' :
                       f === 'website' ? 'Web' :
                       f === 'youtube' ? 'YouTube' : 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredItems.map(item => {
                  if (item.kind === 'document') {
                    const note = item.ref as UserDoc
                    const subtype = note.type
                    const badgeLabel = subtype === 'audio' ? 'Audio' : subtype === 'image' ? 'Image' : subtype === 'website' ? 'Web' : subtype === 'youtube' ? 'YouTube' : 'Doc'
                    const badgeColor = subtype === 'audio' ? 'bg-rose-600' : subtype === 'image' ? 'bg-teal-600' : subtype === 'website' ? 'bg-indigo-600' : subtype === 'youtube' ? 'bg-red-600' : 'bg-blue-600'
                    return (
                      <div key={`doc-${note.id}`} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer relative">
                        <div className="relative h-32 bg-background flex items-center justify-center overflow-hidden" onClick={() => window.location.href = `/notes/${note.id}`}>        
                          <div className="absolute inset-0 bg-muted flex items-center justify-center">
                            {renderPreview(note)}
                          </div>
                          <span className="absolute left-3 bottom-3 text-xs bg-background/80 border border-border rounded-full px-2 py-0.5 max-w-[60%] truncate">{(note.spaceId && spaces.find(s=>s.id===note.spaceId)?.name) || 'No Space'}</span>
                          <span className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full ${badgeColor} text-white font-medium`}>{badgeLabel}</span>
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
                      <div key={`mm-${mm.id}`} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-purple-500 transition-colors cursor-pointer relative" >
                        {/* Preview area with content */}
                        <div className="relative h-32 bg-gradient-to-br from-purple-500/10 to-purple-800/10 flex items-center justify-center overflow-hidden" onClick={()=> window.location.href=`/mindmaps/${mm.id}` }>
                          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-medium">Map</span>
                          {/* Show mindmap prompt as preview content */}
                          <div className="p-3 text-center">
                            <p className="text-xs text-muted-foreground/80 line-clamp-3 break-words">
                              {mm.prompt || 'Mind map visualization'}
                            </p>
                          </div>
                        </div>
                        {/* Title and metadata area */}
                        <div className="p-4" onClick={()=> window.location.href=`/mindmaps/${mm.id}` }>
                          <p className="font-medium truncate mb-1">{mm.title || 'Untitled Mindmap'}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{relativeTime(mm.createdAt)}</span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full bg-background/70 border border-border text-[10px]">{mm.status}</span>
                              {mm.language && <span className="opacity-70 text-[10px]">{mm.language}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="absolute inset-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                                onClick={(e) => { e.stopPropagation() }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e)=> e.stopPropagation()} className="w-40">
                              <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); const title = prompt('Rename mindmap', mm.title || ''); if(title && title!==mm.title){ /* lazy import updateMindMap */ import('@/lib/firestore').then(m=> m.updateMindMap(mm.userId, mm.id, { title })).catch(console.error) } }}>Rename</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onSelect={(e)=>{ e.preventDefault(); if(confirm('Delete this mindmap?')){ import('@/lib/firestore').then(m=> m.deleteMindMap(mm.id)).catch(console.error) } }}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  }
                  const chat = item.ref as Chat
                  return (
                    <div key={`chat-${chat.id}`} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-green-500 transition-colors cursor-pointer relative">
                      {/* Preview area with chat context */}
                      <div className="relative h-32 bg-gradient-to-br from-green-500/10 to-emerald-800/10 flex items-center justify-center overflow-hidden" onClick={()=> window.location.href=`/chat/${chat.id}` }>
                        <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-green-600 text-white font-medium">Chat</span>
                        {/* Show chat preview with context info */}
                        <div className="p-3 text-center">
                          <div className="text-xs text-muted-foreground/80 space-y-1">
                            {Array.isArray(chat.contextDocIds) && chat.contextDocIds.length > 0 ? (
                              <>
                                <div className="flex items-center justify-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  <span>{chat.contextDocIds.length} document{chat.contextDocIds.length > 1 ? 's' : ''}</span>
                                </div>
                                <p className="text-[10px] opacity-70">Context-aware conversation</p>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center justify-center gap-1">
                                  <span>💬</span>
                                  <span>General chat</span>
                                </div>
                                <p className="text-[10px] opacity-70">Open conversation</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Title and metadata area */}
                      <div className="p-4" onClick={()=> window.location.href=`/chat/${chat.id}` }>
                        <p className="font-medium truncate mb-1">{chat.title || 'Chat'}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{relativeTime(chat.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            {Array.isArray(chat.contextDocIds) && chat.contextDocIds.length > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-background/70 border border-border text-[10px]">{chat.contextDocIds.length} docs</span>
                            ) : <span className="opacity-70 text-[10px]">No context</span>}
                            {chat.language && <span className="opacity-70 text-[10px]">{chat.language}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="absolute inset-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                              onClick={(e) => { e.stopPropagation() }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e)=> e.stopPropagation()} className="w-40">
                            <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); const title = prompt('Rename chat', chat.title || ''); if(title && title!==chat.title){ import('@/lib/firestore').then(m=> m.updateChat(chat.id, { title })).catch(console.error) } }}>Rename</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onSelect={(e)=>{ e.preventDefault(); if(confirm('Delete this chat?')){ import('@/lib/firestore').then(m=> m.deleteChat(chat.id)).catch(console.error) } }}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
                {filteredItems.length === 0 && (
                  <div className="col-span-full text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">No items yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }