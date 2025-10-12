"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react'
import { X, Copy, Check, Lock, Loader2, Trash2, ChevronDown, Eye, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { db, functions } from '@/lib/firebase'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { addCollaborator, removeCollaborator, setPublicAccess, getShareInfo, type ShareInfo, type ShareRole } from '@/lib/firestore'

export default function ShareModal(props: any) {
  const { isOpen, onClose, documentId, ownerId } = props as { isOpen: boolean; onClose: () => void; documentId: string; ownerId?: string }
  const { user } = useAuth()
  const actualOwnerId = ownerId || user?.uid || ''
  const isOwner = user?.uid === actualOwnerId
  const [loading, setLoading] = useState(true)
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [invite, setInvite] = useState('')
  const [inviteRole, setInviteRole] = useState<ShareRole>('viewer')
  const [copied, setCopied] = useState(false)
  const [accessOpen, setAccessOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !actualOwnerId) return
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const info = await getShareInfo(documentId, actualOwnerId)
        if (active) setShareInfo(info)
      } catch (e) {
        console.error(e)
        if (active) setError('Failed to load sharing info')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [isOpen, documentId, actualOwnerId])

  const inviteDisabled = useMemo(() => !invite.trim() || !isOwner, [invite, isOwner])

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}/notes/${documentId}?owner=${actualOwnerId}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const resolveUserByEmail = async (email: string): Promise<string | null> => {
    try {
      const fn = httpsCallable(functions, 'resolveUserByEmail')
      const res: any = await fn({ email })
      if (res?.data?.success && res.data.data?.userId) return res.data.data.userId
      return null
    } catch {
      // fallback to public users collection if callable blocked
      const qy = query(collection(db, 'users'), where('email', '==', email))
      const snap = await getDocs(qy)
      if (snap.empty) return null
      return snap.docs[0].id
    }
  }

  const addInvite = async () => {
    if (inviteDisabled) return
    try {
      setError(null)
      const email = invite.trim().toLowerCase()
      const userId = await resolveUserByEmail(email)
      if (!userId) { setError('No user found with that email'); return }
      await addCollaborator(documentId, actualOwnerId, userId, inviteRole)
      const info = await getShareInfo(documentId, actualOwnerId)
      setShareInfo(info)
      setInvite('')
    } catch (e) {
      console.error(e)
      setError('Failed to add collaborator')
    }
  }

  const removeUser = async (uid: string) => {
    try {
      await removeCollaborator(documentId, actualOwnerId, uid)
      const info = await getShareInfo(documentId, actualOwnerId)
      setShareInfo(info)
    } catch (e) { console.error(e) }
  }

  const setGeneralAccess = async (mode: 'private' | 'viewer' | 'editor') => {
    if (!isOwner) return
    try {
      await setPublicAccess(documentId, actualOwnerId, {
        isPublic: mode !== 'private',
        publicCanEdit: mode === 'editor',
      })
      const info = await getShareInfo(documentId, actualOwnerId)
      setShareInfo(info)
    } catch (e) { console.error(e) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-xl rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Share document</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin"/> Loading…</div>
          ) : shareInfo ? (
            <>
              {/* Invite by email */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="Add people by email…"
                  className="flex-1 bg-background border border-border rounded px-3 py-2"
                  disabled={!isOwner}
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as ShareRole)}
                  className="bg-background border border-border rounded px-2"
                  disabled={!isOwner}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button onClick={addInvite} disabled={inviteDisabled} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">Add</button>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}

              {/* People with access */}
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-2">People with access</h4>
                <ul className="space-y-2">
                  <CollaboratorItem userId={actualOwnerId} roleLabel="Owner" removable={false} accent="owner" />
                  {(shareInfo.collaborators.viewers || []).map((uid) => (
                    <CollaboratorItem key={`v-${uid}`} userId={uid} roleLabel="Viewer" removable={isOwner} onRemove={() => removeUser(uid)} />
                  ))}
                  {(shareInfo.collaborators.editors || []).map((uid) => (
                    <CollaboratorItem key={`e-${uid}`} userId={uid} roleLabel="Editor" removable={isOwner} onRemove={() => removeUser(uid)} />
                  ))}
                </ul>
              </div>

              {/* General access */}
              <div className="mt-4 border-t border-border pt-3">
                <h4 className="text-sm font-medium mb-2">General Access</h4>
                <div className="flex items-center gap-3 relative">
                  <AccessDropdown
                    mode={!shareInfo.isPublic ? 'private' : shareInfo.publicCanEdit ? 'editor' : 'viewer'}
                    onChange={async (m) => { await setGeneralAccess(m); setAccessOpen(false) }}
                    disabled={!isOwner}
                    open={accessOpen}
                    setOpen={setAccessOpen}
                  />
                  <button onClick={copyLink} className="ml-auto px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2">
                    {copied ? (<><Check className="w-4 h-4"/> Copied</>) : (<><Copy className="w-4 h-4"/> Copy Link</>)}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No info available.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function AccessDropdown({ mode, onChange, disabled, open, setOpen }: { mode: 'private'|'viewer'|'editor'; onChange: (m:'private'|'viewer'|'editor')=>void; disabled?: boolean; open: boolean; setOpen: (v:boolean)=>void }) {
  const label = mode === 'private' ? 'Only collaborators with access' : mode === 'viewer' ? 'Anyone with the link can view' : 'Anyone with the link can edit'
  const icon = mode === 'private' ? <Lock className="w-4 h-4"/> : mode === 'viewer' ? <Eye className="w-4 h-4"/> : <Pencil className="w-4 h-4"/>
  return (
    <div className="relative">
      <button disabled={disabled} onClick={() => setOpen(!open)} className="px-3 py-2 rounded border border-border bg-background text-foreground flex items-center gap-2 disabled:opacity-50">
        <span className="text-green-500">{mode !== 'private' ? '●' : ''}</span>
        {icon}
        <span className="text-sm whitespace-nowrap">{label}</span>
        <ChevronDown className="w-4 h-4 opacity-70"/>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-[280px] bg-card border border-border rounded-md shadow-lg">
          <DropdownItem onClick={() => onChange('private')} active={mode==='private'} icon={<Lock className="w-4 h-4"/>} label="Only collaborators with access"/>
          <DropdownItem onClick={() => onChange('viewer')} active={mode==='viewer'} icon={<Eye className="w-4 h-4"/>} label="Anyone with the link can view"/>
          <DropdownItem onClick={() => onChange('editor')} active={mode==='editor'} icon={<Pencil className="w-4 h-4"/>} label="Anyone with the link can edit"/>
        </div>
      )}
    </div>
  )
}

