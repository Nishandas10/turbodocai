"use client"

import { useState, useRef } from "react"
import { ChevronDown, Cloud, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DocumentUploadModal({ isOpen, onClose }: DocumentUploadModalProps) {
  const [textContent, setTextContent] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      // TODO: Implement file upload logic
    }
  }

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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 