"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, FileText, MessageSquare, Star, Headphones, BookOpen, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { AIAssistant } from '@/components/editor'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function NoteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [aiPanelWidth, setAiPanelWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { user } = useAuth()

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

  const noteId = params?.noteId as string

  const isCurrentPath = (path: string) => {
    return pathname === path
  }

  return (
    <ProtectedRoute>
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
              <button
                onClick={() => router.push(`/notes/${noteId}`)}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                  isCurrentPath(`/notes/${noteId}`) 
                    ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground'
                    : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                <FileText className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>Document</span>}
              </button>
              
              {/* Note Tools */}
              <div className="space-y-1">
                <button 
                  onClick={() => router.push(`/notes/${noteId}/chat`)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                    isCurrentPath(`/notes/${noteId}/chat`)
                      ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground'
                      : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <MessageSquare className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Chat</span>}
                </button>
                
                <button 
                  onClick={() => router.push(`/notes/${noteId}/podcast`)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                    isCurrentPath(`/notes/${noteId}/podcast`)
                      ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground'
                      : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <Headphones className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Podcast</span>}
                </button>
                
                <button 
                  onClick={() => router.push(`/notes/${noteId}/flashcards`)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                    isCurrentPath(`/notes/${noteId}/flashcards`)
                      ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground'
                      : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <BookOpen className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Flashcards</span>}
                </button>
                
                <button 
                  onClick={() => router.push(`/notes/${noteId}/quiz`)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                    isCurrentPath(`/notes/${noteId}/quiz`)
                      ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground'
                      : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <Target className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Quiz</span>}
                </button>
                
                <button 
                  onClick={() => router.push(`/notes/${noteId}/transcript`)}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${
                    isCurrentPath(`/notes/${noteId}/transcript`)
                      ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground'
                      : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                >
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Transcript</span>}
                </button>
              </div>
              
            </nav>

            {/* Upgrade to Premium */}
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-8">
              <Star className="h-4 w-4 mr-2" />
              {!sidebarCollapsed && "Upgrade to Premium"}
            </Button>
          </div>
          
          {/* User Profile at bottom */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
                <span className="text-sidebar-accent-foreground text-xs">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sidebar-foreground text-sm font-medium">{user?.email || 'User'}</p>
                  <p className="text-sidebar-accent-foreground text-xs">Free Plan</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Page Content (scroll container) */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {children}
          </div>
        </div>

        {/* AI Assistant - only show on main document page */}
        {isCurrentPath(`/notes/${noteId}`) && (
          <>
            {/* When expanded, show divider and assistant panel */}
            {!aiCollapsed && (
              <>
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
                  className="bg-gray-900 border-l border-gray-700 flex flex-col relative overflow-hidden transition-all duration-300 ease-in-out"
                  style={{ 
                    width: `${aiPanelWidth}px`,
                    transition: 'width 300ms ease-in-out'
                  }}
                >
                  <AIAssistant onCollapse={() => setAiCollapsed(true)} />
                </div>
              </>
            )}

            {/* When collapsed, remove sidebar entirely and show a floating chat button */}
            {aiCollapsed && (
              <button
                onClick={() => setAiCollapsed(false)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
                title="Open AI Assistant"
                aria-label="Open AI Assistant"
              >
                <MessageSquare className="h-6 w-6" />
              </button>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  )
} 