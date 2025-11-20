"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react"
import { X, Globe, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { createWebsiteDocument } from "@/lib/firestore"
import { waitAndGenerateSummary } from "@/lib/ragService"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import UpgradeModal from "@/components/UpgradeModal"
import { checkUploadAndChatPermission } from "@/lib/planLimits"

export default function WebsiteLinkModal(props: any) {
  const { isOpen, onClose, spaceId } = props as { isOpen: boolean; onClose: () => void; spaceId?: string }
  const [websiteLink, setWebsiteLink] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number | null>(null)
  const [optimisticProgress, setOptimisticProgress] = useState<number>(0)
  const [optimisticTimerActive, setOptimisticTimerActive] = useState<boolean>(false)
  const [displayedProgress, setDisplayedProgress] = useState<number>(0)
  const [processingToastId, setProcessingToastId] = useState<string | number | null>(null)
  const { user } = useAuth()
  const router = useRouter()
  const [showUpgrade, setShowUpgrade] = useState(false)

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      // Try adding https:// if missing
      try {
        new URL(`https://${url}`);
        return true;
      } catch {
        return false;
      }
    }
  }

  const normalizeUrl = (url: string) => {
    try {
      new URL(url);
      return url;
    } catch {
      return `https://${url}`;
    }
  }

  const handleGenerateNotes = async () => {
    // Early guard to prevent rapid double taps on mobile
    if (isProcessing) return
    if (!websiteLink.trim() || !user?.uid) return

    if (!isValidUrl(websiteLink)) {
      alert('Please enter a valid website URL');
      return;
    }

    // Lock UI before async calls
    setIsProcessing(true)

    // Plan/usage gate
    const gate = await checkUploadAndChatPermission(user.uid)
    if (!gate.allowed) {
      setShowUpgrade(true)
      setIsProcessing(false)
      return
    }
    try {
      const normalizedUrl = normalizeUrl(websiteLink)
      const documentId = await createWebsiteDocument(user.uid, normalizedUrl, undefined, spaceId)
      console.log('Website saved successfully:', documentId)

      // Start processing monitoring similar to document upload modal
      setProcessingStatus("Processing webpage...")
  setProcessingProgress(null)
  setOptimisticProgress(0)
  setDisplayedProgress(0)
  setOptimisticTimerActive(true)
      const tid = toast.info(
        "Processing your document...\nLarger documents can take a bit longer — hang tight, it’s working its magic in the background!✨",
        { duration: 10000 }
      )
      setProcessingToastId(tid)

      try {
        await waitAndGenerateSummary(
          documentId,
          user.uid,
          (status, progress) => {
            const isDone = status === 'completed' || status === 'ready'
            const raw = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null
            // Prevent regressions and premature 100: cap server progress at 95 until done
            const capped = typeof raw === 'number' && !isDone ? Math.min(95, raw) : raw
            setProcessingProgress(typeof capped === 'number' ? capped : null)
            setDisplayedProgress((prev) => {
              const candidate = typeof capped === 'number' ? capped : prev
              const withOptimistic = Math.max(candidate, optimisticProgress)
              const notDoneCap = isDone ? withOptimistic : Math.min(99, withOptimistic)
              return Math.max(prev, notDoneCap)
            })
            setProcessingStatus(`Processing: ${status}`)
          },
          350
        )
        setProcessingProgress(100)
        setDisplayedProgress(100)
        setProcessingStatus("Processed! Redirecting...")
        setTimeout(() => {
          onClose()
          router.push(`/notes/${documentId}`)
        }, 1200)
      } catch (e) {
        console.error('Website processing error:', e)
        setProcessingStatus("Processing failed or timed out")
        setOptimisticTimerActive(false)
        setTimeout(() => {
          onClose()
        }, 2000)
      } finally {
        setIsProcessing(false)
        setOptimisticTimerActive(false)
        if (processingToastId) toast.dismiss(processingToastId)
      }
    } catch (error) {
      console.error('Error saving website:', error)
      setProcessingStatus('Failed to save website. Please try again.')
      setIsProcessing(false)
    } finally {
      // isProcessing is stopped after wait/generation completes above (or in catch)
    }
  }

  // Cleanup when modal closes: reset progress state
  useEffect(() => {
    if (!isOpen) {
      setOptimisticTimerActive(false)
      setOptimisticProgress(0)
      setProcessingProgress(null)
      setDisplayedProgress(0)
      setProcessingStatus("")
      if (processingToastId) toast.dismiss(processingToastId)
    }
  }, [isOpen, processingToastId])

  // Optimistic progress timer: smoothly advance up to 90% while processing
  useEffect(() => {
    if (!optimisticTimerActive) return
    let raf: number | null = null
    let start: number | null = null
    const cap = 90
    const step = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      const duration = 25000
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.min(cap, Math.round(eased * cap))
      setOptimisticProgress((prev) => (next > prev ? next : prev))
      setDisplayedProgress((prev) => Math.max(prev, next))
      if (next < cap && optimisticTimerActive) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [optimisticTimerActive])

  // Keep displayedProgress in sync if backend reports a higher value (still monotonic)
  useEffect(() => {
    if (typeof processingProgress === 'number') {
      setDisplayedProgress((prev) => Math.max(prev, Math.min(99, processingProgress)))
    }
  }, [processingProgress])

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={(e) => {
        // Don't close if upgrade modal is showing
        if (showUpgrade) return
        // Only close if clicking the backdrop itself
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
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
          
          {/* Website Icon */}
          <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Globe className="h-8 w-8 text-white" />
          </div>
          
          {/* Title */}
          <h2 className="text-xl font-semibold text-card-foreground mb-6">
            Website link
          </h2>
        </div>

        {/* Modal Content */}
        <div className="px-6 pb-6 space-y-4">
          {/* Website Link Input */}
          <div>
            <input
              type="text"
              value={websiteLink}
              onChange={(e) => setWebsiteLink(e.target.value)}
              placeholder="Paste a website URL (e.g., https://example.com)"
              className="w-full p-4 bg-background border border-border rounded-lg text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
              autoFocus
              disabled={isProcessing}
            />
          </div>

          {/* Generate Notes Button */}
          <Button 
            onClick={handleGenerateNotes}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!websiteLink.trim() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              "Upload Website"
            )}
          </Button>

          {/* Processing status */}
          {(isProcessing || processingStatus) && (
            <div className="mt-3 p-3 rounded-md border border-border bg-muted/40">
              <div className="flex items-center justify-between">
                <p className="text-sm text-card-foreground">{processingStatus || 'Processing webpage...'}</p>
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(displayedProgress)}%</span>
              </div>
              <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, displayedProgress))}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </div>
    </div>
  )
} 