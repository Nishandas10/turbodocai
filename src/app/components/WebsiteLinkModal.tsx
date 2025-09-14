"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react"
import { X, Globe, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { createWebsiteDocument } from "@/lib/firestore"

export default function WebsiteLinkModal(props: any) {
  const { isOpen, onClose, spaceId } = props as { isOpen: boolean; onClose: () => void; spaceId?: string }
  const [websiteLink, setWebsiteLink] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const { user } = useAuth()

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
    if (!websiteLink.trim() || !user?.uid) return

    if (!isValidUrl(websiteLink)) {
      alert('Please enter a valid website URL');
      return;
    }

    setIsProcessing(true)
    try {
      const normalizedUrl = normalizeUrl(websiteLink)
  const documentId = await createWebsiteDocument(user.uid, normalizedUrl, undefined, spaceId)
      console.log('Website saved successfully:', documentId)
      alert(`Website saved successfully! Document ID: ${documentId}`)
      setWebsiteLink("") // Reset the input
      onClose()
    } catch (error) {
      console.error('Error saving website:', error)
      alert('Failed to save website. Please try again.')
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
                Saving Website...
              </>
            ) : (
              "Save Website"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
} 