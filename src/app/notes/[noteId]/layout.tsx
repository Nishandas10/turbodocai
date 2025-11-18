"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { ChevronLeft, FileText, MessageSquare, Star, Headphones, BookOpen, Target, ChevronDown, Moon, LogOut, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AIAssistant } from '@/components/editor'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import ProtectedRoute from '@/components/ProtectedRoute'
import UpgradeModal from '@/components/UpgradeModal'
import { getUserProfile } from '@/lib/firestore'
import { Crown } from 'lucide-react'

export default function NoteLayout({ children }: { children: React.ReactNode }) {
  const [aiPanelWidth, setAiPanelWidth] = useState(400)
  const [isDragging, setIsDragging] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)
  // Left editor sidebar collapsed state; will auto-collapse on mobile initially.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Track if user has manually toggled; before that we allow responsive resize behavior.
  const [sidebarUserToggled, setSidebarUserToggled] = useState(false)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [aiUserToggled, setAiUserToggled] = useState(false)
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const search = useSearchParams()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [subscription, setSubscription] = useState<'free'|'premium'|'unknown'>('unknown')

  const noteId = params?.noteId as string
  const ownerId = search?.get('owner') || undefined
  const [effOwner, setEffOwner] = useState<string | undefined>(ownerId)

  useEffect(() => {
    try {
      if (noteId && ownerId) {
        localStorage.setItem(`doc_owner_${noteId}`, ownerId)
        setEffOwner(ownerId)
      } else if (noteId && !ownerId) {
        const stored = localStorage.getItem(`doc_owner_${noteId}`) || undefined
        if (stored) setEffOwner(stored)
      }
    } catch {}
  }, [noteId, ownerId])

  // Fetch subscription status for current user (owner perspective)
  useEffect(() => {
    const run = async () => {
      if (!user?.uid) return
      try {
        const profile = await getUserProfile(user.uid)
        const sub: 'free'|'premium'|undefined = profile?.subscription as ('free'|'premium'|undefined)
        setSubscription(sub || 'free')
      } catch { setSubscription('unknown') }
    }
    run()
  }, [user?.uid])

  // Auto-collapse AI assistant for mobile on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const MOBILE_BP = 768
    if (window.innerWidth < MOBILE_BP) {
      setAiCollapsed(true)
    }
  }, [])

  // Responsive expand/collapse until user manually toggles
  useEffect(() => {
    if (typeof window === 'undefined') return
    const MOBILE_BP = 768
    const handler = () => {
      if (aiUserToggled) return
      if (window.innerWidth < MOBILE_BP) {
        setAiCollapsed(true)
      } else {
        setAiCollapsed(false)
      }
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [aiUserToggled])

  // Auto-collapse sidebar on initial mount for mobile (<768px)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const MOBILE_BP = 768
    if (window.innerWidth < MOBILE_BP) {
      setSidebarCollapsed(true)
    }
  }, [])

  // Responsive collapse/expand until user manually toggles.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const MOBILE_BP = 768
    const handler = () => {
      if (sidebarUserToggled) return
      if (window.innerWidth < MOBILE_BP) {
        setSidebarCollapsed(true)
      } else {
        setSidebarCollapsed(false)
      }
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [sidebarUserToggled])

  const handleSidebarToggle = () => {
    setSidebarCollapsed(c => !c)
    setSidebarUserToggled(true)
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || aiCollapsed) return
    const containerWidth = window.innerWidth
    const newWidth = containerWidth - e.clientX
    const minWidth = 300
    const maxWidth = containerWidth * 0.6
    if (newWidth >= minWidth && newWidth <= maxWidth) setAiPanelWidth(newWidth)
  }, [isDragging, aiCollapsed])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  useEffect(() => {
    if (!isDragging) return
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const isCurrentPath = (path: string) => pathname === path

  const withOwner = (path: string) => {
    const owner = effOwner || ownerId
    if (!owner) return path
    const hasQuery = path.includes('?')
    return `${path}${hasQuery ? '&' : '?'}owner=${owner}`
  }

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background flex overflow-hidden">
        {/* Left Sidebar */}
        <div className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'} flex flex-col h-full sticky top-0`}>
          <div className="p-4 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {/* App Name and Collapse Button */}
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={handleSidebarToggle}
                className="flex items-center space-x-2 hover:bg-sidebar-accent rounded-lg p-2 transition-colors cursor-pointer group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sidebar-accent"
                aria-label={sidebarCollapsed ? 'Expand editor sidebar' : 'Collapse editor sidebar'}
                title={sidebarCollapsed ? 'Expand editor sidebar' : 'Collapse editor sidebar'}
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
              <button onClick={() => router.push(withOwner(`/notes/${noteId}`))} className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${isCurrentPath(`/notes/${noteId}`) ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                <FileText className="h-5 w-5 flex-shrink-0" />
                {!sidebarCollapsed && <span>Document</span>}
              </button>

              {/* Note Tools */}
              <div className="space-y-1">
                <button onClick={() => router.push(withOwner(`/notes/${noteId}/chat`))} className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${isCurrentPath(`/notes/${noteId}/chat`) ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                  <MessageSquare className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Chat</span>}
                </button>
                <button onClick={() => router.push(withOwner(`/notes/${noteId}/podcast`))} className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${isCurrentPath(`/notes/${noteId}/podcast`) ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                  <Headphones className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Podcast</span>}
                </button>
                <button onClick={() => router.push(withOwner(`/notes/${noteId}/flashcards`))} className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${isCurrentPath(`/notes/${noteId}/flashcards`) ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                  <BookOpen className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Flashcards</span>}
                </button>
                <button onClick={() => router.push(withOwner(`/notes/${noteId}/quiz`))} className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${isCurrentPath(`/notes/${noteId}/quiz`) ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                  <Target className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Quiz</span>}
                </button>
                <button onClick={() => router.push(withOwner(`/notes/${noteId}/transcript`))} className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors w-full text-left ${isCurrentPath(`/notes/${noteId}/transcript`) ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' : 'text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                  <FileText className="h-5 w-5 flex-shrink-0" />
                  {!sidebarCollapsed && <span>Transcript</span>}
                </button>
              </div>
            </nav>

            {/* Upgrade to Premium */}
            {subscription === 'premium' ? (
              <div className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white mb-8 rounded-md px-3 py-2 flex items-center justify-center gap-2 select-none">
                <Crown className="h-4 w-4" />
                {!sidebarCollapsed && <span>Premium</span>}
              </div>
            ) : (
              <Button onClick={() => setShowUpgrade(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-8">
                <Star className="h-4 w-4 mr-2" />
                {!sidebarCollapsed && "Upgrade to BlumeNote Pro"}
              </Button>
            )}
          </div>

          {/* User footer / Auth */}
          <div className="px-2 py-3 border-t border-sidebar-border">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`w-full ${sidebarCollapsed ? 'justify-center' : 'justify-between'} flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs text-sidebar-accent-foreground">
                        {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                      </span>
                      {!sidebarCollapsed && (
                        <span className="min-w-0 text-left">
                          <span className="block text-sm text-sidebar-foreground truncate">{user?.email || user?.displayName || 'User'}</span>
                        </span>
                      )}
                    </span>
                    {!sidebarCollapsed && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-56">
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); router.push('/dashboard') }}>
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Back to Dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={theme === 'dark'}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Dark mode</span>
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); void signOut() }}
                    variant="destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button onClick={() => router.push('/signup')} className={`w-full ${sidebarCollapsed ? 'justify-center' : 'justify-center gap-2'} flex items-center rounded-md px-2 py-1.5 border border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground`}>
                <span className="text-sm">Sign in</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Page Content (scroll container) */}
          <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
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
                  className={`w-1 bg-gray-600 cursor-col-resize hover:bg-gray-500 transition-colors ${isDragging ? 'bg-purple-500' : ''}`}
                  onMouseDown={handleMouseDown}
                  style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
                >
                  <div className="w-1 h-full flex items-center justify-center">
                    <div className="w-0.5 h-8 bg-gray-400 rounded-full"></div>
                  </div>
                </div>

                {/* Right Sidebar - AI Assistant */}
                <div className="bg-card text-card-foreground border-l border-border flex flex-col relative overflow-hidden transition-all duration-300 ease-in-out" style={{ width: `${aiPanelWidth}px`, transition: 'width 300ms ease-in-out' }}>
                  <AIAssistant onCollapse={() => { setAiCollapsed(true); setAiUserToggled(true) }} />
                </div>
              </>
            )}

            {/* When collapsed, remove sidebar entirely and show a floating chat button */}
            {aiCollapsed && (
              <button
                onClick={() => { setAiCollapsed(false); setAiUserToggled(true) }}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                title="Open AI Assistant"
                aria-label="Open AI Assistant"
              >
                <MessageSquare className="h-6 w-6" />
              </button>
            )}
          </>
        )}

        {/* Upgrade Modal */}
        {subscription === 'premium' ? null : (
          <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
        )}
      </div>
    </ProtectedRoute>
  )
}
