"use client"

import { useState, useRef, useEffect } from 'react'
import { Type, ChevronDown, Minus, Plus } from 'lucide-react'
import { createPortal } from 'react-dom'

interface FontControlsProps {
  fontSize: number
  onFontSizeChange: (size: number) => void
  fontFamily: string
  onFontFamilyChange: (family: string) => void
}

export default function FontControls({
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange
}: FontControlsProps) {
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const fontDropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(target)) {
        setShowFontDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleButtonClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
    setShowFontDropdown(!showFontDropdown)
  }

  return (
    <>
      {/* Font Family Dropdown */}
      <div className="relative" ref={fontDropdownRef}>
        <button
          ref={buttonRef}
          onClick={handleButtonClick}
          className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
        >
          <Type className="h-4 w-4" />
          <span className="text-sm">{fontFamily}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        
        {showFontDropdown && createPortal(
          <div 
            className="fixed bg-background border border-border rounded-lg shadow-lg z-[9999] min-w-[140px]"
            style={{
              top: dropdownPosition.top + 4,
              left: dropdownPosition.left
            }}
          >
            {['Clarika', 'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'].map((font) => (
              <button
                key={font}
                onClick={() => { onFontFamilyChange(font); setShowFontDropdown(false); }}
                className="w-full text-left px-3 py-2 text-foreground hover:bg-muted text-sm"
                style={{ fontFamily: font }}
              >
                {font}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Font Size Controls */}
      <div className="flex items-center space-x-2">
        <button 
          onClick={() => onFontSizeChange(Math.max(8, fontSize - 1))}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="text-foreground text-sm min-w-[20px] text-center">{fontSize}</span>
        <button 
          onClick={() => onFontSizeChange(Math.min(72, fontSize + 1))}
          className="text-muted-foreground hover:text-foreground p-1"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </>
  )
} 