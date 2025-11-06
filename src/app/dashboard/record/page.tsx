"use client"

import { useState, useRef, useEffect } from "react"
import { 
  ChevronLeft,
  FileText,
  Mic,
  Play,
  ArrowRight,
  Search,
  Pause,
  Square
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import ProtectedRoute from "@/components/ProtectedRoute"
import DashboardSidebar from "@/components/DashboardSidebar"
import { useAuth } from "@/contexts/AuthContext"
import { uploadRecordingFile } from "@/lib/fileUploadService"
import { waitAndGenerateSummary } from "@/lib/ragService"
import { useRouter } from "next/navigation"

export default function RecordPage() {
  const { user } = useAuth()
  const router = useRouter()
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
  const [recordedDuration, setRecordedDuration] = useState<number | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>("")
  const [optimisticProgress, setOptimisticProgress] = useState<number>(0)
  const [processingProgress, setProcessingProgress] = useState<number | null>(null)
  const [optimisticTimerActive, setOptimisticTimerActive] = useState<boolean>(false)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  // High-accuracy duration tracking
  const activeStartRef = useRef<number | null>(null) // performance.now() when actively recording
  const totalMsRef = useRef<number>(0) // accumulated active ms across pause/resume

  // Waveform visualizer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)

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

  // Timer effect - compute from wall clock for accuracy (handles long recordings and background tabs)
  useEffect(() => {
    if (isRecording && !isPaused) {
      // Update UI more frequently for responsiveness
      intervalRef.current = setInterval(() => {
        const now = performance.now()
        let total = totalMsRef.current
        if (activeStartRef.current !== null) total += now - activeStartRef.current
        setRecordingTime(Math.floor(total / 1000))
      }, 250)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
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
      
      const options: MediaRecorderOptions = {}
      // Prefer webm/opus when available
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm'
      }
      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Assemble blob
        const mime = (options.mimeType as string) || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mime })
        setRecordedBlob(blob)
        // duration is finalized in stopRecording, avoid overriding here
        chunksRef.current = []
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      setIsPaused(false)
  setRecordingTime(0)
      setRecordedBlob(null)
      setRecordedDuration(null)
  // initialize accurate duration tracking
  totalMsRef.current = 0
  activeStartRef.current = performance.now()
      
      // Setup waveform visualizer
      try {
        const W = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
        const AudioContextClass = W.AudioContext || W.webkitAudioContext
        if (!AudioContextClass) throw new Error('Web Audio API is not supported in this browser')
  const audioContext = new AudioContextClass()
        audioContextRef.current = audioContext
  // ensure context is running on first user gesture
  try { await audioContext.resume() } catch {}
        const source = audioContext.createMediaStreamSource(stream)
        sourceRef.current = source
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        analyserRef.current = analyser
        source.connect(analyser)

        const draw = () => {
          const canvas = canvasRef.current
          const analyserNode = analyserRef.current
          if (!canvas || !analyserNode) return
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          const WIDTH = canvas.width
          const HEIGHT = canvas.height
          ctx.clearRect(0, 0, WIDTH, HEIGHT)

          const bufferLength = analyserNode.fftSize
          const dataArray = new Uint8Array(bufferLength)
          analyserNode.getByteTimeDomainData(dataArray)

          ctx.lineWidth = 2
          ctx.strokeStyle = '#a78bfa' // purple-400
          ctx.beginPath()

          const sliceWidth = WIDTH / bufferLength
          let x = 0
          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0
            const y = (v * HEIGHT) / 2
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
            x += sliceWidth
          }
          ctx.lineTo(WIDTH, HEIGHT / 2)
          ctx.stroke()

          rafRef.current = requestAnimationFrame(draw)
        }
        rafRef.current = requestAnimationFrame(draw)
      } catch (e) {
        console.warn('Audio visualizer setup failed:', e)
      }
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
        // resume timing
        activeStartRef.current = performance.now()
      } else {
        mediaRecorderRef.current.pause()
        setIsPaused(true)
        // accumulate elapsed up to this pause
        if (activeStartRef.current !== null) {
          totalMsRef.current += performance.now() - activeStartRef.current
          activeStartRef.current = null
        }
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // finalize accurate duration before stopping recorder
      if (activeStartRef.current !== null) {
        totalMsRef.current += performance.now() - activeStartRef.current
        activeStartRef.current = null
      }
      const finalSeconds = Math.max(0, Math.round(totalMsRef.current / 1000))
      setRecordedDuration(finalSeconds)
      // reset accumulator for next run
      totalMsRef.current = 0

      mediaRecorderRef.current.stop()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      setIsRecording(false)
      setIsPaused(false)
      // Do not reset recordingTime immediately; onstop handler will capture it
      // Cleanup audio context/visualizer
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      try {
        sourceRef.current?.disconnect()
        analyserRef.current?.disconnect()
        audioContextRef.current?.close()
      } catch {}
      sourceRef.current = null
      analyserRef.current = null
      audioContextRef.current = null
      console.log('Recording stopped')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  // Optimistic progress timer similar to DocumentUploadModal
  useEffect(() => {
    if (!optimisticTimerActive) return
    let raf: number | null = null
    let start: number | null = null
    const cap = 90
    const step = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      const duration = 25000
      const t = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.min(cap, Math.round(eased * cap))
      setOptimisticProgress((prev) => (next > prev ? next : prev))
      if (next < cap && optimisticTimerActive) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [optimisticTimerActive])

  const displayProgress = (() => {
    if (typeof processingProgress === 'number') return Math.max(0, Math.min(100, processingProgress))
    return optimisticProgress
  })()

  return (
    <ProtectedRoute>
      <div className="h-screen bg-background flex overflow-hidden">
  {/* Left Sidebar */}
  <DashboardSidebar onSearchClick={openSearchModal} />

        {/* Main Content */}
  <div className="flex-1 p-8 overflow-y-auto">
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
              <div className="w-full h-48 bg-muted rounded-lg border border-border flex items-center justify-center overflow-hidden">
                {isRecording ? (
                  <div className="relative w-full h-full">
                    <canvas ref={canvasRef} className="w-full h-full" width={800} height={192} />
                    <div className="absolute top-2 left-2 text-sm text-muted-foreground bg-background/60 px-2 py-1 rounded">Recording...</div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground w-full">
                    {recordedBlob ? (
                      <>
                        <Mic className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Ready to upload {recordedDuration ?? 0}s recording</p>
                      </>
                    ) : (
                      <>
                        <Mic className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Click Start Recording to begin</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex space-x-4 mb-6">
              {!isRecording ? (
                recordedBlob ? (
                  <>
                    <Button
                      onClick={startRecording}
                      variant="outline"
                      className="flex-1 bg-muted border-border text-foreground hover:bg-muted/80 py-4 text-lg font-medium"
                      disabled={isUploading}
                    >
                      <Mic className="h-5 w-5 mr-2" />
                      Record Again
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!user) return alert('Please sign in to upload')
                        if (!recordedBlob) return
                        const duration = recordedDuration ?? 0
                        if (duration < 30) {
                          alert('Minimum audio length is 30 seconds to upload')
                          return
                        }
                        try {
                          setIsUploading(true)
                          const uid = user.uid
                          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
                          const fileName = `recording-${timestamp}.webm`
                          const mime = recordedBlob.type || 'audio/webm'
                          const file = new File([recordedBlob], fileName, { type: mime })

                          // Create Firestore doc and upload recording to storage
                          const uploadRes = await uploadRecordingFile(file, uid, {
                            title: fileName.replace(/\.[^/.]+$/, ''),
                            tags: ['recording', 'audio']
                          })
                          if (!uploadRes.success || !uploadRes.documentId) {
                            throw new Error(uploadRes.error || 'Upload failed')
                          }

                          // Show optimistic processing and wait for summary, then redirect to notes
                          setIsProcessing(true)
                          setProcessingStatus('Processing: starting')
                          setOptimisticProgress(0)
                          setOptimisticTimerActive(true)
                          try {
                            await waitAndGenerateSummary(
                              uploadRes.documentId,
                              uid,
                              (status, progress) => {
                                const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : null
                                setProcessingProgress(pct)
                                setProcessingStatus(`Processing: ${status}`)
                              },
                              350
                            )
                            setProcessingProgress(100)
                            setProcessingStatus('Processed! Redirecting...')
                            setTimeout(() => {
                              router.push(`/notes/${uploadRes.documentId}`)
                            }, 800)
                          } catch (e) {
                            console.error('Processing failed:', e)
                            setProcessingStatus('Processing failed or timed out')
                          } finally {
                            setIsProcessing(false)
                            setOptimisticTimerActive(false)
                          }
                          // Reset state
                          setRecordedBlob(null)
                          setRecordedDuration(null)
                          setRecordingTime(0)
                        } catch (e) {
                          console.error(e)
                          alert('Upload failed, please try again')
                        } finally {
                          setIsUploading(false)
                        }
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-medium disabled:opacity-60"
                      disabled={isUploading || (recordedDuration ?? 0) < 30}
                    >
                      {isUploading ? 'Uploading…' : 'Upload Audio'}
                    </Button>
                  </>
                ) : (
                  <Button 
                    onClick={startRecording}
                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-4 text-lg font-medium"
                  >
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
                  </Button>
                )
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
            {(isRecording || recordedBlob) && (
              <div className="text-center">
                <p className="text-muted-foreground">
                  {isRecording ? (
                    <>
                      Recording <span className="inline-block w-2 h-2 bg-red-500 rounded-full mx-2"></span>
                      <span className="text-red-500 font-semibold">{formatTime(recordingTime)}</span>
                    </>
                  ) : (
                    <>
                      Last recording: <span className="font-semibold">{formatTime(recordedDuration ?? 0)}</span> · Minimum 30s to upload
                    </>
                  )}
                </p>
                {(isProcessing || processingStatus) && (
                  <div className="mt-3 p-3 rounded-md border border-border bg-muted/40 max-w-xl mx-auto text-left">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-card-foreground">{processingStatus}</p>
                      <span className="text-xs text-muted-foreground tabular-nums">{Math.round(displayProgress)}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                      <div className="h-full bg-blue-600 transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, displayProgress))}%` }} />
                    </div>
                  </div>
                )}
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
    </ProtectedRoute>
  )
} 