"use client"

import { useState, useRef, useEffect } from "react"
import { 
  ChevronLeft, 
  PenTool, 
  Home, 
  Settings, 
  Star, 
  FileText, 
  Mic, 
  Play, 
  ArrowRight,
  Sun,
  Moon,
  Monitor,
  Search,
  Pause,
  Square
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useTheme } from "@/contexts/ThemeContext"

export default function RecordPage() {
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
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

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

  // Get available audio devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devices => {
        const audioInputs = devices.filter(device => device.kind === 'audioinput')
        setAudioDevices(audioInputs)
        if (audioInputs.length > 0) {
          setSelectedDevice(audioInputs[0].deviceId)
        }
      })
      .catch(console.error)
  }, [])

  // Timer effect
  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording, isPaused])

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { deviceId: selectedDevice ? { exact: selectedDevice } : undefined } 
      })
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      
      mediaRecorder.start()
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)
      
      console.log('Recording started')
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        setIsPaused(false)
      } else {
        mediaRecorderRef.current.pause()
        setIsPaused(true)
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      setIsRecording(false)
      setIsPaused(false)
      setRecordingTime(0)
      console.log('Recording stopped')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar */}
      <div className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 ${sidebarCollapsed ? 'w-16' : 'w-64'} flex flex-col h-full sticky top-0`}>
        <div className="p-4 flex-1 overflow-y-auto">
          {/* App Name and Collapse Button */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-2">
              <PenTool className="h-5 w-5 text-blue-400" />
              {!sidebarCollapsed && <span className="text-sidebar-foreground font-semibold text-lg">Turbonotes AI</span>}
            </div>
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-sidebar-accent-foreground hover:text-sidebar-foreground transition-colors"
            >
              <ChevronLeft className={`h-5 w-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="space-y-2 mb-8">
            <Link 
              href="/dashboard" 
              className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <Home className="h-5 w-5" />
              {!sidebarCollapsed && <span>Dashboard</span>}
            </Link>
            <button 
              onClick={openSearchModal}
              className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors w-full text-left"
            >
              <Search className="h-5 w-5" />
              {!sidebarCollapsed && <span>Search</span>}
            </button>
            <Link 
              href="/settings" 
              className="flex items-center space-x-3 px-3 py-2 text-sidebar-accent-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5" />
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
          <Link 
            href="/dashboard"
            className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Record Audio</h1>
          <p className="text-muted-foreground">Live audio recording!</p>
        </div>

        {/* Audio Recording Interface */}
        <div className="max-w-2xl mx-auto">
          {/* Microphone Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-3">
              Microphone
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full p-3 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
            >
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                </option>
              ))}
            </select>
          </div>

          {/* Audio Waveform Display */}
          <div className="mb-6">
            <div className="w-full h-48 bg-muted rounded-lg border border-border flex items-center justify-center">
              {isRecording ? (
                <div className="text-center">
                  <div className="w-32 h-16 bg-purple-600/20 rounded-lg flex items-center justify-center mb-2">
                    <div className="w-1 h-8 bg-purple-500 rounded-full animate-pulse"></div>
                  </div>
                  <p className="text-sm text-muted-foreground">Recording in progress...</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Mic className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Click Start Recording to begin</p>
                </div>
              )}
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex space-x-4 mb-6">
            {!isRecording ? (
              <Button 
                onClick={startRecording}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-medium"
              >
                <Mic className="h-5 w-5 mr-2" />
                Start Recording
              </Button>
            ) : (
              <>
                <Button 
                  onClick={pauseRecording}
                  variant="outline"
                  className="flex-1 bg-muted border-border text-foreground hover:bg-muted/80 py-4 text-lg font-medium"
                >
                  {isPaused ? <Play className="h-5 w-5 mr-2" /> : <Pause className="h-5 w-5 mr-2" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button 
                  onClick={stopRecording}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 text-lg font-medium"
                >
                  <Square className="h-5 w-5 mr-2" />
                  Stop
                </Button>
              </>
            )}
          </div>

          {/* Recording Timer */}
          {isRecording && (
            <div className="text-center">
              <p className="text-muted-foreground">
                Recording <span className="inline-block w-2 h-2 bg-red-500 rounded-full mx-2"></span>
                <span className="text-red-500 font-semibold">{formatTime(recordingTime)}</span>
              </p>
            </div>
          )}
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