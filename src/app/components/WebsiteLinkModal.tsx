"use client"

import { useState } from "react"
import { X, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WebsiteLinkModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WebsiteLinkModal({ isOpen, onClose }: WebsiteLinkModalProps) {
  const [websiteLink, setWebsiteLink] = useState("")

  const handleGenerateNotes = () => {
    if (websiteLink.trim()) {
      console.log('Generating notes for website:', websiteLink)
      // TODO: Implement website processing logic
      onClose()
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
              placeholder="Paste a website URL"
              className="w-full p-4 bg-background border border-border rounded-lg text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
              autoFocus
            />
          </div>

          {/* Generate Notes Button */}
          <Button 
            onClick={handleGenerateNotes}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-medium"
            disabled={!websiteLink.trim()}
          >
            Generate Notes
          </Button>
        </div>
      </div>
    </div>
  )
} 