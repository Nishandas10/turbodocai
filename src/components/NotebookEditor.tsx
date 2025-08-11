"use client"

import { useEffect, useState } from 'react'
import { AIAssistant, FloatingToolbar, DocumentOutline } from './editor'
import EditorConfig from './editor/EditorConfig'
import LexicalToolbar from './editor/LexicalToolbar'

export default function NotebookEditor() {
  const [title, setTitle] = useState('Untitled Document')
  const [fontSize, setFontSize] = useState(12)
  const [fontFamily, setFontFamily] = useState('Clarika')
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 })
  const [showOutline, setShowOutline] = useState(false)

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
      <div className="flex-1 flex flex-col">
        {/* Document Content */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Document Outline Panel */}
          <DocumentOutline 
            show={showOutline} 
            onClose={() => setShowOutline(false)} 
          />

          <div className="max-w-4xl mx-auto">
            <EditorConfig fontSize={fontSize} fontFamily={fontFamily}>
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

          {/* Floating Toolbar */}
          <FloatingToolbar
            show={showToolbar}
            position={toolbarPosition}
            onFormatting={() => {}}
            onAddComment={() => {}}
            onAskTurbo={() => {}}
          />
        </div>
      </div>

      {/* Right Sidebar - AI Assistant */}
      <AIAssistant />
    </div>
  )
} 