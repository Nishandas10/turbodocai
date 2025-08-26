"use client"

import { useState } from "react"
import { 
  ChevronLeft, 
  PenTool, 
  Home, 
  Settings, 
  Star, 
  FileText, 
  Mic, 
  Play, 
  FolderPlus, 
  MoreVertical,
  ArrowRight,
  Sun,
  Moon,
  Monitor,
  Search,
  Globe,
  Camera,
  LogOut
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useTheme } from "@/contexts/ThemeContext"
import { useAuth } from "@/contexts/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import CameraModal from "../components/CameraModal"
import AudioModal from "../components/AudioModal"
import DocumentUploadModal from "../components/DocumentUploadModal"
import YouTubeVideoModal from "../components/YouTubeVideoModal"
import WebsiteLinkModal from "../components/WebsiteLinkModal"

export default function Dashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { theme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    id: number
    title: string
    type: 'audio' | 'document'
    lastOpened: string
  }>>([])
  const [cameraModalOpen, setCameraModalOpen] = useState(false)
  const [audioModalOpen, setAudioModalOpen] = useState(false)
  const [documentUploadModalOpen, setDocumentUploadModalOpen] = useState(false)
  const [youtubeVideoModalOpen, setYoutubeVideoModalOpen] = useState(false)
  const [websiteLinkModalOpen, setWebsiteLinkModalOpen] = useState(false)

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

  const openCamera = () => {
    setCameraModalOpen(true)
  }

  const closeCamera = () => {
    setCameraModalOpen(false)
  }

  const openAudioModal = () => {
    setAudioModalOpen(true)
  }

  const closeAudioModal = () => {
    setAudioModalOpen(false)
  }

  const openDocumentUploadModal = () => {
    setDocumentUploadModalOpen(true)
  }

  const closeDocumentUploadModal = () => {
    setDocumentUploadModalOpen(false)
  }

  const openYoutubeVideoModal = () => {
    setYoutubeVideoModalOpen(true)
  }

  const closeYoutubeVideoModal = () => {
    setYoutubeVideoModalOpen(false)
  }

  const openWebsiteLinkModal = () => {
    setWebsiteLinkModalOpen(true)
  }

  const closeWebsiteLinkModal = () => {
    setWebsiteLinkModalOpen(false)
  }

  const createNewNote = async () => {
    if (!user?.uid) {
      console.error('User not authenticated')
      return
    }

    try {
      // Import Firebase functions directly
      const { createDocument } = await import('@/lib/firestore')
      const { uploadDocument } = await import('@/lib/storage')
      
      // Create document data
      const documentData = {
        title: 'Untitled Document',
        type: 'text' as const,
        content: {
          raw: '',
          processed: '',
        },
        metadata: {
          fileName: 'Untitled Document.txt',
          fileSize: 0,
          mimeType: 'text/plain',
        },
        tags: ['blank-document'],
        isPublic: false,
      }

      // Create document in Firestore first
      const documentId = await createDocument(user.uid, documentData)

      // Create a .txt file and upload to Firebase Storage
      const txtFile = new File([''], 'Untitled Document.txt', { type: 'text/plain' })
      const uploadResult = await uploadDocument(txtFile, user.uid, documentId)

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload document to storage')
      }

      // Update document with storage information
      const { updateDocumentStorageInfo } = await import('@/lib/firestore')
      await updateDocumentStorageInfo(
        documentId,
        user.uid,
        uploadResult.storagePath!,
        uploadResult.downloadURL!
      )

      // Redirect to the new note
      window.location.href = `/notes/${documentId}`
    } catch (error) {
      console.error('Error creating note:', error)
      alert('Error creating document. Please try again.')
    }
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
                className="flex items-center space-x-3 px-3 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sidebar-foreground"
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
                className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
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

          {/* User Profile - Now at bottom */}
          <div className="p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
                <span className="text-sidebar-accent-foreground text-sm">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sidebar-foreground text-sm font-medium truncate">
                    {user?.displayName || "User"}
                  </div>
                  <div className="text-sidebar-accent-foreground text-xs truncate">
                    {user?.email}
                  </div>
                </div>
              )}
            </div>
            
            {/* Sign Out Button */}
            {!sidebarCollapsed && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-sidebar-accent-foreground hover:text-red-400 hover:border-red-400/50"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Create new notes</p>
          </div>

          {/* Create New Notes Section */}
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Blank Document */}
              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={createNewNote}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Blank document</h3>
                <p className="text-muted-foreground text-xs">Start from scratch</p>
              </div>

              {/* Record or Upload Audio */}
              <div 
                className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm"
                onClick={openAudioModal}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Mic className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Record or upload audio</h3>
                <p className="text-muted-foreground text-xs">Upload an audio file</p>
              </div>

              {/* Document Upload */}
              <div 
                className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm"
                onClick={openDocumentUploadModal}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">DOC</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Document upload</h3>
                <p className="text-muted-foreground text-xs">Any PDF, DOC, PPT, etc</p>
              </div>

              {/* YouTube Video */}
              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={openYoutubeVideoModal}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">YouTube video</h3>
                <p className="text-muted-foreground text-xs">Paste a YouTube link</p>
              </div>

              {/* Website Link */}
              <div className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm" onClick={openWebsiteLinkModal}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <Globe className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Website link</h3>
                <p className="text-muted-foreground text-xs">Paste a website URL</p>
              </div>

              {/* Camera */}
              <div 
                className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm"
                onClick={openCamera}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="text-card-foreground font-medium text-sm mb-1">Camera</h3>
                <p className="text-muted-foreground text-xs">Open camera to capture</p>
              </div>
            </div>
          </div>

          {/* Notes List Section */}
          <div>
            {/* Notes Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex space-x-1 bg-muted rounded-lg p-1">
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
                  My Notes
                </button>
                <button className="px-4 py-2 text-muted-foreground hover:text-foreground rounded-md text-sm">
                  Shared with Me
                </button>
              </div>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <FolderPlus className="h-4 w-4 mr-2" />
                Create Folder
              </Button>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              {/* Note 1 */}
              <div className="bg-card rounded-xl p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Mic className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-card-foreground font-medium">Icelandic: What Is It?</h3>
                      <p className="text-muted-foreground text-sm">Last opened less than a minute ago</p>
                    </div>
                  </div>
                  <MoreVertical className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>

              {/* Note 2 */}
              <div className="bg-card rounded-xl p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-card-foreground font-medium">Notex</h3>
                      <p className="text-muted-foreground text-sm">Last opened less than a minute ago</p>
                    </div>
                  </div>
                  <MoreVertical className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>

              {/* Note 3 */}
              <div className="bg-card rounded-xl p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">DOC</span>
                    </div>
                    <div>
                      <h3 className="text-card-foreground font-medium">Metabolomics Technologies and Identification Methods Overview</h3>
                      <p className="text-muted-foreground text-sm">Last opened 1 day ago</p>
                    </div>
                  </div>
                  <MoreVertical className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>

              {/* Upgrade Note */}
              <div className="bg-card rounded-xl p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">DOC</span>
                    </div>
                    <div>
                      <h3 className="text-card-foreground font-medium">Upgrade plan to access notes!</h3>
                      <p className="text-muted-foreground text-sm">⭐ Upgrade plan to access notes!</p>
                    </div>
                  </div>
                  <MoreVertical className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Camera Modal */}
        <CameraModal 
          isOpen={cameraModalOpen} 
          onClose={closeCamera} 
        />

        {/* Audio Modal */}
        <AudioModal 
          isOpen={audioModalOpen} 
          onClose={closeAudioModal} 
        />

        {/* Document Upload Modal */}
        <DocumentUploadModal 
          isOpen={documentUploadModalOpen} 
          onClose={closeDocumentUploadModal} 
        />

        {/* YouTube Video Modal */}
        <YouTubeVideoModal 
          isOpen={youtubeVideoModalOpen} 
          onClose={closeYoutubeVideoModal} 
        />

        {/* Website Link Modal */}
        <WebsiteLinkModal 
          isOpen={websiteLinkModalOpen} 
          onClose={closeWebsiteLinkModal} 
        />

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
    </ProtectedRoute>
  )
} 