"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import NotebookEditor from '@/components/NotebookEditor'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export default function NotePage() {
  const search = useSearchParams()
  const params = useParams()
  const { user } = useAuth()
  const router = useRouter()
  const noteId = params?.noteId as string
  const ownerId = search.get('owner') || undefined
  const [ready, setReady] = useState(false)
  // no separate error state; use blocked modes
  const [blocked, setBlocked] = useState<null | 'no-access' | 'not-found'>(null)
  const [effOwner, setEffOwner] = useState<string | undefined>(ownerId)

  useEffect(() => {
    // Persist owner param per note so navigation back can restore it
    try {
      if (noteId && ownerId) {
        localStorage.setItem(`doc_owner_${noteId}`, ownerId)
        setEffOwner(ownerId)
      } else if (noteId && !ownerId) {
        const stored = localStorage.getItem(`doc_owner_${noteId}`) || undefined
        if (stored) {
          setEffOwner(stored)
          // Append owner back to URL to maintain consistent share link
          try { router.replace(`/notes/${noteId}?owner=${stored}`) } catch { /* ignore */ }
        }
      }
    } catch {/* ignore */}
  }, [noteId, ownerId, router])

  useEffect(() => {
    const run = async () => {
      // Ready immediately; NotebookEditor will handle permission and read-only behavior.
      if (!noteId) { setReady(true); return }
      // Resolve a target owner: query param -> stored -> current user
      const storedOwner = (() => { try { return localStorage.getItem(`doc_owner_${noteId}`) || undefined } catch { return undefined } })()
      const targetOwner = ownerId || storedOwner || user?.uid
      if (!targetOwner) {
        // Cannot resolve a target owner; if unauth, ask to sign in
        setBlocked('no-access')
        setReady(true)
        return
      }
      if (targetOwner) {
        try {
          const ref = doc(db, 'documents', targetOwner, 'userDocuments', noteId)
          const snap = await getDoc(ref)
          if (!snap.exists()) {
            setBlocked('not-found')
          }
        } catch (e) {
          const err = e as { code?: string; message?: string }
          const code = err?.code || err?.message || ''
          if (String(code).includes('permission') || String(code).includes('denied')) {
            setBlocked('no-access')
          } else {
            console.warn('Shared doc lookup failed', e)
          }
        }
      }
      setReady(true)
    }
    run()
  }, [user?.uid, noteId, ownerId])

  if (!ready) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Preparing your copy…</p>
        </div>
      </div>
    )
  }

  if (blocked) {
    const signedIn = !!user?.uid
    return (
      <div className="h-full bg-background relative">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-2xl font-semibold mb-2">Access denied</h2>
            <p className="text-sm text-muted-foreground mb-6">
              {blocked === 'not-found' ? 'This document does not exist or is no longer shared.' : 'You do not have access to this document.'}
            </p>
            <div className="flex items-center justify-end gap-2">
              {signedIn ? (
                <button onClick={() => router.push('/dashboard')} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Return to dashboard</button>
              ) : (
                <button onClick={() => router.push('/signup')} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">Go to signup</button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <NotebookEditor ownerId={effOwner || ownerId || undefined} />
}