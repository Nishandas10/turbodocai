"use client"

import { useState, useRef } from "react"
import { X, Mic, Upload, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { uploadAudioFile } from "@/lib/fileUploadService"

interface AudioModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AudioModal({ isOpen, onClose }: AudioModalProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user } = useAuth()

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
      const result = await uploadAudioFile(audioFile, user.uid, {
        title: audioFile.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        tags: ['audio', 'uploaded']
      })

      if (result.success) {
        alert(`Audio uploaded successfully! Document ID: ${result.documentId}`)
        console.log('Audio upload successful:', result)
        setAudioFile(null) // Reset file selection
        onClose()
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
              isUploading ? 'pointer-events-none opacity-50' : ''
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
          </div>
        </div>
      </div>
    </div>
  )
} 