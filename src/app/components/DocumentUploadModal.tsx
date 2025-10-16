"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useEffect, useMemo } from "react"
import { ChevronDown, Cloud, FileText, Upload, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { uploadDocumentFile } from "@/lib/fileUploadService"
import { waitAndGenerateSummary } from "@/lib/ragService"
import { useRouter } from 'next/navigation'

export default function DocumentUploadModal(props: any) {
  const { isOpen, onClose, spaceId } = props as { isOpen: boolean; onClose: () => void; spaceId?: string }
  const [textContent, setTextContent] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number | null>(null)
  const [optimisticProgress, setOptimisticProgress] = useState<number>(0)
  const [optimisticTimerActive, setOptimisticTimerActive] = useState<boolean>(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const router = useRouter()
  const [generatedSummary, setGeneratedSummary] = useState<string>("")

  const handleSubmitText = () => {
    if (textContent.trim()) {
      console.log('Submitting text:', textContent)
      // TODO: Implement text submission logic
      onClose()
    }
  }

  const handleImportPDF = () => {
    fileInputRef.current?.click()
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      console.log('File selected:', file.name)
      // Reset progress/UI state on new file selection
      setProcessingProgress(null)
      setOptimisticProgress(0)
      setOptimisticTimerActive(false)
      setProcessingStatus("")
      setGeneratedSummary("")
    }
  }

  const handleFileSubmit = async () => {
    if (!selectedFile || !user?.uid) return

    setIsUploading(true)
    try {
      const result = await uploadDocumentFile(selectedFile, user.uid, {
        title: selectedFile.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        tags: ['uploaded'],
        ...(spaceId ? { spaceId } : {}),
      })

      if (result.success) {
        setUploadSuccess(true)
        setIsUploading(false)
        
  // Start processing status monitoring for PDFs and DOC/DOCX
  const isPdf = selectedFile.type === 'application/pdf' || /\.pdf$/i.test(selectedFile.name);
  const isDocx = /\.(docx|doc)$/i.test(selectedFile.name);
  if (isPdf || isDocx) {
          setIsProcessing(true)
          setProcessingStatus("Processing document...")
          // Start optimistic progress when processing starts
          setOptimisticProgress(0)
          setOptimisticTimerActive(true)
          
          try {
            const summary = await waitAndGenerateSummary(
              result.documentId!,
              user.uid,
              (status, progress) => {
                const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null
                setProcessingProgress(pct)
                // Show clean status text without inline percentage; percentage is displayed separately on the right
                setProcessingStatus(`Processing: ${status}`)
              },
              350
            )
            setGeneratedSummary(summary)
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
    }
  }, [isOpen])

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
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-2xl font-bold text-card-foreground">Upload text</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Text Input Section */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-3">
              Text
            </label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Enter or paste your text content here..."
              className="w-full h-48 p-4 bg-background border border-border rounded-lg resize-none text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Submit Text Button */}
            <Button 
              onClick={handleSubmitText}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-medium"
              disabled={!textContent.trim()}
            >
              <Cloud className="h-5 w-5 mr-3" />
              Submit text
            </Button>

            {/* Import PDF Button */}
            <Button 
              onClick={handleImportPDF}
              variant="outline"
              className="w-full bg-muted border-border text-card-foreground hover:bg-muted/80 py-4 text-lg font-medium"
              disabled={isUploading || isProcessing}
            >
              <FileText className="h-5 w-5 mr-3" />
              Import File
            </Button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

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
                      Upload File
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
                    {generatedSummary && (
                      <div className="mt-2 max-h-40 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap">
                        {generatedSummary}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 