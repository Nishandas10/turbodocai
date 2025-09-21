"use client"

import { useEffect, useState } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import NotebookEditor from '@/components/NotebookEditor'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'

export default function NotePage() {
  const search = useSearchParams()
  const params = useParams()
  const { user } = useAuth()
  const noteId = params?.noteId as string
  const ownerId = search.get('owner') || undefined
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      // If unauth, NotebookEditor will handle gating via layout; nothing to import here
      if (!user?.uid || !noteId) { setReady(true); return }
      // If no owner specified or it's already current user, nothing to import
      if (!ownerId || ownerId === user.uid) { setReady(true); return }

      try {
        // If doc already exists in current user's collection, skip import
        const myDocRef = doc(db, 'documents', user.uid, 'userDocuments', noteId)
        const mySnap = await getDoc(myDocRef)
        if (mySnap.exists()) { setReady(true); return }

        // Fetch mirror from public collection
        const mirrorId = `${ownerId}_${noteId}`
        const mirrorRef = doc(db, 'allDocuments', mirrorId)
        const mirrorSnap = await getDoc(mirrorRef)
        if (!mirrorSnap.exists()) {
          setError('Public document not found')
          setReady(true)
          return
        }
        // Mirror doc shape (subset)
        type MirrorMeta = {
          fileName?: string;
          mimeType?: string;
          storagePath?: string;
          downloadURL?: string;
        };
        type MirrorDoc = {
          title?: string;
          type?: string;
          tags?: unknown[];
          metadata?: MirrorMeta;
          masterUrl?: string;
          storagePath?: string;
          summary?: string;
          content?: { raw?: string; processed?: string };
        };
        const src = mirrorSnap.data() as MirrorDoc

        const title = src.title ?? 'Imported Document'
        const dtype = src.type ?? 'pdf'
        const meta = src.metadata ?? {}
        const fileName = meta.fileName ?? title ?? 'document'
        const mimeType = meta.mimeType
        const storagePath = meta.storagePath ?? src.storagePath
        const downloadURL = meta.downloadURL ?? src.masterUrl
        const tags = Array.isArray(src.tags)
          ? (src.tags.filter((t): t is string => typeof t === 'string'))
          : []

        // Prepare a lightweight copy into current user's workspace
        const now = Timestamp.now()
        const newDoc = {
          userId: user.uid,
          title,
          type: dtype,
          content: {
            raw: (src.content?.raw && typeof src.content.raw === 'string') ? src.content.raw : '',
            processed: (src.content?.processed && typeof src.content.processed === 'string') ? src.content.processed : ''
          },
          metadata: {
            fileName,
            mimeType,
            storagePath,
            downloadURL,
            sourceOwnerId: ownerId,
            sourceDocumentId: noteId,
          },
          tags,
          isPublic: false,
          status: 'uploading',
          processingStatus: 'pending',
          // If original had a summary, carry it over so UI has an immediate fallback
          ...(src.summary ? { summary: src.summary } : {}),
          createdAt: now,
          updatedAt: now,
          lastAccessed: now,
        }

        await setDoc(myDocRef, newDoc, { merge: false })
        // Cloud Function processDocument will pick this up (on create or storagePath change)
      } catch (e: unknown) {
        console.error('Import public document failed', e)
        const msg = e instanceof Error ? e.message : 'Failed to import public document'
        setError(msg)
      } finally {
        setReady(true)
      }
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

  if (error) {
    return (
      <div className="h-full bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      </div>
    )
  }

  return <NotebookEditor />
}