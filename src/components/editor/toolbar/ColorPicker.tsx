"use client"

import { useState, useRef, useEffect } from 'react'
import { Palette, ChevronDown } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getSelection, $isRangeSelection, $createTextNode, $isTextNode } from 'lexical'
import { createPortal } from 'react-dom'

export default function ColorPicker() {
  const [editor] = useLexicalComposerContext()
  const [showColorDropdown, setShowColorDropdown] = useState(false)
  const [currentTextColor, setCurrentTextColor] = useState('#000000')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const colorDropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Listen to editor changes to update current text color based on cursor position
  useEffect(() => {
    const updateColorFromCursor = () => {
      editor.getEditorState().read(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          // Get the color at cursor position
          let detectedColor = '#000000' // default black
          
          if (selection.isCollapsed()) {
            // Cursor is at a position - check the style
            const style = selection.style
            if (style) {
              const colorMatch = style.match(/color:\s*([^;]+)/)
              if (colorMatch) {
                detectedColor = colorMatch[1].trim()
              }
            }
          } else {
            // Text is selected - get color from first selected node
            const nodes = selection.getNodes()
            for (const node of nodes) {
              if ($isTextNode(node)) {
                const nodeStyle = node.getStyle()
                if (nodeStyle) {
                  const colorMatch = nodeStyle.match(/color:\s*([^;]+)/)
                  if (colorMatch) {
                    detectedColor = colorMatch[1].trim()
                    break
                  }
                }
              }
            }
          }
          
          // Convert rgb/rgba to hex if needed
          if (detectedColor.startsWith('rgb')) {
            detectedColor = rgbToHex(detectedColor)
          }
          
          setCurrentTextColor(detectedColor)
        }
      })
    }

    // Update color when selection changes
    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateColorFromCursor()
      })
    })

    // Initial color detection
    updateColorFromCursor()

    return removeListener
  }, [editor])

  // Helper function to convert rgb/rgba to hex
  const rgbToHex = (rgb: string): string => {
    const result = rgb.match(/\d+/g)
    if (result && result.length >= 3) {
      const r = parseInt(result[0])
      const g = parseInt(result[1])
      const b = parseInt(result[2])
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
    }
    return '#000000'
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      // Check if click is outside both the button and any dropdown content
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        // Check if click is on dropdown content (which is now in portal)
        const dropdownElement = document.querySelector('[data-color-dropdown]')
        if (dropdownElement && !dropdownElement.contains(target)) {
          // Use setTimeout to allow other click handlers to execute first
          setTimeout(() => {
            setShowColorDropdown(false)
          }, 0)
        }
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const handleTextColor = (color: string) => {
    setCurrentTextColor(color)
    
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        if (selection.isCollapsed()) {
          // No text selected - set the style for future typing
          selection.style = `color: ${color}`
        } else {
          // Text is selected - apply color to selected text
          const nodes = selection.getNodes()
          
          for (const node of nodes) {
            if ($isTextNode(node)) {
              // Check if this is a partial selection within a single node
              const isPartialSelection = selection.anchor.key === selection.focus.key && 
                                       (selection.anchor.offset !== 0 || selection.focus.offset !== node.getTextContentSize())
              
              if (isPartialSelection) {
                // Handle partial text selection within a node
                const textContent = node.getTextContent()
                const startOffset = Math.min(selection.anchor.offset, selection.focus.offset)
                const endOffset = Math.max(selection.anchor.offset, selection.focus.offset)
                
                const before = textContent.slice(0, startOffset)
                const selected = textContent.slice(startOffset, endOffset)
                const after = textContent.slice(endOffset)

                // Create new nodes
                const beforeNode = before ? $createTextNode(before) : null
                const selectedNode = $createTextNode(selected)
                selectedNode.setStyle(`color: ${color}`)
                const afterNode = after ? $createTextNode(after) : null

                // Replace the original node
                if (beforeNode) node.insertBefore(beforeNode)
                node.insertBefore(selectedNode)
                if (afterNode) node.insertBefore(afterNode)
                node.remove()
                
                // Set selection to the end of the colored text for future typing
                if (afterNode) {
                  afterNode.select(0, 0)
                } else {
                  selectedNode.selectEnd()
                }
              } else {
                // Full node selection - replace entire node
                const newNode = $createTextNode(node.getTextContent())
                newNode.setStyle(`color: ${color}`)
                node.replace(newNode)
                newNode.selectEnd()
              }
            }
          }
          
          // Set the style for future typing after the selection
          selection.style = `color: ${color}`
        }
      }
    })
    
    setShowColorDropdown(false)
  }

  const handleButtonClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      })
    }
    setShowColorDropdown(!showColorDropdown)
  }

  return (
    <div className="relative" ref={colorDropdownRef}>
      <button
        ref={buttonRef}
        onClick={handleButtonClick}
        className="flex items-center space-x-1 px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
        title="Text Color"
      >
        <Palette className="h-4 w-4" />
        <div 
          className="w-3 h-3 border border-gray-300 rounded-sm" 
          style={{ backgroundColor: currentTextColor }}
        />
        <ChevronDown className="h-3 w-3" />
      </button>
      
      {showColorDropdown && createPortal(
        <div 
          className="fixed bg-background border border-border rounded-lg shadow-lg z-[9999] min-w-[120px] p-2"
          style={{
            top: dropdownPosition.top + 4,
            left: dropdownPosition.left
          }}
          data-color-dropdown
        >
          <div className="grid grid-cols-6 gap-1 mb-3">
            {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#808080', '#C0C0C0', '#FFFFFF'].map((color) => (
              <button
                key={color}
                onClick={() => handleTextColor(color)}
                className={`w-6 h-6 rounded border ${currentTextColor === color ? 'ring-2 ring-blue-500' : 'border-border'}`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={currentTextColor}
              onChange={(e) => setCurrentTextColor(e.target.value)}
              placeholder="#000000"
              className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background text-foreground"
            />
            <button
              onClick={() => handleTextColor(currentTextColor)}
              className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Apply
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
} 