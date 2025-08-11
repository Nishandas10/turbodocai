"use client"

import { useState, useRef } from "react"
import { X, Mic, Upload, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface AudioModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AudioModal({ isOpen, onClose }: AudioModalProps) {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleRecordAudio = () => {
    onClose() // Close the modal first
    router.push('/dashboard/record') // Navigate to the record page
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setAudioFile(file)
      console.log('File selected:', file.name)
      // TODO: Implement file upload logic
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
      // TODO: Implement file upload logic
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
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
          <Button onClick={handleRecordAudio} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 text-lg font-medium" disabled={false}>
            <Mic className="h-5 w-5 mr-3" /> Record audio live <ChevronRight className="h-5 w-5 ml-3" />
          </Button>
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition-colors"
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden"/>
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-card-foreground text-sm">Drag .mp3 audio file here, or click to select</p>
            {audioFile && (<p className="text-blue-500 text-sm mt-2">Selected: {audioFile.name}</p>)}
          </div>
        </div>
      </div>
    </div>
  )
} 