function DropdownItem({ onClick, active, icon, label }: { onClick: () => void; active?: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted ${active ? 'bg-muted' : ''}`}>
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  )
}

function CollaboratorItem({ userId, roleLabel, removable, onRemove, accent }: { userId: string; roleLabel: string; removable: boolean; onRemove?: () => void; accent?: 'owner' }) {
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null)
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const ref = doc(db, 'users', userId)
        const snap = await getDoc(ref)
        if (active && snap.exists()) {
          const d = snap.data() as any
          setProfile({ name: d.displayName || d.email || userId, email: d.email || '' })
        } else if (active) {
          setProfile({ name: userId, email: '' })
        }
      } catch { if (active) setProfile({ name: userId, email: '' }) }
    })()
    return () => { active = false }
  }, [userId])
  const initial = (profile?.name || userId || 'U').trim().charAt(0).toUpperCase()
  return (
    <li className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-purple-400 text-white flex items-center justify-center text-sm font-semibold">{initial}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{profile?.name || userId}</p>
        {profile?.email && <p className="text-xs text-muted-foreground truncate">{profile.email}</p>}
      </div>
      <span className={`text-xs px-2 py-1 rounded ${accent==='owner' ? 'bg-purple-600 text-white' : 'bg-muted text-muted-foreground'}`}>{roleLabel}</span>
      {removable && (
        <button onClick={onRemove} className="ml-2 w-8 h-8 rounded hover:bg-muted flex items-center justify-center" title="Remove">
          <Trash2 className="w-4 h-4"/>
        </button>
      )}
    </li>
  )
}
