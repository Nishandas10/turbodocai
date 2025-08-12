"use client"

import { useState, useRef, useEffect } from 'react'
import { Type, ChevronDown, Minus, Plus } from 'lucide-react'

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
  const fontDropdownRef = useRef<HTMLDivElement>(null)

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

  return (
    <>
      {/* Font Family Dropdown */}
      <div className="relative" ref={fontDropdownRef}>
        <button
          onClick={() => setShowFontDropdown(!showFontDropdown)}
          className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
        >
          <Type className="h-4 w-4" />
          <span className="text-sm">{fontFamily}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        
        {showFontDropdown && (
          <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[140px]">
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
          </div>
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