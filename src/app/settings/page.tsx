"use client"

import { useState } from "react"
import { 
  ChevronLeft, 
  PenTool, 
  Home, 
  Settings, 
  Star, 
  LogOut,
  Globe,
  CreditCard,
  Search,
  Sun,
  Moon,
  Monitor,
  Mic,
  FileText,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useTheme } from "@/contexts/ThemeContext"

export default function SettingsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { theme, setTheme } = useTheme()
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: number
    title: string
    type: 'audio' | 'document'
    lastOpened: string
  }>>([])

  // Mock search results - in real app this would come from API
  const mockDocuments: Array<{
    id: number
    title: string
    type: 'audio' | 'document'
    lastOpened: string
  }> = [
    { id: 1, title: "Icelandic: What Is It?", type: "audio", lastOpened: "less than a minute ago" },
    { id: 2, title: "Notex", type: "document", lastOpened: "less than a minute ago" },
    { id: 3, title: "Metabolomics Technologies and Identification Methods Overview", type: "document", lastOpened: "1 day ago" },
    { id: 4, title: "Machine Learning Basics", type: "document", lastOpened: "2 days ago" },
    { id: 5, title: "React Development Notes", type: "document", lastOpened: "3 days ago" },
    { id: 6, title: "Project Planning", type: "document", lastOpened: "1 week ago" }
  ]

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim() === '') {
      setSearchResults([])
      return
    }
    
    const filtered = mockDocuments.filter(doc => 
      doc.title.toLowerCase().includes(query.toLowerCase())
    )
    setSearchResults(filtered)
  }

  const openSearchModal = () => {
    setSearchModalOpen(true)
    setSearchQuery('')
    setSearchResults([])
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
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </Link>
            <button 
              onClick={openSearchModal}
              className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left"
            >
              <Search className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Search</span>}
            </button>
            <Link 
              href="/settings" 
              className="flex items-center space-x-3 px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sidebar-foreground"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Settings</span>}
            </Link>
          </nav>

          {/* Upgrade Button */}
          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-8">
            <Star className="h-4 w-4 mr-2" />
            {!sidebarCollapsed && "Upgrade to Premium"}
          </Button>
        </div>

        {/* Theme Toggle Section */}
        {!sidebarCollapsed && (
          <div className="px-4 py-2">
            <div className="flex space-x-2">
              <button
                onClick={() => setTheme('light')}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'light' 
                    ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' 
                    : 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground'
                }`}
                title="Light theme"
              >
                <Sun className="h-4 w-4" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'dark' 
                    ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' 
                    : 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground'
                }`}
                title="Dark theme"
              >
                <Moon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'system' 
                    ? 'bg-white/20 backdrop-blur-sm text-sidebar-foreground' 
                    : 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground'
                }`}
                title="System theme"
              >
                <Monitor className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* User Profile - At bottom */}
        <div className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
              <span className="text-sidebar-accent-foreground text-sm">ND</span>
            </div>
            {!sidebarCollapsed && <span className="text-sidebar-foreground text-sm">Nishant Das</span>}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Settings className="h-8 w-8 text-blue-400" />
            <h1 className="text-3xl font-bold text-foreground">My Account</h1>
          </div>
        </div>

        {/* Account Settings Sections */}
        <div className="space-y-6">
          {/* Full Name */}
          <div className="border-b border-border pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Full Name</h3>
                <p className="text-muted-foreground">Your Full Name</p>
              </div>
              <span className="text-foreground">Nishant Das</span>
            </div>
          </div>

          {/* Email */}
          <div className="border-b border-border pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Email</h3>
                <p className="text-muted-foreground">Your Email</p>
              </div>
              <span className="text-foreground">nishancodes@gmail.com</span>
            </div>
          </div>

          {/* Change Language */}
          <div className="border-b border-border pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Change language</h3>
                <p className="text-muted-foreground">This language will be used to generate all content.</p>
              </div>
              <Button variant="outline" className="bg-muted border-border text-foreground hover:bg-muted/80">
                <Globe className="h-4 w-4 mr-2" />
                English
              </Button>
            </div>
          </div>

          {/* Current Pricing Plan */}
          <div className="border-b border-border pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Current Pricing Plan</h3>
                <p className="text-muted-foreground">Your Enrolled Plan</p>
              </div>
              <span className="text-foreground">Starter Plan</span>
            </div>
          </div>

          {/* Billing Portal */}
          <div className="border-b border-border pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Billing Portal</h3>
                <p className="text-muted-foreground">Upgrade, cancel, or view your subscription</p>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <CreditCard className="h-4 w-4 mr-2" />
                Billing Portal
              </Button>
            </div>
          </div>

          {/* Logout */}
          <div className="pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Logout</h3>
                <p className="text-muted-foreground">Sign out of your current account</p>
              </div>
              <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-card-foreground">Search Documents</h2>
                <button
                  onClick={() => setSearchModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 rotate-45" />
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="p-6 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            {/* Search Results */}
            <div className="p-6 overflow-y-auto max-h-96">
              {searchQuery.trim() === '' ? (
                <div className="text-center text-muted-foreground py-8">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start typing to search...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No documents found for &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-blue-500 transition-colors cursor-pointer group"
                    >
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        {doc.type === 'audio' ? (
                          <Mic className="h-5 w-5 text-white" />
                        ) : (
                          <FileText className="h-5 w-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-card-foreground font-medium truncate">{doc.title}</h3>
                        <p className="text-muted-foreground text-sm">Last opened {doc.lastOpened}</p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 