"use client"

import { useRef, useState, useEffect } from "react"
import { Play, Pause, Volume2 } from "lucide-react"

interface AudioThumbnailProps {
  audioUrl: string
  className?: string
  title?: string
}

// Audio thumbnail with play icon that auto-plays on hover and pauses on leave
export default function AudioThumbnail({ audioUrl, className, title }: AudioThumbnailProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const [canAutoPlay, setCanAutoPlay] = useState(false)

  // Test autoplay capability on mount
  useEffect(() => {
    const testAutoPlay = async () => {
      const testAudio = new Audio()
      testAudio.volume = 0
      testAudio.muted = true
      try {
        await testAudio.play()
        setCanAutoPlay(true)
        testAudio.pause()
      } catch {
        setCanAutoPlay(false)
      }
    }
    testAutoPlay()
  }, [])

  const handleMouseEnter = async () => {
    const audio = audioRef.current
    if (!audio || error) return
    
    try {
      setIsLoading(true)
      setError(false)
      
      // Reset audio position
      audio.currentTime = 0
      
      // Set a reasonable volume
      audio.volume = 0.7
      audio.muted = false
      
      // Try to play
      const playPromise = audio.play()
      if (playPromise !== undefined) {
        await playPromise
        setIsPlaying(true)
      }
    } catch (e) {
      console.warn('Audio hover play failed:', e)
      // Don't set error immediately - user might need to interact first
      if (!canAutoPlay) {
        console.info('Autoplay blocked - user interaction required')
      } else {
        setError(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleMouseLeave = () => {
    const audio = audioRef.current
    if (!audio) return
    
    try {
      audio.pause()
      audio.currentTime = 0
    } catch (e) {
      console.warn('Audio pause failed:', e)
    }
    setIsPlaying(false)
    setIsLoading(false)
  }

  const handleLoadError = (e: any) => {
    console.warn('Audio load error:', e, 'URL:', audioUrl)
    setError(true)
    setIsLoading(false)
    setIsPlaying(false)
  }

  const handleCanPlay = () => {
    setIsLoading(false)
    setError(false)
  }

  const handlePlay = () => {
    setIsPlaying(true)
    setIsLoading(false)
  }

  const handlePause = () => {
    setIsPlaying(false)
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    const audio = audioRef.current
    if (!audio) return
    
    if (isPlaying) {
      audio.pause()
    } else {
      try {
        audio.currentTime = 0
        audio.volume = 0.7
        audio.muted = false
        await audio.play()
      } catch (e) {
        console.warn('Audio click play failed:', e)
        setError(true)
      }
    }
  }

  return (
    <div 
      className={className ?? "absolute inset-0"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 flex flex-col items-center justify-center">
        {/* Audio element (hidden but functional) */}
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onError={handleLoadError}
          onLoadStart={() => setIsLoading(true)}
          onCanPlay={handleCanPlay}
          onPlay={handlePlay}
          onPause={handlePause}
          crossOrigin="anonymous"
        />
        
        {/* Visual indicator */}
        <div className="relative">
          {error ? (
            <Volume2 className="h-12 w-12 text-muted-foreground/50" />
          ) : isLoading ? (
            <div className="h-12 w-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-12 w-12 text-purple-600 animate-pulse" />
          ) : (
            <Play className="h-12 w-12 text-purple-600" />
          )}
        </div>
        
        {/* Audio label */}
        <div className="mt-2 text-center px-2">
          <p className="text-[10px] font-medium text-purple-700 dark:text-purple-300 truncate max-w-full">
            {title || 'Audio'}
          </p>
          <p className="text-[9px] text-muted-foreground">
            {error ? 'Load failed' : isPlaying ? 'Playing...' : canAutoPlay ? 'Hover to play' : 'Click to play'}
          </p>
        </div>
      </div>
    </div>
  )
}
