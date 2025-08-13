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
import Link from 'next/link'
import { ChevronLeft, Home, FileText, List, FolderPlus, Settings, Download, Share2, History, Search, SpellCheck, Eye, MessageSquare } from 'lucide-react'

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)

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
    if (!isDragging || aiCollapsed) return
    
    const containerWidth = window.innerWidth
    const newWidth = containerWidth - e.clientX
    
    // Set min and max constraints
    const minWidth = 300
    const maxWidth = containerWidth * 0.6
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setAiPanelWidth(newWidth)
    }
  }, [isDragging, aiCollapsed])

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
      <div className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'} flex flex-col h-full sticky top-0`}>
        <div 
          className="p-4 flex-1 overflow-y-auto" 
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none'
          }}
        >
          {/* App Name and Collapse Button */}
          <div className="flex items-center justify-between mb-8">
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex items-center space-x-2 hover:bg-sidebar-accent rounded-lg p-2 transition-colors cursor-pointer group"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-700 transition-colors flex-shrink-0">
                <span className="text-white font-bold text-sm">DOC</span>
              </div>
              {!sidebarCollapsed && <span className="text-sidebar-foreground font-semibold text-lg">Document Editor</span>}
            </button>
            <div className="text-sidebar-accent-foreground flex-shrink-0">
              <ChevronLeft className={`h-5 w-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-2 mb-8">
            <Link 
              href="/dashboard" 
              className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </Link>
            <div className="flex items-center space-x-3 px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sidebar-foreground">
              <FileText className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Document</span>}
            </div>
            <button 
              onClick={() => setShowOutline(!showOutline)}
              className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left"
            >
              <List className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Document Outline</span>}
            </button>
            <Link 
              href="/notes" 
              className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <FolderPlus className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>All Notes</span>}
            </Link>
            <Link 
              href="/settings" 
              className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </Link>
          </nav>

          {/* Document Actions */}
          {!sidebarCollapsed && (
            <div className="mb-8">
              <h3 className="text-sidebar-accent-foreground text-sm font-medium mb-3">Document Actions</h3>
              <div className="space-y-2">
                <button className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
                <button className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left">
                  <Share2 className="h-4 w-4" />
                  <span>Share</span>
                </button>
                <button className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left">
                  <History className="h-4 w-4" />
                  <span>Version History</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Tools */}
          {!sidebarCollapsed && (
            <div className="mb-8">
              <h3 className="text-sidebar-accent-foreground text-sm font-medium mb-3">Quick Tools</h3>
              <div className="space-y-2">
                <button className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left">
                  <Search className="h-4 w-4" />
                  <span>Find & Replace</span>
                </button>
                <button className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left">
                  <SpellCheck className="h-4 w-4" />
                  <span>Spell Check</span>
                </button>
                <button className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left">
                  <Eye className="h-4 w-4" />
                  <span>Preview</span>
                </button>
              </div>
            </div>
          )}

          {/* AI Assistant Toggle */}
          <div className="mb-8">
            <button 
              onClick={() => setAiCollapsed(!aiCollapsed)}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                !aiCollapsed 
                  ? 'bg-blue-600 text-white' 
                  : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <MessageSquare className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{aiCollapsed ? 'Show AI' : 'Hide AI'}</span>}
            </button>
          </div>
        </div>
        
        {/* User Profile at bottom */}
        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
            <span className="text-sidebar-accent-foreground text-xs">ND</span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sidebar-foreground text-sm font-medium">Notebook User</p>
                <p className="text-sidebar-accent-foreground text-xs">Free Plan</p>
              </div>
            )}
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
      {!aiCollapsed && (
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
      )}

      {/* Right Sidebar - AI Assistant */}
      <div 
        className={`bg-gray-900 border-l border-gray-700 flex flex-col relative overflow-hidden transition-all duration-300 ease-in-out ${
          aiCollapsed ? 'w-16' : ''
        }`}
        style={{ 
          width: aiCollapsed ? '64px' : `${aiPanelWidth}px`,
          transition: 'width 300ms ease-in-out'
        }}
      >
        {aiCollapsed ? (
          // Collapsed state - just show floating icon
          <div className="flex flex-col items-center justify-center h-full">
            <button
              onClick={() => setAiCollapsed(false)}
              className="group w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
              title="Expand AI Assistant"
            >
              <MessageSquare className="h-6 w-6 group-hover:scale-105 transition-transform duration-200" />
            </button>
            <div className="mt-2 text-xs text-gray-400 text-center">
              AI
            </div>
          </div>
        ) : (
          // Expanded state - show full AI Assistant
          <AIAssistant onCollapse={() => setAiCollapsed(true)} />
        )}
      </div>
    </div>
  )
} 