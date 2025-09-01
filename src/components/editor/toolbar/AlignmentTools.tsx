"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_ELEMENT_COMMAND, ElementFormatType } from 'lexical'
import { createPortal } from 'react-dom'

export default function AlignmentTools() {
  const [editor] = useLexicalComposerContext()
  const [showAlignmentDropdown, setShowAlignmentDropdown] = useState(false)
  const [currentAlignment, setCurrentAlignment] = useState<ElementFormatType>('left')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const alignmentDropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Check if click is outside both the button and any dropdown content
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        // Check if click is on dropdown content (which is now in portal)
        const dropdownElement = document.querySelector('[data-alignment-dropdown]')
        if (dropdownElement && !dropdownElement.contains(target)) {
          // Use setTimeout to allow other click handlers to execute first
          setTimeout(() => {
            setShowAlignmentDropdown(false)
          }, 0)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
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

  const handleButtonClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
    setShowAlignmentDropdown(!showAlignmentDropdown)
  }

  return (
    <div className="relative" ref={alignmentDropdownRef}>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
        title="Text Alignment"
      >
        {getAlignmentIcon(currentAlignment)}
        <span className="text-sm">{getAlignmentLabel(currentAlignment)}</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {showAlignmentDropdown && createPortal(
        <div 
          className="fixed bg-background border border-border rounded-lg shadow-lg z-[9999] min-w-[140px]"
          style={{
            top: dropdownPosition.top + 4,
            left: dropdownPosition.left
          }}
          data-alignment-dropdown
        >
          <button onClick={() => handleAlignment('left')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <AlignLeft className="h-4 w-4" />
            <span>Left Align</span>
          </button>
          <button onClick={() => handleAlignment('center')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <AlignCenter className="h-4 w-4" />
            <span>Center Align</span>
          </button>
          <button onClick={() => handleAlignment('right')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <AlignRight className="h-4 w-4" />
            <span>Right Align</span>
          </button>
          <button onClick={() => handleAlignment('justify')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <AlignJustify className="h-4 w-4" />
            <span>Justify</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
} 