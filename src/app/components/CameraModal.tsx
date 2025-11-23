"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { ChevronLeft, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { uploadCameraSnapshot, uploadImageFile } from "@/lib/fileUploadService"
import { waitAndGenerateSummary } from "@/lib/ragService"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import UpgradeModal from "@/components/UpgradeModal"
import { checkUploadAndChatPermission } from "@/lib/planLimits"

interface CameraModalProps {
  isOpen: boolean
  onClose?: () => void
}

export default function CameraModal({ isOpen, onClose }: CameraModalProps) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [processingProgress, setProcessingProgress] = useState<number | null>(null)
  const [optimisticProgress, setOptimisticProgress] = useState<number>(0)
  const [optimisticTimerActive, setOptimisticTimerActive] = useState<boolean>(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [processingToastId, setProcessingToastId] = useState<string | number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onCloseRef = useRef<(() => void) | undefined>(onClose)
  const { user } = useAuth()
  const router = useRouter()
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Keep latest onClose without forcing re-renders
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const openCamera = useCallback(async () => {
    try {
      // Prevent reopening if we already have an active stream
      if (streamRef.current && streamRef.current.active) {
        return
      }
      console.log('Requesting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera by default
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      console.log('Camera stream obtained:', stream)
      streamRef.current = stream
      setCameraStream(stream)
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Unable to access camera. Please check permissions.')
      try { onCloseRef.current?.() } catch {}
    }
  }, [])

  const closeCamera = useCallback(() => {
    const s = streamRef.current
    if (s) {
      s.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraStream(null)
    setCapturedImage(null)
  }, [])

  useEffect(() => {
    if (isOpen) {
      openCamera()
    } else {
      closeCamera()
    }
  }, [isOpen, openCamera, closeCamera])

  // Additional effect to ensure video element gets the stream
  useEffect(() => {
    const video = videoRef.current
    if (video && cameraStream) {
      if (video.srcObject !== cameraStream) {
        console.log('Setting video srcObject and playing...')
        video.srcObject = cameraStream
        // Calling play() can throw if another set happens; guard and ignore AbortError
        video.play().catch((err) => {
          if (err?.name !== 'AbortError') console.error(err)
        })
      }
    }
  }, [cameraStream])

  const captureImage = () => {
    if (cameraStream && videoRef.current) {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL('image/jpeg')
        setCapturedImage(imageData)
      }
    }
  }

  const handleClose = () => {
    closeCamera()
    onClose?.()
  }

  const retakePhoto = () => {
    setCapturedImage(null)
  }

  const handleUsePhoto = async () => {
    if (!capturedImage || !user?.uid) return

    setIsUploading(true)
    try {
      const gate = await checkUploadAndChatPermission(user.uid)
      if (!gate.allowed) {
        setShowUpgrade(true)
        setIsUploading(false)
        return
      }
      const result = await uploadCameraSnapshot(capturedImage, user.uid, {
        title: `Camera Snapshot ${new Date().toLocaleString()}`,
        tags: ['camera', 'snapshot']
      })

      if (result.success) {
        // Begin optimistic processing and redirect on completion
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
              handleClose()
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
          alert('Image uploaded but missing document id')
          handleClose()
        }
      } else {
        alert(`Upload failed: ${result.error}`)
        console.error('Photo upload failed:', result.error)
      }
    } catch (error) {
      console.error('Photo upload error:', error)
      alert('Photo upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // File upload handlers
  const handleFileClick = () => {
    if (!isUploading && !imageFile) fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f && f.type.startsWith('image/')) {
      setImageFile(f)
    }
  }

  const handleImageUpload = async () => {
    if (!imageFile || !user?.uid || isUploading) return
    setIsUploading(true)
    try {
      const gate = await checkUploadAndChatPermission(user.uid)
      if (!gate.allowed) {
        setShowUpgrade(true)
        setIsUploading(false)
        return
      }
      const result = await uploadImageFile(imageFile, user.uid, {
        title: imageFile.name.replace(/\.[^/.]+$/, ''),
        tags: ['image', 'uploaded']
      })
      if (result.success) {
        if (result.documentId) {
          setIsProcessing(true)
          setProcessingStatus('Processing: starting')
          setOptimisticProgress(0)
          setOptimisticTimerActive(true)
           // Show toast after 30 seconds, keep it visible for 2 minutes
          setTimeout(() => {
            const tid = toast.info(
              "Large images can take a bit longer. \n Hang tight, your images are processing in the background",
              { duration: 30000 } // 30 seconds (30,000 milliseconds)
            )
            setProcessingToastId(tid)
          }, 10000) // Wait 10 seconds before showing

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
              handleClose()
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
          alert('Image uploaded but missing document id')
          handleClose()
        }
      } else {
        alert(`Upload failed: ${result.error}`)
        console.error('Image upload failed:', result.error)
      }
    } catch (error) {
      console.error('Image upload error:', error)
      alert('Image upload failed. Please try again.')
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
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={(e) => {
        // Don't close if upgrade modal is showing
        if (showUpgrade) return
        // Only close if clicking the backdrop itself
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div 
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-semibold text-card-foreground">Camera</h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5 rotate-45" />
          </button>
        </div>

        {/* Camera Preview */}
        <div className="p-4">
          {!capturedImage ? (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-64 bg-black rounded-lg object-cover"
                autoPlay
                playsInline
                muted
                controls={false}
                style={{ transform: 'scaleX(-1)' }} // Mirror the camera view
                onLoadedMetadata={() => console.log('Video metadata loaded')}
                onCanPlay={() => console.log('Video can play')}
                onError={(e) => console.error('Video error:', e)}
              />
              {!cameraStream && (
                <div className="absolute inset-0 flex items-center justify-center bg-black rounded-lg">
                  <div className="text-white text-center">
                    <p>Initializing camera...</p>
                    <p className="text-sm text-gray-300 mt-2">Please wait</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                <button
                  onClick={captureImage}
                  disabled={!cameraStream}
                  className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 bg-blue-600 rounded-full border-4 border-white"></div>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capturedImage || ''}
                alt="Captured"
                className="w-full h-64 object-cover rounded-lg mb-4"
                loading="lazy"
              />
              <div className="flex space-x-3 justify-center">
                <Button 
                  onClick={retakePhoto}
                  variant="outline"
                  className="bg-muted border-border text-foreground hover:bg-muted/80"
                >
                  Retake
                </Button>
                <Button 
                  onClick={handleUsePhoto}
                  disabled={isUploading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Use Photo'
                  )}
                </Button>
              </div>
              {(isProcessing || processingStatus) && (
                <div className="mt-4 p-3 rounded-md border border-border bg-muted/40 text-left">
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
          )}
          {/* Upload from device */}
          <div className={`mt-4 border-2 border-dashed border-border rounded-lg p-6 text-center ${isUploading || isProcessing ? 'pointer-events-none opacity-50' : ''}`}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-card-foreground">Or upload an image from your device</p>
            {!imageFile ? (
              <Button onClick={handleFileClick} variant="outline" className="mt-3">
                Choose Image
              </Button>
            ) : (
              <div className="mt-3">
                <p className="text-blue-500 text-sm">Selected: {imageFile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">Size: {(imageFile.size / 1024 / 1024).toFixed(2)} MB</p>
                <Button onClick={handleImageUpload} disabled={isUploading} className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
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
        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      </div>
    </div>
  )
} 