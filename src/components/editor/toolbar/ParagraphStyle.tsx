"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Heading1, Heading2, Heading3, Quote, Code } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_ELEMENT_COMMAND, ElementFormatType } from 'lexical'

export default function ParagraphStyle() {
  const [editor] = useLexicalComposerContext()
  const [showParagraphDropdown, setShowParagraphDropdown] = useState(false)
  const paragraphDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (paragraphDropdownRef.current && !paragraphDropdownRef.current.contains(target)) {
        setShowParagraphDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleParagraphStyle = (style: string) => {
    // For now, use basic formatting commands
    if (style === 'h1' || style === 'h2' || style === 'h3') {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left' as ElementFormatType)
    }
    setShowParagraphDropdown(false)
  }

  return (
    <div className="relative" ref={paragraphDropdownRef}>
      <button
        onClick={() => setShowParagraphDropdown(!showParagraphDropdown)}
        className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="text-sm">Normal</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {showParagraphDropdown && (
        <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[160px]">
          <button onClick={() => handleParagraphStyle('normal')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Normal</span>
          </button>
          <button onClick={() => handleParagraphStyle('h1')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading1 className="h-4 w-4" />
            <span>Heading 1</span>
          </button>
          <button onClick={() => handleParagraphStyle('h2')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading2 className="h-4 w-4" />
            <span>Heading 2</span>
          </button>
          <button onClick={() => handleParagraphStyle('h3')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Heading3 className="h-4 w-4" />
            <span>Heading 3</span>
          </button>
          <button onClick={() => handleParagraphStyle('quote')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Quote className="h-4 w-4" />
            <span>Quote</span>
          </button>
          <button onClick={() => handleParagraphStyle('code')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Code className="h-4 w-4" />
            <span>Code</span>
          </button>
        </div>
      )}
    </div>
  )
} 