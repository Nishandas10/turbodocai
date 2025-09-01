"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { uploadCameraSnapshot } from "@/lib/fileUploadService"

interface CameraModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CameraModal({ isOpen, onClose }: CameraModalProps) {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (isOpen) {
      openCamera()
    } else {
      closeCamera()
    }
  }, [isOpen])

  // Additional effect to ensure video element gets the stream
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      console.log('Setting video srcObject and playing...')
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch(console.error)
    }
  }, [cameraStream])

  const openCamera = async () => {
    try {
      console.log('Requesting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera by default
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      })
      console.log('Camera stream obtained:', stream)
      setCameraStream(stream)
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Unable to access camera. Please check permissions.')
      onClose()
    }
  }

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

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
    }
    setCapturedImage(null)
  }

  const handleClose = () => {
    closeCamera()
    onClose()
  }

  const retakePhoto = () => {
    setCapturedImage(null)
  }

  const handleUsePhoto = async () => {
    if (!capturedImage || !user?.uid) return

    setIsUploading(true)
    try {
      const result = await uploadCameraSnapshot(capturedImage, user.uid, {
        title: `Camera Snapshot ${new Date().toLocaleString()}`,
        tags: ['camera', 'snapshot']
      })

      if (result.success) {
        alert(`Photo uploaded successfully! Document ID: ${result.documentId}`)
        console.log('Photo upload successful:', result)
        handleClose()
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
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
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="w-full h-64 object-cover rounded-lg mb-4"
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 