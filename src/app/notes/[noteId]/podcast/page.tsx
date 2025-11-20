"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Headphones, Loader2, Download } from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { generatePodcast as generatePodcastApi } from '@/lib/ragService'
import SummaryRating from '@/components/SummaryRating'
import { createFeedback } from '@/lib/firestore'

export default function PodcastPage() {
  const params = useParams()
  const { user } = useAuth()
  const noteId = params?.noteId as string
  const search = useSearchParams()
  const ownerFromUrl = search?.get('owner') || undefined
  const [effOwner, setEffOwner] = useState<string | undefined>(ownerFromUrl)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [summary, setSummary] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [podcastRating, setPodcastRating] = useState<number | undefined>(undefined)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  const handlePodcastRating = useCallback(async (rating: number) => {
    if (!user?.uid || !noteId) return
    setPodcastRating(rating)
    setRatingSubmitting(true)
    try {
      await createFeedback(user.uid, user.email || '', 'podcast', rating, '')
    } catch (e) {
      console.warn('Failed to save podcast rating', e)
    } finally {
      setRatingSubmitting(false)
    }
  }, [user?.uid, user?.email, noteId])

  // Resolve and persist effective owner for shared links
  useEffect(() => {
    try {
      if (noteId && ownerFromUrl) {
        localStorage.setItem(`doc_owner_${noteId}`, ownerFromUrl)
        setEffOwner(ownerFromUrl)
      } else if (noteId && !ownerFromUrl) {
        const stored = localStorage.getItem(`doc_owner_${noteId}`) || undefined
        if (stored) setEffOwner(stored)
        else setEffOwner(user?.uid)
      }
    } catch {
      setEffOwner(ownerFromUrl || user?.uid)
    }
  }, [noteId, ownerFromUrl, user?.uid])

  useEffect(() => {
    const targetUser = effOwner || user?.uid
    if (!noteId || !targetUser) return
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await generatePodcastApi({ documentId: noteId, userId: targetUser })
        setAudioUrl(res.audioUrl)
        setSummary(res.summary)
      } catch (e) {
        console.error('Podcast generation failed', e)
        // For shared docs, permission errors or missing cache shouldn't hard-fail UI
        setError('Failed to generate podcast audio')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [noteId, effOwner, user?.uid])

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      audioRef.current.volume = volume
      audioRef.current.muted = isMuted
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume
    }
  }

  const toggleMute = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    if (audioRef.current) {
      audioRef.current.muted = nextMuted
    }
  }

  const skipSeconds = (secs: number) => {
    if (!audioRef.current) return
    const target = Math.min(Math.max(0, (audioRef.current.currentTime || 0) + secs), duration || 0)
    audioRef.current.currentTime = target
    setCurrentTime(target)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-gradient-to-b from-background to-background/60">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 grid place-items-center">
                <Headphones className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Podcast</h1>
                <p className="text-xs text-muted-foreground">AI-generated audio summaries of your notes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SummaryRating
                value={podcastRating}
                onChange={handlePodcastRating}
                disabled={!user?.uid || !noteId}
                loading={ratingSubmitting}
                label="Rate this podcast:"
              />
              {audioUrl && (
                <a
                  href={audioUrl}
                  download
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Hero / Info */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-purple-500/15 via-purple-600/10 to-blue-600/10 p-6 md:p-8 mb-6">
          <div className="absolute right-[-40px] top-[-40px] h-40 w-40 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 opacity-20 blur-2xl" />
          <div className="text-center relative">
            <div className="w-28 h-28 md:w-32 md:h-32 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-purple-900/10">
              <Headphones className="h-14 w-14 md:h-16 md:w-16 text-white" />
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-2">AI-Generated Podcast</h2>
            <p className="text-sm text-muted-foreground mb-4">Your notes transformed into an engaging audio experience</p>
            <div className="flex items-center justify-center gap-3 text-xs md:text-sm text-muted-foreground">
              <span>Duration: {duration ? formatTime(duration) : '—'}</span>
              <span>•</span>
              <span>AI Narrated</span>
            </div>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="rounded-xl border border-border bg-card p-5 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Preparing audio...
            </div>
          ) : error ? (
            <div className="text-red-600 text-center py-4">{error}</div>
          ) : (
            <audio
              ref={audioRef}
              src={audioUrl || undefined}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}

          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-xs md:text-sm text-muted-foreground mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mb-6">
            <button
              onClick={() => skipSeconds(-10)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              title="Back 10s"
            >
              <SkipBack className="h-6 w-6 text-foreground" />
            </button>
            <button
              onClick={handlePlayPause}
              disabled={!audioUrl || loading}
              className="w-16 h-16 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-full flex items-center justify-center transition-colors shadow-lg shadow-purple-900/20"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="h-8 w-8 text-white" />
              ) : (
                <Play className="h-8 w-8 text-white ml-1" />
              )}
            </button>
            <button
              onClick={() => skipSeconds(10)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              title="Forward 10s"
            >
              <SkipForward className="h-6 w-6 text-foreground" />
            </button>
            <button
              onClick={toggleMute}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="h-6 w-6 text-foreground" />
              ) : (
                <Volume2 className="h-6 w-6 text-foreground" />
              )}
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3">
            <span className="text-xs md:text-sm text-muted-foreground w-12">Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 accent-purple-600 cursor-pointer"
            />
            <span className="text-xs md:text-sm text-muted-foreground w-12 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Episode Notes / Summary */}
        <div className="mt-6">
          <h3 className="text-base md:text-lg font-semibold text-foreground mb-3">Episode Notes</h3>
          <div className="rounded-xl border border-border bg-card p-4 md:p-5 space-y-3">
            {loading ? (
              <div className="text-sm text-muted-foreground">Generating summary...</div>
            ) : summary ? (
              <p className="text-sm md:text-[0.95rem] leading-6 text-foreground whitespace-pre-wrap">{summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No summary available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 