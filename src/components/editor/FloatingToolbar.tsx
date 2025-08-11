"use client"

import { 
  Link, 
  MessageSquare, 
  Star 
} from 'lucide-react'

interface FloatingToolbarProps {
  show: boolean
  position: { x: number; y: number }
  onFormatting: (format: string) => void
  onAddComment: () => void
  onAskTurbo: () => void
}

export default function FloatingToolbar({
  show,
  position,
  onFormatting,
  onAddComment,
  onAskTurbo
}: FloatingToolbarProps) {
  if (!show) return null

  return (
    <div 
      className="fixed z-50 bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex items-center space-x-2 p-2"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)'
      }}
    >
      <button 
        onClick={() => onFormatting('bold')}
        className="w-8 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center justify-center text-sm font-bold transition-colors"
        title="Bold"
      >
        B
      </button>
      <button 
        onClick={() => onFormatting('italic')}
        className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center text-sm italic transition-colors"
        title="Italic"
      >
        I
      </button>
      <button 
        onClick={() => onFormatting('underline')}
        className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center text-sm underline transition-colors"
        title="Underline"
      >
        U
      </button>
      <button 
        className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center transition-colors"
        title="Link"
      >
        <Link className="h-4 w-4" />
      </button>
      <button 
        onClick={onAddComment}
        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm flex items-center space-x-1 transition-colors"
        title="Add Comment"
      >
        <MessageSquare className="h-3 w-3" />
        <span>Add comment</span>
      </button>
      <button 
        onClick={onAskTurbo}
        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm flex items-center space-x-1 transition-colors"
        title="Ask Turbo"
      >
        <Star className="h-3 w-3" />
        <span>Ask Turbo</span>
      </button>
    </div>
  )
} 