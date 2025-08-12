"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_ELEMENT_COMMAND, ElementFormatType } from 'lexical'

export default function AlignmentTools() {
  const [editor] = useLexicalComposerContext()
  const [showAlignmentDropdown, setShowAlignmentDropdown] = useState(false)
  const [currentAlignment, setCurrentAlignment] = useState<ElementFormatType>('left')
  const alignmentDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (alignmentDropdownRef.current && !alignmentDropdownRef.current.contains(target)) {
        setShowAlignmentDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAlignment = (align: ElementFormatType) => {
    setCurrentAlignment(align)
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align)
    setShowAlignmentDropdown(false)
  }

  const getAlignmentIcon = (alignment: ElementFormatType) => {
    switch (alignment) {
      case 'center':
        return <AlignCenter className="h-4 w-4" />
      case 'right':
        return <AlignRight className="h-4 w-4" />
      case 'justify':
        return <AlignJustify className="h-4 w-4" />
      default:
        return <AlignLeft className="h-4 w-4" />
    }
  }

  const getAlignmentLabel = (alignment: ElementFormatType) => {
    switch (alignment) {
      case 'center':
        return 'Center Align'
      case 'right':
        return 'Right Align'
      case 'justify':
        return 'Justify'
      default:
        return 'Left Align'
    }
  }

  return (
    <div className="relative" ref={alignmentDropdownRef}>
      <button
        onClick={() => setShowAlignmentDropdown(!showAlignmentDropdown)}
        className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
        title="Text Alignment"
      >
        {getAlignmentIcon(currentAlignment)}
        <span className="text-sm">{getAlignmentLabel(currentAlignment)}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {showAlignmentDropdown && (
        <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[140px]">
          <button 
            onClick={() => handleAlignment('left')} 
            className={`w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm ${currentAlignment === 'left' ? 'bg-muted' : ''}`}
          >
            <AlignLeft className="h-4 w-4" />
            <span>Left Align</span>
          </button>
          <button 
            onClick={() => handleAlignment('center')} 
            className={`w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm ${currentAlignment === 'center' ? 'bg-muted' : ''}`}
          >
            <AlignCenter className="h-4 w-4" />
            <span>Center Align</span>
          </button>
          <button 
            onClick={() => handleAlignment('right')} 
            className={`w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm ${currentAlignment === 'right' ? 'bg-muted' : ''}`}
          >
            <AlignRight className="h-4 w-4" />
            <span>Right Align</span>
          </button>
          <button 
            onClick={() => handleAlignment('justify')} 
            className={`w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm ${currentAlignment === 'justify' ? 'bg-muted' : ''}`}
          >
            <AlignJustify className="h-4 w-4" />
            <span>Justify</span>
          </button>
        </div>
      )}
    </div>
  )
} 