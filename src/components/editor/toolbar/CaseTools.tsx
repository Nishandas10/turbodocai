"use client"

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection } from 'lexical'

export default function CaseTools() {
  const [editor] = useLexicalComposerContext()
  const [showCaseDropdown, setShowCaseDropdown] = useState(false)
  const caseDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (caseDropdownRef.current && !caseDropdownRef.current.contains(target)) {
        setShowCaseDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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

  return (
    <div className="relative" ref={caseDropdownRef}>
      <button
        onClick={() => setShowCaseDropdown(!showCaseDropdown)}
        className="flex items-center space-x-1 px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
        title="Change Case"
      >
        <span className="text-sm font-medium">Aa</span>
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {showCaseDropdown && (
        <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[140px]">
          <button onClick={() => handleCaseChange('uppercase')} className="w-full text-left px-3 py-2 text-foreground hover:bg-muted text-sm">UPPERCASE</button>
          <button onClick={() => handleCaseChange('lowercase')} className="w-full text-left px-3 py-2 text-foreground hover:bg-muted text-sm">lowercase</button>
          <button onClick={() => handleCaseChange('capitalize')} className="w-full text-left px-3 py-2 text-foreground hover:bg-muted text-sm">Capitalize First Word</button>
          <button onClick={() => handleCaseChange('sentence')} className="w-full text-left px-3 py-2 text-foreground hover:bg-muted text-sm">Sentence case</button>
        </div>
      )}
    </div>
  )
} 