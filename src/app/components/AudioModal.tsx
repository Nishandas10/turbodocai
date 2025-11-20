"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useRef, useEffect, useMemo } from "react"
import { X, Mic, Upload, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { uploadAudioFile } from "@/lib/fileUploadService"
import { waitAndGenerateSummary } from "@/lib/ragService"
import { toast } from "@/components/ui/sonner"
import UpgradeModal from "@/components/UpgradeModal"
import { checkUploadAndChatPermission } from "@/lib/planLimits"

export default function AudioModal(props: any) {
  const { isOpen, onClose, spaceId } = props as { isOpen: boolean; onClose: () => void; spaceId?: string }
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingToastId, setProcessingToastId] = useState<string | number | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number | null>(null)
  const [optimisticProgress, setOptimisticProgress] = useState<number>(0)
  const [optimisticTimerActive, setOptimisticTimerActive] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user } = useAuth()
  const [showUpgrade, setShowUpgrade] = useState(false)

  const handleRecordAudio = () => {
    onClose() // Close the modal first
    router.push('/dashboard/record') // Navigate to the record page
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAudioFile(file)
      console.log('File selected:', file.name)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file && file.type.startsWith('audio/')) {
      setAudioFile(file)
      console.log('File dropped:', file.name)
    }
  }

  const handleUploadClick = (event: React.MouseEvent) => {
    // Only open file dialog if not uploading and no file selected
    if (!isUploading && !audioFile) {
      event.stopPropagation()
      fileInputRef.current?.click()
    }
  }

  const handleAudioSubmit = async (event: React.MouseEvent) => {
    event.stopPropagation() // Prevent event bubbling
    if (!audioFile || !user?.uid || isUploading) return

    setIsUploading(true)
    try {
      const gate = await checkUploadAndChatPermission(user.uid)
      if (!gate.allowed) {
        setShowUpgrade(true)
        setIsUploading(false)
        return
      }
      const result = await uploadAudioFile(audioFile, user.uid, {
        title: audioFile.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        tags: ['audio', 'uploaded'],
        ...(spaceId ? { spaceId } : {}),
      })

      if (result.success) {
        // Begin optimistic processing and wait for summary then redirect
        if (result.documentId) {
          setIsProcessing(true)
          setProcessingStatus('Processing: starting')
          setOptimisticProgress(0)
          setOptimisticTimerActive(true)
          const tid = toast.info(
            "Processing your document...\nLarger documents can take a bit longer — hang tight, it’s working its magic in the background!✨",
            { duration: 10000 }
          )
          setProcessingToastId(tid)
          try {
            await waitAndGenerateSummary(
              result.documentId,
              user.uid,
              (status, progress) => {
                const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null
                setProcessingProgress(pct)
                setProcessingStatus(`Processing: ${status}`)
              },
              350
            )
            setProcessingProgress(100)
            setProcessingStatus('Processed! Redirecting...')
            setTimeout(() => {
              onClose()
              router.push(`/notes/${result.documentId}`)
            }, 900)
          } catch (e) {
            console.error('Processing error:', e)
            setProcessingStatus('Processing failed or timed out')
            setOptimisticTimerActive(false)
          } finally {
            setIsProcessing(false)
            setOptimisticTimerActive(false)
            if (processingToastId) toast.dismiss(processingToastId)
          }
        } else {
          alert('Audio uploaded but missing document id')
          onClose()
        }
      } else {
        alert(`Upload failed: ${result.error}`)
        console.error('Audio upload failed:', result.error)
      }
    } catch (error) {
      console.error('Audio upload error:', error)
      alert('Audio upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // Optimistic progress timer: smoothly advance up to 90%
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
      if (next < cap && optimisticTimerActive) raf = requestAnimationFrame(step)
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
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
          <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mic className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-card-foreground mb-6">Record or upload audio</h2>
        </div>
        {/* Modal Content */}
        <div className="px-6 pb-6 space-y-4">
          <Button onClick={handleRecordAudio} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 text-lg font-medium" disabled={isUploading}>
            <Mic className="h-5 w-5 mr-3" /> Record audio live <ChevronRight className="h-5 w-5 ml-3" />
          </Button>
          <div
            className={`border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors ${
              isUploading || isProcessing ? 'pointer-events-none opacity-50' : ''
            }`}
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden"/>
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-card-foreground text-sm">Drag .mp3 audio file here, or click to select</p>
            {audioFile && (
              <div className="mt-3">
                <p className="text-blue-500 text-sm">Selected: {audioFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Size: {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button 
                  onClick={handleAudioSubmit}
                  disabled={isUploading}
                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Audio
                    </>
                  )}
                </Button>
              </div>
            )}
            {(isProcessing || processingStatus) && (
              <div className="mt-3 p-3 rounded-md border border-border bg-muted/40 text-left">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-card-foreground">{processingStatus}</p>
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(displayProgress)}%</span>
                </div>
                <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-blue-600 transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  )
} 