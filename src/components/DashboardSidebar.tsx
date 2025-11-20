"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import dynamic from 'next/dynamic'
import {
  Plus,
  Search,
  Clock,
  Box,
  ThumbsUp,
  Home,
  BookOpen,
  ChevronLeft,
  LogOut,
  Settings as SettingsIcon,
  Crown,
  Moon,
  ChevronDown,
  FileText,
  Mic,
  Play,
  Globe,
  Image as ImageIcon,
  MoreHorizontal,
  GitBranch,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import UpgradeModal from "@/components/UpgradeModal"
import FeedbackModal from "@/components/FeedbackModal"
import { listenToUserDocuments, listenToUserSpaces, updateSpace, deleteSpace, listenToMindMaps, listenToUserChats, getUserProfile } from "@/lib/firestore"
import type { Document as AppDocument, Space as SpaceType, MindMap, Chat } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"

type Props = {
  onSearchClick?: () => void
  onAddContentClick?: () => void
  onCreateSpaceClick?: () => void
}

export default function DashboardSidebar({ onSearchClick, onAddContentClick, onCreateSpaceClick }: Props) {
  const { user, signOut } = useAuth()
  // Sidebar collapsed state. Default will be overridden for mobile on mount.
  const [collapsed, setCollapsed] = useState(false)
  // Track if the user manually toggled; if not, responsive resize can still auto-adjust.
  const [userToggled, setUserToggled] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [subscription, setSubscription] = useState<'free'|'premium'|'unknown'>('unknown')
  const { theme, setTheme } = useTheme()
  const [recents, setRecents] = useState<AppDocument[]>([])
  const [mindmaps, setMindmaps] = useState<MindMap[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [spaces, setSpaces] = useState<SpaceType[]>([])
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  // Lazy load SearchModal to avoid initial bundle weight
  const SearchModal = React.useMemo(() => dynamic(() => import('./SearchModal'), { ssr: false }), [])

  // Realtime recents (store full list; UI will truncate to 5)
  React.useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = listenToUserDocuments(user.uid, (docs) => {
      setRecents(docs)
    })
    return unsubscribe
  }, [user?.uid])

  React.useEffect(() => {
    if (!user?.uid) return
    const unsub = listenToMindMaps(user.uid, (maps) => setMindmaps(maps))
    return unsub
  }, [user?.uid])

  React.useEffect(() => {
    if (!user?.uid) return
    const unsub = listenToUserChats(user.uid, (chs) => setChats(chs))
    return unsub
  }, [user?.uid])

  // Realtime spaces list
  React.useEffect(() => {
    if (!user?.uid) return
    const unsub = listenToUserSpaces(user.uid, (sps) => setSpaces(sps))
    return unsub
  }, [user?.uid])

  // Fetch subscription status
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

  // Responsive: collapse by default on initial mount for mobile (<768px)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const MOBILE_BREAKPOINT = 768
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      setCollapsed(true)
    }
  }, [])

  // Auto adjust on resize ONLY until user manually toggles.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const MOBILE_BREAKPOINT = 768
    const handler = () => {
      if (userToggled) return
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setCollapsed(true)
      } else {
        setCollapsed(false)
      }
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [userToggled])

  const handleToggle = () => {
    setCollapsed(c => !c)
    setUserToggled(true)
  }

  // (Optional) Add counts here if needed later

  const renderTypeIcon = (type: AppDocument["type"]) => {
    switch (type) {
      case "audio":
        return <Mic className="h-3.5 w-3.5 text-sidebar-accent-foreground" />
      case "youtube":
        return <Play className="h-3.5 w-3.5 text-sidebar-accent-foreground" />
      case "website":
        return <Globe className="h-3.5 w-3.5 text-sidebar-accent-foreground" />
      case "image":
        return <ImageIcon className="h-3.5 w-3.5 text-sidebar-accent-foreground" />
      default:
        return <FileText className="h-3.5 w-3.5 text-sidebar-accent-foreground" />
    }
  }

  const combinedRecents = React.useMemo(() => {
    type RecentItem = { id: string; kind: 'document' | 'mindmap' | 'chat'; createdAt: number; ref: AppDocument | MindMap | Chat }
    const toMs = (val: unknown): number => {
      if (!val) return 0
      if (val instanceof Date) return val.getTime()
      if (typeof val === 'object' && val && 'toDate' in (val as Record<string, unknown>)) {
        try { return (val as { toDate: () => Date }).toDate().getTime() } catch { return 0 }
      }
      const t = new Date(val as string | number).getTime(); return isNaN(t) ? 0 : t
    }
    const docItems: RecentItem[] = recents.map(d => ({ id: d.id, kind: 'document', createdAt: toMs(d.createdAt), ref: d }))
    const mapItems: RecentItem[] = mindmaps.map(m => ({ id: m.id, kind: 'mindmap', createdAt: toMs(m.createdAt), ref: m }))
    const chatItems: RecentItem[] = chats.map(c => ({ id: c.id, kind: 'chat', createdAt: toMs(c.createdAt), ref: c }))
    return [...docItems, ...mapItems, ...chatItems].sort((a,b)=> b.createdAt - a.createdAt).slice(0,5)
  }, [recents, mindmaps, chats])

  const renderRecentIcon = (item: { kind: 'document' | 'mindmap' | 'chat'; ref: AppDocument | MindMap | Chat }) => {
    if (item.kind === 'mindmap') return <GitBranch className="h-3.5 w-3.5 text-sidebar-accent-foreground" />
    if (item.kind === 'chat') return <span className="h-3.5 w-3.5 inline-flex items-center justify-center text-[10px]">💬</span>
    return renderTypeIcon((item.ref as AppDocument).type)
  }

  return (
    <aside className={`bg-sidebar border-r border-sidebar-border ${collapsed ? "w-16" : "w-64"} h-screen flex flex-col transition-all duration-300 sticky top-0`}>
      {/* Header */}
      <div className="px-3 pt-4 pb-2 flex items-center justify-between">
        {!collapsed && (
          <div className="text-sidebar-foreground font-semibold text-xl leading-none">BlumeNote AI</div>
        )}
        <button
          onClick={handleToggle}
          className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sidebar-accent"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {/* Primary actions */}
        <nav className="space-y-1 mb-4">
          <button
            onClick={() => {
              if (onAddContentClick) return onAddContentClick()
              // Default fallback: navigate to dashboard
              router.push('/dashboard')
            }}
            className={`w-full flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}
          >
            <Home className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Add content</span>}
          </button>
          {/* Mind Maps */}
          <Link
            href="/mindmaps"
            className={`flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}
          >
            <GitBranch className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Mind Maps</span>}
          </Link>
          {/* Explore removed */}
          <button
            onClick={() => {
              if (onSearchClick) return onSearchClick()
              setSearchOpen(true)
            }}
            className={`w-full flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}
          >
            <Search className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Search</span>}
          </button>
          <Link
            href="/notes"
            className={`flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}
          >
            <Clock className="h-4 w-4" />
            {!collapsed && <span className="text-sm">History</span>}
          </Link>
        </nav>

        {/* Recents (show first five + Show More) */}
        <div className="px-2 py-2">
          {!collapsed && (
            <div className="text-xs uppercase tracking-wide text-sidebar-accent-foreground mb-2 select-none">Recents</div>
          )}
          <div className="space-y-1">
            {combinedRecents.length === 0 ? (
              <div className={`text-xs ${collapsed ? "text-center" : "pl-2"} text-sidebar-accent-foreground/80 py-1`}>
                No recent items
              </div>
            ) : (
              <>
                {combinedRecents.map((item) => {
                  const href = item.kind === 'document' ? `/notes/${item.id}` : item.kind === 'mindmap' ? `/mindmaps/${item.id}` : `/chat/${item.id}`
                  const title = item.kind === 'document' ? (item.ref.title || 'Untitled') : item.kind === 'mindmap' ? (item.ref.title || 'Untitled Map') : (item.ref.title || 'Chat')
                  return (
                    <Link
                      key={`${item.kind}-${item.id}`}
                      href={href}
                      className={`flex items-center ${collapsed ? "justify-center gap-0" : "gap-2"} px-2 py-2 rounded-md hover:bg-sidebar-accent`}
                      title={title}
                    >
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-sm bg-sidebar-primary/10">
                        {renderRecentIcon(item)}
                      </span>
                      {!collapsed && (
                        <span className="text-sm text-sidebar-foreground truncate">
                          {title}
                        </span>
                      )}
                    </Link>
                  )
                })}
                { (recents.length + mindmaps.length + chats.length) > 5 && !collapsed && (
                  <Link href="/notes" className="flex items-center gap-2 px-2 py-2 rounded-md text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent text-sm">
                    <span className="inline-flex h-4 w-4 items-center justify-center">›</span>
                    <span>Show More</span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Spaces */}
        <div className="px-2 py-2">
          {!collapsed && (
            <div className="text-xs uppercase tracking-wide text-sidebar-accent-foreground mb-2 select-none">Spaces</div>
          )}
          <div className="space-y-1">
            <button onClick={onCreateSpaceClick} className={`w-full flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-2"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}>
              <Plus className="h-4 w-4" />
              {!collapsed && <span className="text-sm">Create Space</span>}
            </button>
            {spaces.length === 0 ? (
              <div className={`text-xs ${collapsed ? "text-center" : "pl-2"} text-sidebar-accent-foreground/80 py-1`}>
                No spaces yet
              </div>
            ) : (
              spaces.map((sp) => (
                <div key={sp.id} className={`group relative flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-2 px-2"} py-2 rounded-md hover:bg-sidebar-accent`}>
                  <Link href={`/spaces/${sp.id}`} className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-sm bg-sidebar-primary/10">
                      <Box className="h-4 w-4" />
                    </span>
                    {!collapsed && (
                      <span className="text-sm text-sidebar-foreground truncate">
                        {sp.name || 'Untitled Space'}
                      </span>
                    )}
                  </Link>
                  {/* Hover menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`absolute ${collapsed ? 'top-1 right-1' : 'top-1 right-2'} opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-sidebar-accent-foreground/10`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Space menu"
                      >
                        <MoreHorizontal className="h-4 w-4 text-sidebar-accent-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onSelect={async (e) => {
                        e.preventDefault()
                        try {
                          const url = `${window.location.origin}/spaces/${sp.id}`
                          await navigator.clipboard.writeText(url)
                        } catch {}
                      }}>Share</DropdownMenuItem>
                      <DropdownMenuItem onSelect={async (e) => {
                        e.preventDefault()
                        const newName = window.prompt('Rename space', sp.name || 'Untitled')?.trim()
                        if (newName && user?.uid) await updateSpace(user.uid, sp.id, { name: newName })
                      }}>Edit</DropdownMenuItem>
                      <DropdownMenuItem onSelect={async (e) => {
                        e.preventDefault()
                        if (confirm('Delete this space? This does not remove documents.')) {
                          if (user?.uid) await deleteSpace(user.uid, sp.id)
                        }
                      }}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Help & Tools */}
        <div className="px-2 py-2">
          {!collapsed && (
            <div className="text-xs uppercase tracking-wide text-sidebar-accent-foreground mb-2 select-none">Help & Tools</div>
          )}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className={`w-full flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-2"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}
            >
              <ThumbsUp className="h-4 w-4" />
              {!collapsed && <span className="text-sm">Feedback</span>}
            </button>
            <Link href="mailto:dasbudhe@gmail.com" className={`flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-2"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}>
              <BookOpen className="h-4 w-4" />
              {!collapsed && <span className="text-sm">Contact us</span>}
            </Link>
          </div>
        </div>

        {/* Plan badge */}
        {!collapsed && (
          <div className="px-4 pt-3">
            <div className="text-center text-xs text-sidebar-accent-foreground border rounded-md py-1.5">
              {subscription === 'premium' ? (
                <span className="inline-flex items-center gap-1">
                  <Crown className="h-3.5 w-3.5 text-yellow-500" />
                  Premium
                </span>
              ) : (
                'Free Plan'
              )}
            </div>
          </div>
        )}
      </div>

      {/* User footer / Auth */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={`w-full ${collapsed ? "justify-center" : "justify-between"} flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent`}>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs text-sidebar-accent-foreground">
                    {user?.displayName?.[0] || user?.email?.[0] || "U"}
                  </span>
                  {!collapsed && (
                    <span className="min-w-0 text-left">
                      <span className="block text-sm text-sidebar-foreground truncate">{user?.displayName || user?.email || "User"}</span>
                    </span>
                  )}
                </span>
                {!collapsed && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="w-full">
                  <SettingsIcon className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              {subscription === 'premium' ? (
                <DropdownMenuItem disabled>
                  <Crown className="h-4 w-4 text-yellow-500" />
                  <span>Premium</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => { setShowUpgrade(true) }}>
                  <Crown className="h-4 w-4" />
                  <span>Pricing</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/notes" className="w-full">
                  <Clock className="h-4 w-4" />
                  <span>History</span>
                </Link>
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
                onSelect={(e) => {
                  e.preventDefault()
                  void signOut()
                }}
                variant="destructive"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/signup" className={`w-full ${collapsed ? "justify-center" : "justify-center gap-2"} flex items-center rounded-md px-2 py-1.5 border border-sidebar-border hover:bg-sidebar-accent text-sidebar-foreground`}>
            <span className="text-sm">Sign in</span>
          </Link>
        )}
      </div>
      {searchOpen && (
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      )}
      {feedbackOpen && (
        <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      )}
      {subscription === 'premium' ? null : (
        <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
      )}
    </aside>
  )
}


