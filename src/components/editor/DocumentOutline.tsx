"use client"

interface DocumentOutlineProps {
  show: boolean
  onClose: () => void
}

export default function DocumentOutline({ show, onClose }: DocumentOutlineProps) {
  if (!show) return null

  return (
    <div className="mb-4 p-3 bg-muted rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-foreground">Document Outline</h3>
        <button 
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="text-sm text-muted-foreground">
        <p>• No headers found</p>
        <p>• Use &quot;/&quot; and select &quot;Header&quot; to create document structure</p>
      </div>
    </div>
  )
} 