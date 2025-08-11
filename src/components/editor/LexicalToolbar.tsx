/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Bold, 
  Italic, 
  Underline, 
  Palette, 
  Highlighter, 
  Link, 
  Grid3X3,
  ChevronDown,
  Minus,
  Plus,
  Star,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  Quote,
  Code,
  Heading1,
  Heading2,
  Heading3
} from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { 
  FORMAT_TEXT_COMMAND, 
  FORMAT_ELEMENT_COMMAND,
  ElementFormatType,
  $getSelection,
  $isRangeSelection,
  $createTextNode,
  $isTextNode,
} from 'lexical'
import { $createQuoteNode } from '@lexical/rich-text'
import { $createCodeNode } from '@lexical/code'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { $createLinkNode } from '@lexical/link'

interface LexicalToolbarProps {
  title: string
  onTitleChange: (title: string) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  fontFamily: string
  onFontFamilyChange: (family: string) => void
}

export default function LexicalToolbar({
  title,
  onTitleChange,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange
}: LexicalToolbarProps) {
  const [editor] = useLexicalComposerContext()
  const [showParagraphDropdown, setShowParagraphDropdown] = useState(false)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [showInsertDropdown, setShowInsertDropdown] = useState(false)
  const [showAlignmentDropdown, setShowAlignmentDropdown] = useState(false)
  const [showCaseDropdown, setShowCaseDropdown] = useState(false)
  const [showColorDropdown, setShowColorDropdown] = useState(false)
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false)
  const [highlightColor, setHighlightColor] = useState('#FFFF00')
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(100)
  const [lightness, setLightness] = useState(50)
  const [isDraggingSaturation, setIsDraggingSaturation] = useState(false)
  const [isDraggingHue, setIsDraggingHue] = useState(false)
  
  const paragraphDropdownRef = useRef<HTMLDivElement>(null)
  const fontDropdownRef = useRef<HTMLDivElement>(null)
  const insertDropdownRef = useRef<HTMLDivElement>(null)
  const alignmentDropdownRef = useRef<HTMLDivElement>(null)
  const caseDropdownRef = useRef<HTMLDivElement>(null)
  const colorDropdownRef = useRef<HTMLDivElement>(null)
  const highlightDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      
      if (paragraphDropdownRef.current && !paragraphDropdownRef.current.contains(target)) {
        setShowParagraphDropdown(false)
      }
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(target)) {
        setShowFontDropdown(false)
      }
      if (insertDropdownRef.current && !insertDropdownRef.current.contains(target)) {
        setShowInsertDropdown(false)
      }
      if (alignmentDropdownRef.current && !alignmentDropdownRef.current.contains(target)) {
        setShowAlignmentDropdown(false)
      }
      if (caseDropdownRef.current && !caseDropdownRef.current.contains(target)) {
        setShowCaseDropdown(false)
      }
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(target)) {
        setShowColorDropdown(false)
      }
      if (highlightDropdownRef.current && !highlightDropdownRef.current.contains(target)) {
        setShowHighlightDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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

  const handleFormatting = (format: 'bold' | 'italic' | 'underline') => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
  }

  const handleParagraphStyle = (style: string) => {
    // For now, use basic formatting commands
    if (style === 'h1' || style === 'h2' || style === 'h3') {
      editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left' as ElementFormatType)
    }
    setShowParagraphDropdown(false)
  }

  const handleAlignment = (align: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, align)
    setShowAlignmentDropdown(false)
  }

  const handleInsert = (type: string) => {
    switch (type) {
      case 'table':
        editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: '3', columns: '3' })
        break
      case 'ordered-list':
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        break
      case 'unordered-list':
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        break
      case 'quote':
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            const quoteNode = $createQuoteNode()
            const textNode = $createTextNode('Quote text here...')
            quoteNode.append(textNode)
            selection.insertNodes([quoteNode])
          }
        })
        break
      case 'code':
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            const codeNode = $createCodeNode('javascript')
            const textNode = $createTextNode('// Code here...')
            codeNode.append(textNode)
            selection.insertNodes([codeNode])
          }
        })
        break
    }
    setShowInsertDropdown(false)
  }

  const handleTextColor = (color: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const anchor = selection.anchor
        const focus = selection.focus
        const nodes = selection.getNodes()

        if (anchor.key === focus.key) {
          // Single node selection - split the text node
          const node = nodes[0]
          if ($isTextNode(node)) {
            const textContent = node.getTextContent()
            const before = textContent.slice(0, anchor.offset)
            const colored = textContent.slice(anchor.offset, focus.offset)
            const after = textContent.slice(focus.offset)

            // Create new text nodes for each part
            const beforeNode = before ? $createTextNode(before) : null
            const coloredNode = $createTextNode(colored)
            coloredNode.setStyle(`color: ${color}`)
            const afterNode = after ? $createTextNode(after) : null

            // Replace the original node with the split nodes
            if (beforeNode) {
              node.insertBefore(beforeNode)
            }
            node.insertBefore(coloredNode)
            if (afterNode) {
              node.insertBefore(afterNode)
            }
            
            // Remove the original node completely
            node.remove()
            
            // Position cursor after the colored text (without styling)
            if (afterNode) {
              afterNode.select(0, 0)
            } else {
              // Create a clean text node after the colored text for continuing to type
              const cleanNode = $createTextNode('')
              coloredNode.insertAfter(cleanNode)
              cleanNode.select(0, 0)
            }
          }
        } else {
          // Multiple node selection - apply to each selected text node
          let lastNode: any = null
          nodes.forEach((node) => {
            if ($isTextNode(node)) {
              const newNode = $createTextNode(node.getTextContent())
              newNode.setStyle(`color: ${color}`)
              node.replace(newNode)
              lastNode = newNode
            }
          })
          // Position cursor after the last styled node
          if (lastNode) {
            const cleanNode = $createTextNode('')
            lastNode.insertAfter(cleanNode)
            cleanNode.select(0, 0)
          }
        }
      }
    })
    setShowColorDropdown(false)
  }

  const handleHighlight = (color: string) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const anchor = selection.anchor
        const focus = selection.focus
        const nodes = selection.getNodes()

        if (anchor.key === focus.key) {
          // Single node selection - split the text node
          const node = nodes[0]
          if ($isTextNode(node)) {
            const textContent = node.getTextContent()
            const before = textContent.slice(0, anchor.offset)
            const highlighted = textContent.slice(anchor.offset, focus.offset)
            const after = textContent.slice(focus.offset)

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
            
            // Remove the original node completely
            node.remove()
            
            // Position cursor after the highlighted text (without styling)
            if (afterNode) {
              afterNode.select(0, 0)
            } else {
              // Create a clean text node after the highlighted text for continuing to type
              const cleanNode = $createTextNode('')
              highlightedNode.insertAfter(cleanNode)
              cleanNode.select(0, 0)
            }
          }
        } else {
          // Multiple node selection - apply to each selected text node
          let lastNode: any = null
          nodes.forEach((node) => {
            if ($isTextNode(node)) {
              const newNode = $createTextNode(node.getTextContent())
              newNode.setStyle(`background-color: ${color}`)
              node.replace(newNode)
              lastNode = newNode
            }
          })
          // Position cursor after the last styled node
          if (lastNode) {
            const cleanNode = $createTextNode('')
            lastNode.insertAfter(cleanNode)
            cleanNode.select(0, 0)
          }
        }
      }
    })
  }

  const handleLink = () => {
    const url = prompt('Enter URL:')
    if (url) {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          const selectedText = selection.getTextContent()
          const linkNode = $createLinkNode(url)
          const textNode = $createTextNode(selectedText || 'Link')
          linkNode.append(textNode)
          selection.insertNodes([linkNode])
        }
      })
    }
  }

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
    <>
      {/* Top Header Bar */}
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

      {/* Main Toolbar */}
      <div className="h-14 border-b border-border flex items-center px-6 space-x-4">
        {/* Paragraph Style Dropdown */}
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

        {/* Vertical Separator */}
        <div className="w-px h-6 bg-border"></div>

        {/* Text Formatting */}
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => handleFormatting('bold')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button 
            onClick={() => handleFormatting('italic')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button 
            onClick={() => handleFormatting('underline')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title="Underline (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </button>
        </div>

        {/* Link Button */}
        <button 
          onClick={handleLink}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
          title="Insert Link"
        >
          <Link className="h-4 w-4" />
        </button>

        {/* Text Color Dropdown */}
        <div className="relative" ref={colorDropdownRef}>
          <button
            onClick={() => setShowColorDropdown(!showColorDropdown)}
            className="flex items-center space-x-1 px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
            title="Text Color"
          >
            <Palette className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </button>
          
          {showColorDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[120px] p-2">
              <div className="grid grid-cols-6 gap-1">
                {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#800000', '#008000', '#000080', '#808000', '#800080', '#008080', '#808080', '#C0C0C0', '#FFFFFF'].map((color) => (
                  <button
                    key={color}
                    onClick={() => handleTextColor(color)}
                    className="w-6 h-6 rounded border border-border"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Highlighter */}
        <div className="relative" ref={highlightDropdownRef}>
          <button 
            onClick={() => setShowHighlightDropdown(!showHighlightDropdown)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
            title="Highlight Text"
          >
            <Highlighter className="h-4 w-4" />
          </button>
          
          {showHighlightDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[280px] p-4">
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
            </div>
          )}
        </div>

        {/* Case Change Dropdown */}
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
              <button onClick={() => handleCaseChange('capitalize')} className="w-full text-left px-3 py-2 text-foreground hover:bg-muted text-sm">Capitalize Each Word</button>
              <button onClick={() => handleCaseChange('sentence')} className="w-full text-left px-3 py-2 text-foreground hover:bg-muted text-sm">Sentence case</button>
            </div>
          )}
        </div>

        {/* Vertical Separator */}
        <div className="w-px h-6 bg-border"></div>

        {/* Insert Dropdown */}
        <div className="relative" ref={insertDropdownRef}>
          <button
            onClick={() => setShowInsertDropdown(!showInsertDropdown)}
            className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Insert</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          
          {showInsertDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[140px]">
              <button onClick={() => handleInsert('table')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
                <Grid3X3 className="h-4 w-4" />
                <span>Table</span>
              </button>
              <button onClick={() => handleInsert('ordered-list')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
                <List className="h-4 w-4" />
                <span>Numbered List</span>
              </button>
              <button onClick={() => handleInsert('unordered-list')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
                <List className="h-4 w-4" />
                <span>Bullet List</span>
              </button>
              <button onClick={() => handleInsert('quote')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
                <Quote className="h-4 w-4" />
                <span>Quote</span>
              </button>
              <button onClick={() => handleInsert('code')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
                <Code className="h-4 w-4" />
                <span>Code Block</span>
              </button>
            </div>
          )}
        </div>

        {/* Vertical Separator */}
        <div className="w-px h-6 bg-border"></div>

        {/* Alignment Dropdown */}
        <div className="relative" ref={alignmentDropdownRef}>
          <button
            onClick={() => setShowAlignmentDropdown(!showAlignmentDropdown)}
            className="flex items-center space-x-2 px-3 py-2 text-foreground hover:bg-muted rounded border border-border"
            title="Text Alignment"
          >
            <AlignLeft className="h-4 w-4" />
            <span className="text-sm">Left Align</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          
          {showAlignmentDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 min-w-[140px]">
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
            </div>
          )}
        </div>

        {/* Progress bar placeholder */}
        <div className="flex-1 mx-4">
          <div className="w-full bg-muted rounded-full h-1">
            <div className="bg-blue-600 h-1 rounded-full" style={{ width: '0%' }}></div>
          </div>
        </div>
      </div>
    </>
  )
} 