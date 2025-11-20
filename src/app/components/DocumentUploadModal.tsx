"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useMemo } from "react"
import { ChevronDown, Upload, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { uploadDocumentFile } from "@/lib/fileUploadService"
import { waitAndGenerateSummary } from "@/lib/ragService"
import { useRouter } from 'next/navigation'
import { toast } from "@/components/ui/sonner"
import UpgradeModal from "@/components/UpgradeModal"
import { checkUploadAndChatPermission } from "@/lib/planLimits"

export default function DocumentUploadModal(props: any) {
  const { isOpen, onClose, spaceId } = props as { isOpen: boolean; onClose: () => void; spaceId?: string }
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingToastId, setProcessingToastId] = useState<string | number | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number | null>(null)
  const [optimisticProgress, setOptimisticProgress] = useState<number>(0)
  const [optimisticTimerActive, setOptimisticTimerActive] = useState<boolean>(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const router = useRouter()
  const [showUpgrade, setShowUpgrade] = useState(false)
  // Removed generated summary preview per user request
  const [showDocAlert, setShowDocAlert] = useState<boolean>(false)
  const [blockedDocName, setBlockedDocName] = useState<string>("")

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Block legacy .doc and .ppt files (not .docx/.pptx) and show guidance popup
      const isLegacyDoc = /\.doc$/i.test(file.name) && !/\.docx$/i.test(file.name)
      const isLegacyPpt = /\.ppt$/i.test(file.name) && !/\.pptx$/i.test(file.name)
      if (isLegacyDoc || isLegacyPpt) {
        setShowDocAlert(true)
        setBlockedDocName(file.name)
        // Clear the input so the same file can be re-selected after converting
        event.target.value = ""
        // Ensure no file is staged for upload
        setSelectedFile(null)
        return
      }
      setSelectedFile(file)
      console.log('File selected:', file.name)
      // Reset progress/UI state on new file selection
      setProcessingProgress(null)
      setOptimisticProgress(0)
      setOptimisticTimerActive(false)
      setProcessingStatus("")
  // summary preview removed
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      // Block legacy .doc and .ppt files (not .docx/.pptx) and show guidance popup
      const isLegacyDoc = /\.doc$/i.test(file.name) && !/\.docx$/i.test(file.name)
      const isLegacyPpt = /\.ppt$/i.test(file.name) && !/\.pptx$/i.test(file.name)
      if (isLegacyDoc || isLegacyPpt) {
        setShowDocAlert(true)
        setBlockedDocName(file.name)
        setSelectedFile(null)
        return
      }
      setSelectedFile(file)
      // Reset progress/UI state on new file selection
      setProcessingProgress(null)
      setOptimisticProgress(0)
      setOptimisticTimerActive(false)
      setProcessingStatus("")
  // summary preview removed
    }
  }

  const handleFileSubmit = async () => {
    if (!selectedFile || !user?.uid) return

    setIsUploading(true)
    try {
      const gate = await checkUploadAndChatPermission(user.uid)
      if (!gate.allowed) {
        setShowUpgrade(true)
        setIsUploading(false)
        return
      }
      const result = await uploadDocumentFile(selectedFile, user.uid, {
        title: selectedFile.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        tags: ['uploaded'],
        ...(spaceId ? { spaceId } : {}),
      })

      if (result.success) {
        setUploadSuccess(true)
        setIsUploading(false)
        
  // Start processing status monitoring for PDFs, DOCX, PPTX, and TXT
  const isPdf = selectedFile.type === 'application/pdf' || /\.pdf$/i.test(selectedFile.name);
  const isDocx = /\.(docx|doc)$/i.test(selectedFile.name) || /word/i.test(selectedFile.type);
  const isPptx = /\.(pptx)$/i.test(selectedFile.name) || /presentation/i.test(selectedFile.type);
  const isTxt = /\.txt$/i.test(selectedFile.name) || /text\/plain/i.test(selectedFile.type);
  if (isPdf || isDocx || isPptx || isTxt) {
          setIsProcessing(true)
          setProcessingStatus("Processing document...")
          // Start optimistic progress when processing starts
          setOptimisticProgress(0)
          setOptimisticTimerActive(true)
          const tid = toast.info(
            "Processing your document...\nLarger documents can take a bit longer — hang tight, it’s working its magic in the background!✨",
            { duration: 10000 }
          )
          setProcessingToastId(tid)
          
          try {
            await waitAndGenerateSummary(
              result.documentId!,
              user.uid,
              (status, progress) => {
                const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null
                setProcessingProgress(pct)
                setProcessingStatus(`Processing: ${status}`)
              },
              350
            )
            setProcessingProgress(100)
            setProcessingStatus("Processed! Redirecting...")
            setTimeout(() => {
              onClose()
              router.push(`/notes/${result.documentId}`)
            }, 1200)
          } catch (error) {
            console.error('Processing error:', error)
            setProcessingStatus("Processing failed or timed out")
            // Stop optimistic timer on failure
            setOptimisticTimerActive(false)
            setTimeout(() => {
              onClose()
            }, 2500)
          } finally {
            setIsProcessing(false)
            setOptimisticTimerActive(false)
            if (processingToastId) toast.dismiss(processingToastId)
          }
        } else {
          alert(`File uploaded successfully! Document ID: ${result.documentId}`)
          onClose()
        }
      } else {
        alert(`Upload failed: ${result.error}`)
        console.error('Upload failed:', result.error)
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
    } finally {
      if (!uploadSuccess) {
        setIsUploading(false)
      }
    }
  }

  // Cleanup when modal closes: reset progress state
  useEffect(() => {
    if (!isOpen) {
      setOptimisticTimerActive(false)
      setOptimisticProgress(0)
      setProcessingProgress(null)
      setProcessingStatus("")
      setShowDocAlert(false)
      setBlockedDocName("")
      setSelectedFile(null)
      if (processingToastId) toast.dismiss(processingToastId)
    }
  }, [isOpen, processingToastId])

  // Optimistic progress timer: smoothly advance up to 90% while processing
  useEffect(() => {
    if (!optimisticTimerActive) return
    let raf: number | null = null
    let start: number | null = null
    const cap = 90 // don't exceed 90% until backend/completion sets to 100

    const step = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      // Ease-out curve from 0 to cap over ~25s; remains slow near the end
      const duration = 25000
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3) // cubic ease-out
      const next = Math.min(cap, Math.round(eased * cap))
      setOptimisticProgress((prev) => (next > prev ? next : prev))
      if (next < cap && optimisticTimerActive) {
        raf = requestAnimationFrame(step)
      }
    }

    raf = requestAnimationFrame(step)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [optimisticTimerActive])

  // Compute display progress: prefer backend progress if available; else optimistic
  const displayProgress = useMemo(() => {
    if (typeof processingProgress === 'number') return Math.max(0, Math.min(100, processingProgress))
    return optimisticProgress
  }, [processingProgress, optimisticProgress])

  if (!isOpen) return null

  return (
    <>
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
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-2xl font-bold text-card-foreground">Upload file</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Drag and Drop Uploader */}
            {!selectedFile && (
              <div
                onClick={openFilePicker}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-600 bg-blue-600/5' : 'border-border hover:border-blue-600/60'}`}
                aria-label="File upload dropzone"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-card-foreground font-medium">Drag and drop your file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Supported: .pdf, .docx, .pptx, .txt</p>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* .doc file guidance popup */}
            {showDocAlert && (
              <div className="p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">
                      Legacy Office files (.doc or .ppt) cannot be processed. Please convert to .docx or .pptx and try again.
                    </p>
                    {blockedDocName && (
                      <p className="text-xs text-muted-foreground mt-1 break-all">
                        Blocked file: {blockedDocName}
                      </p>
                    )}
                    <p className="text-sm text-card-foreground mt-2">
                      You can convert your file using
                      {' '}
                      <a
                        href="https://cloudconvert.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-blue-600 hover:text-blue-700"
                      >
                        CloudConvert
                      </a>
                      . Once converted, upload the .docx file here.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <a
                        href="https://cloudconvert.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Open converter
                      </a>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDocAlert(false)}
                        className="border-border"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Show selected file if any */}
            {selectedFile && (
              <div className="p-3 bg-muted rounded-lg border border-border">
                <p className="text-sm text-card-foreground">
                  <span className="font-medium">Selected file:</span> {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button 
                  onClick={handleFileSubmit}
                  disabled={isUploading || isProcessing}
                  className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : uploadSuccess ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Success!
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload file
                    </>
                  )}
                </Button>
                
                {/* Processing status */}
                {(isProcessing || processingStatus) && (
                  <div className="mt-2 p-3 rounded-md border border-border bg-muted/40">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-card-foreground">{processingStatus}</p>
                      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(displayProgress)}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-[width] duration-300"
                        style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }}
                      />
                    </div>
                    {/* Summary preview removed */}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  )
} 