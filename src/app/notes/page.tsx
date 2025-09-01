"use client"

import { useState, useEffect } from "react"
import { 
  ChevronLeft, 
  PenTool, 
  Home, 
  Settings, 
  FileText, 
  Search, 
  Plus,
  Clock,
  Star,
  MoreVertical,
  Edit3,
  Share2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"

export default function NotesPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user } = useAuth()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar with Ctrl/Cmd + B
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setSidebarCollapsed(!sidebarCollapsed)
      }
      // Close sidebar with Escape key on mobile
      if (e.key === 'Escape' && !sidebarCollapsed && window.innerWidth < 768) {
        setSidebarCollapsed(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarCollapsed])

  // Mock notes data - in real app this would come from API
  const notes = [
    {
      id: 1,
      title: "Meeting Notes - Q1 Planning",
      content: "Discussion about Q1 goals and strategies...",
      lastModified: "2024-01-15T10:30:00Z",
      isStarred: true,
      tags: ["meeting", "planning", "q1"]
    },
    {
      id: 2,
      title: "Project Requirements",
      content: "Detailed requirements for the new feature...",
      lastModified: "2024-01-14T15:45:00Z",
      isStarred: false,
      tags: ["project", "requirements", "feature"]
    },
    {
      id: 3,
      title: "Ideas for Next Sprint",
      content: "Brainstorming session ideas and improvements...",
      lastModified: "2024-01-13T09:15:00Z",
      isStarred: true,
      tags: ["ideas", "sprint", "improvements"]
    },
    {
      id: 4,
      title: "Daily Standup Notes",
      content: "Team updates and blockers from today's standup...",
      lastModified: "2024-01-12T14:20:00Z",
      isStarred: false,
      tags: ["standup", "daily", "team"]
    }
  ]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background flex overflow-hidden relative">
        {/* Backdrop for mobile when sidebar is expanded */}
        {!sidebarCollapsed && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* Left Sidebar */}
        <div className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-16' : 'w-64'} flex flex-col h-full sticky top-0 z-50 md:relative md:z-auto`}>
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
                <PenTool className="h-5 w-5 text-blue-400 group-hover:text-blue-300 transition-colors flex-shrink-0" />
                {!sidebarCollapsed && <span className="text-sidebar-foreground font-semibold text-lg">Turbonotes AI</span>}
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
                title={sidebarCollapsed ? "Dashboard" : ""}
              >
                <Home className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>Dashboard</span>}
              </Link>
              <div 
                className="flex items-center space-x-3 px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sidebar-foreground"
                title={sidebarCollapsed ? "All Notes (Current)" : ""}
              >
                <FileText className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>All Notes</span>}
              </div>
              <Link 
                href="/settings" 
                className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
                title={sidebarCollapsed ? "Settings" : ""}
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>Settings</span>}
              </Link>
            </nav>

            {/* Quick Actions */}
            {!sidebarCollapsed && (
              <div className="mb-8">
                <h3 className="text-sidebar-accent-foreground text-sm font-medium mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    New Note
                  </Button>
                  <button className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left">
                    <Search className="h-4 w-4" />
                    <span>Search Notes</span>
                  </button>
                  <button className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left">
                    <Star className="h-4 w-4" />
                    <span>Starred Notes</span>
                  </button>
                </div>
              </div>
            )}

            {/* Collapsed Quick Actions */}
            {sidebarCollapsed && (
              <div className="mb-8 space-y-3">
                <button 
                  className="w-full flex items-center justify-center p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  title="New Note"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button 
                  className="w-full flex items-center justify-center p-3 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
                  title="Search Notes"
                >
                  <Search className="h-5 w-5" />
                </button>
                <button 
                  className="w-full flex items-center justify-center p-3 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
                  title="Starred Notes"
                >
                  <Star className="h-5 w-5" />
                </button>
              </div>
            )}
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
                  <p className="text-sidebar-foreground text-sm font-medium">
                    {user?.email || 'User'}
                  </p>
                  <p className="text-sidebar-accent-foreground text-xs">Free Plan</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="bg-background border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">All Notes</h1>
                <p className="text-muted-foreground">Manage and organize your notes</p>
              </div>
              <div className="flex items-center space-x-3">
                {sidebarCollapsed && (
                  <button 
                    className="md:hidden flex items-center space-x-2 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
                    onClick={() => setSidebarCollapsed(false)}
                  >
                    <span>Show Menu</span>
                  </button>
                )}
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  New Note
                </Button>
              </div>
            </div>
          </div>

          {/* Notes Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className={`grid gap-6 ${
              sidebarCollapsed 
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6' 
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}>
              {notes.map((note) => (
                <div key={note.id} className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      {note.isStarred && <Star className="h-4 w-4 text-yellow-500 fill-current" />}
                    </div>
                    <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <h3 className="font-semibold text-foreground mb-2 truncate">{note.title}</h3>
                  <p className="text-muted-foreground text-sm mb-3 overflow-hidden text-ellipsis" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{note.content}</p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-1 text-muted-foreground text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(note.lastModified)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Link href={`/notes/${note.id}`}>
                      <Button variant="outline" size="sm" className="h-8 flex-1">
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" className="h-8 flex-1">
                      <Share2 className="h-3 w-3 mr-1" />
                      Share
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
} 