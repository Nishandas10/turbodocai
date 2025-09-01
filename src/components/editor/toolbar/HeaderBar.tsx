"use client"

import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'

interface HeaderBarProps {
  title: string
  onTitleChange: (title: string) => void
}

export default function HeaderBar({ title, onTitleChange }: HeaderBarProps) {
  return (
    <div className="h-16 border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center space-x-2">
        <span className="text-foreground">✏️</span>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="text-foreground bg-transparent border-none outline-none text-lg font-medium"
          placeholder="Untitled Document"
        />
      </div>
      
      <div className="flex items-center space-x-3">
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <Star className="h-4 w-4 mr-2" />
          Upgrade to Premium
        </Button>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white">
          <span className="mr-2">Share</span>
        </Button>
        <button className="text-muted-foreground hover:text-foreground p-2">
          <span>⋮</span>
        </button>
      </div>
    </div>
  )
} 