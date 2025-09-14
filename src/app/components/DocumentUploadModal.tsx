"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef } from "react"
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
        
        // Start processing status monitoring for PDFs
        if (selectedFile.type === 'application/pdf') {
          setIsProcessing(true)
          setProcessingStatus("Processing document...")
          
          try {
            const summary = await waitAndGenerateSummary(
              result.documentId!,
              user.uid,
              (status, progress) => {
                setProcessingStatus(`Processing: ${status}${progress ? ` (${progress}%)` : ''}`)
              },
              350
            )
            setGeneratedSummary(summary)
            setProcessingStatus("Processed! Redirecting...")
            setTimeout(() => {
              onClose()
              router.push(`/notes/${result.documentId}`)
            }, 1200)
          } catch (error) {
            console.error('Processing error:', error)
            setProcessingStatus("Processing failed or timed out")
            setTimeout(() => {
              onClose()
            }, 2500)
          } finally {
            setIsProcessing(false)
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
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700">{processingStatus}</p>
                    {generatedSummary && (
                      <div className="mt-2 max-h-40 overflow-y-auto text-xs text-blue-800 whitespace-pre-wrap">
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