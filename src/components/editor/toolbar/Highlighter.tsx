"use client"

import { useState, useRef, useEffect } from 'react'
import { Highlighter as HighlighterIcon } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, $createTextNode, $isTextNode, TextNode } from 'lexical'
import { createPortal } from 'react-dom'

export default function TextHighlighter() {
  const [editor] = useLexicalComposerContext()
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false)
  const [highlightColor, setHighlightColor] = useState('#FFFF00')
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(100)
  const [lightness, setLightness] = useState(50)
  const [isDraggingSaturation, setIsDraggingSaturation] = useState(false)
  const [isDraggingHue, setIsDraggingHue] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  
  const highlightDropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Check if click is outside both the button and any dropdown content
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        // Check if click is on dropdown content (which is now in portal)
        const dropdownElement = document.querySelector('[data-highlight-dropdown]')
        if (dropdownElement && !dropdownElement.contains(target)) {
          // Use setTimeout to allow other click handlers to execute first
          setTimeout(() => {
            setShowHighlightDropdown(false)
          }, 0)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Global mouse move and up handlers for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSaturation) {
        const saturationArea = document.getElementById('saturation-area')
        if (saturationArea) {
          const rect = saturationArea.getBoundingClientRect()
          const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
          const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
          setSaturation(Math.round(x * 100))
          setLightness(Math.round((1 - y) * 100))
          const newColor = `hsl(${hue}, ${Math.round(x * 100)}%, ${Math.round((1 - y) * 100)}%)`
          setHighlightColor(newColor)
        }
      }
      if (isDraggingHue) {
        const hueSlider = document.getElementById('hue-slider')
        if (hueSlider) {
          const rect = hueSlider.getBoundingClientRect()
          const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
          const newHue = Math.round(x * 360)
          setHue(newHue)
          const newColor = `hsl(${newHue}, ${saturation}%, ${lightness}%)`
          setHighlightColor(newColor)
        }
      }
    }

    const handleMouseUp = () => {
      setIsDraggingSaturation(false)
      setIsDraggingHue(false)
    }

    if (isDraggingSaturation || isDraggingHue) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSaturation, isDraggingHue, hue, saturation, lightness])

  // Update HSL values when hex color changes
  useEffect(() => {
    if (highlightColor.startsWith('#')) {
      const hex = highlightColor.replace('#', '')
      const r = parseInt(hex.substr(0, 2), 16)
      const g = parseInt(hex.substr(2, 2), 16)
      const b = parseInt(hex.substr(4, 2), 16)
      
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const l = (max + min) / 2
      
      let h, s
      if (max === min) {
        h = s = 0
      } else {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break
          case g: h = (b - r) / d + 2; break
          case b: h = (r - g) / d + 4; break
          default: h = 0
        }
        h /= 6
      }
      
      setHue(Math.round(h * 360))
      setSaturation(Math.round(s * 100))
      setLightness(Math.round(l * 100))
    }
  }, [highlightColor])

  const handleHighlight = (color: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const anchor = selection.anchor
        const focus = selection.focus
        const nodes = selection.getNodes()

        if (anchor.key === focus.key && nodes.length === 1) {
          // Single node selection - split the text node
          const node = nodes[0]
          if ($isTextNode(node)) {
            const textContent = node.getTextContent()
            const startOffset = Math.min(anchor.offset, focus.offset)
            const endOffset = Math.max(anchor.offset, focus.offset)
            
            const before = textContent.slice(0, startOffset)
            const highlighted = textContent.slice(startOffset, endOffset)
            const after = textContent.slice(endOffset)

            // Create new text nodes for each part
            const beforeNode = before ? $createTextNode(before) : null
            const highlightedNode = $createTextNode(highlighted)
            highlightedNode.setStyle(`background-color: ${color}`)
            const afterNode = after ? $createTextNode(after) : null

            // Replace the original node with the split nodes
            if (beforeNode) {
              node.insertBefore(beforeNode)
            }
            node.insertBefore(highlightedNode)
            if (afterNode) {
              node.insertBefore(afterNode)
            }
            
            // Remove the original node content
            node.setTextContent('')
            
            // Position cursor after the highlighted text
            if (afterNode) {
              afterNode.select(0, 0)
            } else {
              highlightedNode.select(0, 0)
            }
          }
        } else {
          // Multiple node selection - apply to each selected text node
          let lastNode: TextNode | null = null
          for (const node of nodes) {
            if ($isTextNode(node)) {
              const newNode = $createTextNode(node.getTextContent())
              newNode.setStyle(`background-color: ${color}`)
              node.replace(newNode)
              lastNode = newNode
            }
          }
          // Position cursor after the last styled node
          if (lastNode) {
            lastNode.select(0, 0)
          }
        }
      }
    })
  }

  const handleButtonClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
    setShowHighlightDropdown(!showHighlightDropdown)
  }

  return (
    <div className="relative" ref={highlightDropdownRef}>
      <button 
        ref={buttonRef}
        onClick={handleButtonClick}
        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
        title="Highlight Text"
      >
        <HighlighterIcon className="h-4 w-4" />
      </button>
      
      {showHighlightDropdown && createPortal(
        <div 
          className="fixed bg-background border border-border rounded-lg shadow-lg z-[9999] min-w-[280px] p-4"
          style={{
            top: dropdownPosition.top + 4,
            left: dropdownPosition.left
          }}
          data-highlight-dropdown
        >
          {/* Hex Input */}
          <div className="mb-3">
            <label className="block text-xs text-muted-foreground mb-1">Hex</label>
            <input
              type="text"
              value={highlightColor}
              onChange={(e) => setHighlightColor(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
              placeholder="#ffffff"
            />
          </div>
          
          {/* Preset Color Swatches */}
          <div className="mb-3">
            <div className="grid grid-cols-8 gap-1">
              {['#FF0000', '#FF8000', '#FFFF00', '#8B4513', '#90EE90', '#006400', '#800080', '#4B0082', '#87CEEB', '#008080', '#98FB98', '#000000', '#404040', '#C0C0C0', '#FFFFFF'].map((color) => (
                <button
                  key={color}
                  onClick={() => setHighlightColor(color)}
                  className={`w-6 h-6 rounded border ${highlightColor === color ? 'ring-2 ring-blue-500' : 'border-border'}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
          
          {/* Main Color Selection Area */}
          <div className="mb-3">
            <div 
              id="saturation-area"
              className="w-full h-32 rounded border border-border relative cursor-crosshair"
              style={{
                background: `linear-gradient(to right, white, hsl(${hue}, 100%, 50%)), linear-gradient(to bottom, transparent, black)`
              }}
              onMouseDown={(e) => {
                setIsDraggingSaturation(true)
                const rect = e.currentTarget.getBoundingClientRect()
                const x = (e.clientX - rect.left) / rect.width
                const y = (e.clientY - rect.top) / rect.height
                setSaturation(Math.round(x * 100))
                setLightness(Math.round((1 - y) * 100))
                const newColor = `hsl(${hue}, ${Math.round(x * 100)}%, ${Math.round((1 - y) * 100)}%)`
                setHighlightColor(newColor)
              }}
            >
              <div 
                className="absolute w-3 h-3 bg-white rounded-full border-2 border-gray-800 shadow-lg"
                style={{
                  left: `${saturation}%`,
                  top: `${(1 - lightness / 100) * 100}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            </div>
          </div>
          
          {/* Hue Slider */}
          <div className="mb-3">
            <div 
              id="hue-slider"
              className="w-full h-4 rounded border border-border relative cursor-pointer"
              style={{
                background: 'linear-gradient(to right, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080, #ff0000)'
              }}
              onMouseDown={(e) => {
                setIsDraggingHue(true)
                const rect = e.currentTarget.getBoundingClientRect()
                const x = (e.clientX - rect.left) / rect.width
                const newHue = Math.round(x * 360)
                setHue(newHue)
                const newColor = `hsl(${newHue}, ${saturation}%, ${lightness}%)`
                setHighlightColor(newColor)
              }}
            >
              <div 
                className="absolute w-4 h-4 bg-white rounded-full border-2 border-gray-800 shadow-lg"
                style={{
                  left: `${(hue / 360) * 100}%`,
                  transform: 'translateX(-50%)'
                }}
              />
            </div>
          </div>
          
          {/* Current Color Preview */}
          <div className="mb-3 flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded border border-border"
              style={{ backgroundColor: highlightColor }}
            />
            <span className="text-sm text-foreground">{highlightColor}</span>
          </div>
          
          {/* Apply Button */}
          <button
            onClick={() => {
              handleHighlight(highlightColor)
              setShowHighlightDropdown(false)
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm"
          >
            Apply Highlight
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}