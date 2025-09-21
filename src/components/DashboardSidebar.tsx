"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  Plus,
  Search,
  Clock,
  Box,
  ThumbsUp,
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
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { listenToUserDocuments, listenToUserSpaces, updateSpace, deleteSpace } from "@/lib/firestore"
import type { Document as AppDocument, Space as SpaceType } from "@/lib/types"
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
  const [collapsed, setCollapsed] = useState(false)
  const { theme, setTheme } = useTheme()
  const [recents, setRecents] = useState<AppDocument[]>([])
  const [spaces, setSpaces] = useState<SpaceType[]>([])

  // Realtime recents (last 5 by createdAt desc)
  React.useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = listenToUserDocuments(user.uid, (docs) => {
      setRecents(docs.slice(0, 5))
    })
    return unsubscribe
  }, [user?.uid])

  // Realtime spaces list
  React.useEffect(() => {
    if (!user?.uid) return
    const unsub = listenToUserSpaces(user.uid, (sps) => setSpaces(sps))
    return unsub
  }, [user?.uid])

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

  return (
    <aside className={`bg-sidebar border-r border-sidebar-border ${collapsed ? "w-16" : "w-64"} h-screen flex flex-col transition-all duration-300 sticky top-0`}>
      {/* Header */}
      <div className="px-3 pt-4 pb-2 flex items-center justify-between">
        {!collapsed && (
          <div className="text-sidebar-foreground font-semibold text-xl leading-none">YouLearn</div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 rounded-md hover:bg-sidebar-accent text-sidebar-accent-foreground"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {/* Primary actions */}
        <nav className="space-y-1 mb-4">
          <button
            onClick={onAddContentClick}
            className={`w-full flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}
          >
            <Plus className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Add content</span>}
          </button>
          <button
            onClick={onSearchClick}
            className={`w-full flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}
          >
            <Search className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Search</span>}
          </button>
          <Link
            href="#"
            className={`flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-3"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}
          >
            <Clock className="h-4 w-4" />
            {!collapsed && <span className="text-sm">History</span>}
          </Link>
        </nav>

        {/* Recents */}
        <div className="px-2 py-2">
          {!collapsed && (
            <div className="text-xs uppercase tracking-wide text-sidebar-accent-foreground mb-2 select-none">Recents</div>
          )}
          <div className="space-y-1">
            {recents.length === 0 ? (
              <div className={`text-xs ${collapsed ? "text-center" : "pl-2"} text-sidebar-accent-foreground/80 py-1`}>
                No recent documents
              </div>
            ) : (
              recents.map((doc, idx) => (
                <Link
                  key={doc.id}
                  href={`/notes/${doc.id}`}
                  className={`flex items-center ${collapsed ? "justify-center gap-0" : "gap-2"} px-2 py-2 rounded-md hover:bg-sidebar-accent`}
                  title={doc.title || "Untitled"}
                >
                  {!collapsed && (
                    <span className={`inline-flex h-2 w-2 rounded-full ${idx === 0 ? "bg-green-500" : "bg-transparent"}`} />
                  )}
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-sm bg-sidebar-primary/10">
                    {renderTypeIcon(doc.type)}
                  </span>
                  {!collapsed && (
                    <span className="text-sm text-sidebar-foreground truncate">
                      {doc.title || "Untitled"}
                    </span>
                  )}
                </Link>
              ))
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
            <Link href="#" className={`flex items-center ${collapsed ? "justify-center gap-0 px-2" : "gap-3 px-2"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}>
              <ThumbsUp className="h-4 w-4" />
              {!collapsed && <span className="text-sm">Feedback</span>}
            </Link>
            <Link href="#" className={`flex items-center ${collapsed ? "justify-center gap-0 px-2" : "justify-between gap-3 px-2"} py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground`}>
              <span className="inline-flex items-center gap-3">
                <BookOpen className="h-4 w-4" />
                {!collapsed && <span className="text-sm">Quick Guide</span>}
              </span>
              {!collapsed && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">New</span>
              )}
            </Link>
          </div>
        </div>

        {/* Plan badge */}
        {!collapsed && (
          <div className="px-4 pt-3">
            <div className="text-center text-xs text-sidebar-accent-foreground border rounded-md py-1.5">Free Plan</div>
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
              <DropdownMenuItem asChild>
                <Link href="/pricing" className="w-full">
                  <Crown className="h-4 w-4" />
                  <span>Pricing</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="#" className="w-full">
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
    </aside>
  )
}
