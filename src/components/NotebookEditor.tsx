"use client"

import { useEffect, useState, useRef, useCallback } from 'react'
import { AIAssistant, FloatingToolbar, DocumentOutline } from './editor'
import EditorConfig from './editor/EditorConfig'
import LexicalToolbar from './editor/LexicalToolbar'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { FORMAT_TEXT_COMMAND, TextFormatType } from 'lexical'
import { TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $getSelection, $isRangeSelection, $createTextNode } from 'lexical'
import { $createLinkNode } from '@lexical/link'

// Extend window interface for editor handlers
declare global {
  interface Window {
    editorHandlers?: {
      handleLink: () => void
      handleFormatting: (format: string) => void
    }
  }
}

// Link handler component that can access editor context
function LinkHandler({ onLinkInserted }: { onLinkInserted: () => void }) {
  const [editor] = useLexicalComposerContext()

  const handleLink = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        const selectedText = selection.getTextContent()
        
        // Check if we already have selected text
        if (selectedText.trim().length > 0) {
          // If text is selected, prompt for URL and apply link
          const url = prompt('Enter URL:')
          if (url) {
            // Ensure URL has protocol
            const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, fullUrl)
            onLinkInserted()
          }
        } else {
          // If no text selected, prompt for both text and URL
          const linkText = prompt('Enter link text:')
          if (linkText) {
            const url = prompt('Enter URL:')
            if (url) {
              // Ensure URL has protocol
              const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
              
              // Create link node with text
              const linkNode = $createLinkNode(fullUrl)
              const textNode = $createTextNode(linkText)
              linkNode.append(textNode)
              
              // Insert the link node
              selection.insertNodes([linkNode])
              onLinkInserted()
            }
          }
        }
      }
    })
  }

  const handleFormatting = (format: string) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format as TextFormatType)
  }

  // Store handlers in a ref or context to be accessed by the parent
  useEffect(() => {
    // Make handlers available to parent component
    window.editorHandlers = {
      handleLink,
      handleFormatting
    }
  }, [handleLink, handleFormatting])

  return null
}

export default function NotebookEditor() {
  const [title, setTitle] = useState('Untitled Document')
  const [fontSize, setFontSize] = useState(12)
  const [fontFamily, setFontFamily] = useState('Clarika')
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 })
  const [showOutline, setShowOutline] = useState(false)
  const [aiPanelWidth, setAiPanelWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Handle text selection for floating toolbar
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        
        setToolbarPosition({
          x: rect.left + rect.width / 2,
          y: rect.bottom + 10
        })
        setShowToolbar(true)
      } else {
        setShowToolbar(false)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mouseup', handleSelectionChange)
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handleSelectionChange)
    }
  }, [])

  // Handle resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const containerWidth = window.innerWidth
    const newWidth = containerWidth - e.clientX
    
    // Set min and max constraints
    const minWidth = 300
    const maxWidth = containerWidth * 0.6
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setAiPanelWidth(newWidth)
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const handleFloatingLink = () => {
    if (window.editorHandlers) {
      window.editorHandlers.handleLink()
      setShowToolbar(false)
    }
  }

  const handleFloatingFormatting = (format: string) => {
    if (window.editorHandlers) {
      window.editorHandlers.handleFormatting(format)
    }
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-16 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-8">
          <span className="text-white font-bold text-sm">DOC</span>
        </div>
        
        {/* User Profile at bottom */}
        <div className="mt-auto">
          <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
            <span className="text-sidebar-accent-foreground text-xs">ND</span>
          </div>
        </div>
      </div>

      {/* Main Document Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Document Content */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Document Outline Panel */}
          <DocumentOutline 
            show={showOutline} 
            onClose={() => setShowOutline(false)} 
          />

          <div className="w-full px-8 py-4">
            <div className="mx-auto" style={{ maxWidth: 'min(100%, 1200px)' }}>
              <EditorConfig fontSize={fontSize} fontFamily={fontFamily}>
                <LinkHandler onLinkInserted={() => setShowToolbar(false)} />
                <LexicalToolbar
                  title={title}
                  onTitleChange={setTitle}
                  fontSize={fontSize}
                  onFontSizeChange={setFontSize}
                  fontFamily={fontFamily}
                  onFontFamilyChange={setFontFamily}
                />
              </EditorConfig>
            </div>
          </div>

          {/* Floating Toolbar */}
          <FloatingToolbar
            show={showToolbar}
            position={toolbarPosition}
            onFormatting={handleFloatingFormatting}
            onLink={handleFloatingLink}
            onAddComment={() => {}}
            onAskTurbo={() => {}}
          />
        </div>
      </div>

      {/* Resizable Divider */}
      <div 
        ref={resizeRef}
        className={`w-1 bg-gray-600 cursor-col-resize hover:bg-gray-500 transition-colors ${
          isDragging ? 'bg-purple-500' : ''
        }`}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
      >
        <div className="w-1 h-full flex items-center justify-center">
          <div className="w-0.5 h-8 bg-gray-400 rounded-full"></div>
        </div>
      </div>

      {/* Right Sidebar - AI Assistant */}
      <div 
        className="bg-gray-900 border-l border-gray-700 flex flex-col relative overflow-hidden"
        style={{ width: `${aiPanelWidth}px` }}
      >
        <AIAssistant />
      </div>
    </div>
  )
} 