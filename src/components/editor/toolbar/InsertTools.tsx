"use client"

import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronDown, Grid3X3, List, Quote, Code, Image, Minus } from 'lucide-react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { INSERT_TABLE_COMMAND } from '@lexical/table'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import { $createQuoteNode } from '@lexical/rich-text'
import { $createCodeNode } from '@lexical/code'
import { $getSelection, $isRangeSelection, $createTextNode, $createParagraphNode, $getRoot } from 'lexical'
import { $createImageNode } from './ImageNode'
import { $createHorizontalRuleNode } from './HorizontalRuleNode'
import TablePicker from './TablePicker'

export default function InsertTools() {
  const [editor] = useLexicalComposerContext()
  const [showInsertDropdown, setShowInsertDropdown] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const insertDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (insertDropdownRef.current && !insertDropdownRef.current.contains(target)) {
        setShowInsertDropdown(false)
        setShowTablePicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string
        
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            // Create the ImageNode using our custom node
            const imageNode = $createImageNode({
              altText: file.name,
              src: imageUrl,
              maxWidth: 500,
            })
            
            // Insert the image node at the current selection
            selection.insertNodes([imageNode])
            
            // Move cursor after the image for better inline flow
            imageNode.selectNext(0, 0)
            
            console.log('Image node inserted:', file.name)
          } else {
            // No selection - insert at root level
            const root = $getRoot()
            const imageNode = $createImageNode({
              altText: file.name,
              src: imageUrl,
              maxWidth: 500,
            })
            
            root.append(imageNode)
            
            // Create a new paragraph after the image and position cursor there
            const paragraphNode = $createParagraphNode()
            imageNode.insertAfter(paragraphNode)
            
            // Position cursor at the beginning of the new paragraph
            paragraphNode.select(0, 0)
            
            console.log('Image node inserted at root:', file.name)
          }
        })
      }
      reader.readAsDataURL(file)
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setShowInsertDropdown(false)
  }

  const handleInsert = (type: string) => {
    switch (type) {
      case 'table':
        setShowTablePicker(true)
        return // Don't close dropdown yet
      case 'ordered-list':
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
        break
      case 'unordered-list':
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
        break
      case 'image':
        // Trigger file input
        fileInputRef.current?.click()
        return // Don't close dropdown yet, let handleImageUpload handle it
      case 'horizontal-rule':
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            const horizontalRuleNode = $createHorizontalRuleNode()
            selection.insertNodes([horizontalRuleNode])
            
            // Create a new paragraph after the horizontal rule and position cursor there
            const paragraphNode = $createParagraphNode()
            horizontalRuleNode.insertAfter(paragraphNode)
            
            // Position cursor at the beginning of the new paragraph
            paragraphNode.select(0, 0)
          } else {
            // No selection - insert at root level
            const root = $getRoot()
            const horizontalRuleNode = $createHorizontalRuleNode()
            root.append(horizontalRuleNode)
            
            // Create a new paragraph after the horizontal rule and position cursor there
            const paragraphNode = $createParagraphNode()
            horizontalRuleNode.insertAfter(paragraphNode)
            
            // Position cursor at the beginning of the new paragraph
            paragraphNode.select(0, 0)
          }
        })
        break
      case 'quote':
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            // Create a quote node with proper structure
            const quoteNode = $createQuoteNode()
            
            // If there's selected text, use it as quote content
            const selectedText = selection.getTextContent()
            const textContent = selectedText || 'Quote text here...'
            
            const textNode = $createTextNode(textContent)
            quoteNode.append(textNode)
            
            // Clear selection and insert the quote
            selection.removeText()
            selection.insertNodes([quoteNode])
            
            // Position cursor at the end of the quote text
            quoteNode.selectEnd()
          } else {
            // No selection - insert at root level
            const root = $getRoot()
            const quoteNode = $createQuoteNode()
            const textNode = $createTextNode('Quote text here...')
            quoteNode.append(textNode)
            root.append(quoteNode)
            
            // Position cursor at the end of the quote text
            quoteNode.selectEnd()
          }
        })
        break
      case 'code':
        editor.update(() => {
          const selection = $getSelection()
          if ($isRangeSelection(selection)) {
            // Create a code node with proper structure
            const codeNode = $createCodeNode('javascript')
            
            // If there's selected text, use it as code content
            const selectedText = selection.getTextContent()
            const textContent = selectedText || '// Code here...'
            
            const textNode = $createTextNode(textContent)
            codeNode.append(textNode)
            
            // Clear selection and insert the code block
            selection.removeText()
            selection.insertNodes([codeNode])
            
            // Position cursor at the end of the code text
            codeNode.selectEnd()
          } else {
            // No selection - insert at root level
            const root = $getRoot()
            const codeNode = $createCodeNode('javascript')
            const textNode = $createTextNode('// Code here...')
            codeNode.append(textNode)
            root.append(codeNode)
            
            // Position cursor at the end of the code text
            codeNode.selectEnd()
          }
        })
        break
    }
    setShowInsertDropdown(false)
  }

  const handleTableSelect = (rows: number, cols: number) => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { rows: rows.toString(), columns: cols.toString() })
    setShowInsertDropdown(false)
    setShowTablePicker(false)
  }

  return (
    <div className="relative" ref={insertDropdownRef}>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />
      
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
          <div className="relative">
            <button 
              onClick={() => handleInsert('table')} 
              className={`
                w-full flex items-center justify-between px-3 py-2 text-foreground hover:bg-muted text-sm
                ${showTablePicker ? 'bg-muted' : ''}
              `}
            >
              <div className="flex items-center space-x-3">
                <Grid3X3 className="h-4 w-4" />
                <span>Table</span>
              </div>
              <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
            </button>
            {showTablePicker && (
              <TablePicker onSelect={handleTableSelect} maxSize={20} />
            )}
          </div>
          <button onClick={() => handleInsert('image')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Image className="h-4 w-4" />
            <span>Image</span>
          </button>
          <button onClick={() => handleInsert('horizontal-rule')} className="w-full flex items-center space-x-3 px-3 py-2 text-foreground hover:bg-muted text-sm">
            <Minus className="h-4 w-4" />
            <span>Horizontal Rule</span>
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
  )
} 