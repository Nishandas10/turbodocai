"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState, useRef } from "react"
import { X, Play, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { createYouTubeDocument } from "@/lib/firestore"
import { waitAndGenerateSummary, getDocumentText } from "@/lib/ragService"
import { useRouter } from "next/navigation"

export default function YouTubeVideoModal(props: any) {
  const { isOpen, onClose, spaceId } = props as { isOpen: boolean; onClose: () => void; spaceId?: string }
  const [youtubeLink, setYoutubeLink] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number | null>(null)
  const [optimisticProgress, setOptimisticProgress] = useState<number>(0)
  const [optimisticTimerActive, setOptimisticTimerActive] = useState<boolean>(false)
  const [generatedSummary, setGeneratedSummary] = useState<string>("")
  const [transcriptPreview, setTranscriptPreview] = useState<string>("")
  const transcriptTimerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const { user } = useAuth()

  const isValidYouTubeUrl = (url: string) => {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[a-zA-Z0-9_-]+/;
    return regex.test(url);
  }

  const handleGenerateNotes = async () => {
    if (!youtubeLink.trim() || !user?.uid) return

    if (!isValidYouTubeUrl(youtubeLink)) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    setIsProcessing(true)
    try {
  const documentId = await createYouTubeDocument(user.uid, youtubeLink, undefined, spaceId)
      // Begin processing monitor like DocumentUploadModal
      setProcessingStatus("Processing video...")
      setOptimisticProgress(0)
      setOptimisticTimerActive(true)
  startTranscriptPolling(documentId, user.uid)

      try {
        const summary = await waitAndGenerateSummary(
          documentId,
          user.uid,
          (status, progress) => {
            const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null
            setProcessingProgress(pct)
            setProcessingStatus(`Processing: ${status}`)
          },
          350
        )
        setGeneratedSummary(summary)
        setProcessingProgress(100)
        setProcessingStatus("Processed! Redirecting...")
        setYoutubeLink("")
        setTimeout(() => {
          onClose()
          router.push(`/notes/${documentId}`)
        }, 1200)
      } catch (e) {
        console.error('YouTube processing error:', e)
        setProcessingStatus("Processing failed or timed out")
        setOptimisticTimerActive(false)
      } finally {
        setIsProcessing(false)
        setOptimisticTimerActive(false)
      }
    } catch (error) {
      console.error('Error saving YouTube video:', error)
      setProcessingStatus('Failed to save YouTube video. Please try again.')
    } finally {
      // keep spinner states controlled by processing monitor
    }
  }

  // Start transcript polling after doc creation to show transcript as soon as it's available
  const startTranscriptPolling = (docId: string, userId: string) => {
    if (transcriptTimerRef.current) clearInterval(transcriptTimerRef.current as any)
    transcriptTimerRef.current = setInterval(async () => {
      try {
        const res = await getDocumentText({ documentId: docId, userId, limitChars: 8000 })
        const text = (res?.text || "").trim()
        if (text && text.length > 40) {
          setTranscriptPreview(text)
          // if we have a long transcript already, we can slow down polling
        }
      } catch {
        // ignore until available
      }
    }, 2500)
  }

  // Cleanup when modal closes: reset progress state
  useEffect(() => {
    if (!isOpen) {
      setOptimisticTimerActive(false)
      setOptimisticProgress(0)
      setProcessingProgress(null)
      setProcessingStatus("")
      setGeneratedSummary("")
      setTranscriptPreview("")
      if (transcriptTimerRef.current) {
        clearInterval(transcriptTimerRef.current as any)
        transcriptTimerRef.current = null
      }
      setYoutubeLink("")
    }
  }, [isOpen])

  // Optimistic progress timer similar to DocumentUploadModal
  useEffect(() => {
    if (!optimisticTimerActive) return
    let raf: number | null = null
    let start: number | null = null
    const cap = 90
    const step = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      const duration = 22000
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.min(cap, Math.round(eased * cap))
      setOptimisticProgress((prev) => (next > prev ? next : prev))
      if (next < cap && optimisticTimerActive) {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [optimisticTimerActive])

  const displayProgress = useMemo(() => {
    if (typeof processingProgress === 'number') return Math.max(0, Math.min(100, processingProgress))
    return optimisticProgress
  }, [processingProgress, optimisticProgress])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
  onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 text-center relative">
          <button
    onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
            disabled={isProcessing}
          >
            <X className="h-5 w-5" />
          </button>
          
          {/* YouTube Icon */}
          <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Play className="h-8 w-8 text-white" />
          </div>
          
          {/* Title */}
          <h2 className="text-xl font-semibold text-card-foreground mb-6">
            YouTube video
          </h2>
        </div>

        {/* Modal Content */}
        <div className="px-6 pb-6 space-y-4">
          {/* YouTube Link Input */}
          <div>
            <input
              type="text"
              value={youtubeLink}
              onChange={(e) => setYoutubeLink(e.target.value)}
              placeholder="Paste a YouTube link (e.g., https://youtube.com/watch?v=...)"
              className="w-full p-4 bg-background border border-border rounded-lg text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
              autoFocus
              disabled={isProcessing}
            />
          </div>

          {/* Save & Process Button */}
          <Button 
            onClick={handleGenerateNotes}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!youtubeLink.trim() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Save & Process"
            )}
          </Button>

          {/* Processing status/progress */}
          {(isProcessing || processingStatus) && (
            <div className="mt-3 p-3 rounded-md border border-border bg-muted/40">
              <div className="flex items-center justify-between">
                <p className="text-sm text-card-foreground">{processingStatus || 'Processing video...'}</p>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(displayProgress)}%</span>
              </div>
              <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-purple-600 transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }}
                />
              </div>
              {transcriptPreview && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-card-foreground mb-1">Transcript (live)</p>
                  <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap border border-border rounded p-2 bg-background/60">
                    {transcriptPreview}
                  </div>
                </div>
              )}
              {generatedSummary && (
                <div className="mt-2 max-h-36 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap">
                  {generatedSummary}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 