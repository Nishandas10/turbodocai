"use client"

import { useState } from "react"
import { X, Play, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { createYouTubeDocument } from "@/lib/firestore"

interface YouTubeVideoModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function YouTubeVideoModal({ isOpen, onClose }: YouTubeVideoModalProps) {
  const [youtubeLink, setYoutubeLink] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
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
      const documentId = await createYouTubeDocument(user.uid, youtubeLink)
      console.log('YouTube video saved successfully:', documentId)
      alert(`YouTube video saved successfully! Document ID: ${documentId}`)
      setYoutubeLink("") // Reset the input
      onClose()
    } catch (error) {
      console.error('Error saving YouTube video:', error)
      alert('Failed to save YouTube video. Please try again.')
    } finally {
      setIsProcessing(false)
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

          {/* Generate Notes Button */}
          <Button 
            onClick={handleGenerateNotes}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!youtubeLink.trim() || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving Video...
              </>
            ) : (
              "Save Video"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 