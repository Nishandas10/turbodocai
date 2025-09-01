"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection } from 'lexical'
import { createPortal } from 'react-dom'

export default function CaseTools() {
  const [editor] = useLexicalComposerContext()
  const [showCaseDropdown, setShowCaseDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const caseDropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Check if click is outside both the button and any dropdown content
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        // Check if click is on dropdown content (which is now in portal)
        const dropdownElement = document.querySelector('[data-case-dropdown]')
        if (dropdownElement && !dropdownElement.contains(target)) {
          // Use setTimeout to allow other click handlers to execute first
          setTimeout(() => {
            setShowCaseDropdown(false)
          }, 0)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleCaseChange = (caseType: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const text = selection.getTextContent()
        let newText = text
        
        switch (caseType) {
          case 'uppercase':
            newText = text.toUpperCase()
            break
          case 'lowercase':
            newText = text.toLowerCase()
            break
          case 'capitalize':
            newText = text.replace(/\b\w/g, l => l.toUpperCase())
            break
          case 'sentence':
            newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
            break
        }
        
        if (newText !== text) {
          selection.insertText(newText)
        }
      }
    })
    setShowCaseDropdown(false)
  }

  const handleButtonClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
    setShowCaseDropdown(!showCaseDropdown)
  }

  return (
    <div className="relative" ref={caseDropdownRef}>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className="flex items-center space-x-1 px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
        title="Change Case"
      >
        <span className="text-sm font-medium">Aa</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {showCaseDropdown && createPortal(
        <div 
          className="fixed bg-background border border-border rounded-lg shadow-lg z-[9999] min-w-[140px]"
          style={{
            top: dropdownPosition.top + 4,
            left: dropdownPosition.left
          }}
          data-case-dropdown
        >
          <button onClick={() => handleCaseChange('uppercase')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <span>UPPERCASE</span>
          </button>
          <button onClick={() => handleCaseChange('lowercase')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <span>lowercase</span>
          </button>
          <button onClick={() => handleCaseChange('capitalize')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <span>Capitalize Each Word</span>
          </button>
          <button onClick={() => handleCaseChange('sentence')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <span>Sentence case</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
} 