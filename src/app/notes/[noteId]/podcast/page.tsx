"use client"

import { useState, useRef } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, Headphones } from 'lucide-react'

export default function PodcastPage() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
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

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <Headphones className="h-6 w-6 text-purple-600" />
          <h1 className="text-xl font-semibold text-foreground">Podcast</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Listen to AI-generated audio summaries of your notes
        </p>
      </div>

      {/* Podcast Content */}
      <div className="flex-1 p-4">
        {/* Podcast Info */}
        <div className="bg-muted rounded-lg p-6 mb-6">
          <div className="text-center">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Headphones className="h-16 w-16 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              AI-Generated Podcast
            </h2>
            <p className="text-muted-foreground mb-4">
              Your notes transformed into an engaging audio experience
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
              <span>Duration: 15:30</span>
              <span>•</span>
              <span>AI Narrated</span>
            </div>
          </div>
        </div>

        {/* Audio Controls */}
        <div className="bg-muted rounded-lg p-6">
          <audio
            ref={audioRef}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            className="hidden"
          />
          
          {/* Progress Bar */}
          <div className="mb-4">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-center space-x-6 mb-6">
            <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <SkipBack className="h-6 w-6 text-foreground" />
            </button>
            <button
              onClick={handlePlayPause}
              className="w-16 h-16 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-8 w-8 text-white" />
              ) : (
                <Play className="h-8 w-8 text-white ml-1" />
              )}
            </button>
            <button className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <SkipForward className="h-6 w-6 text-foreground" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="text-sm text-muted-foreground w-12">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Episode Notes */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">Episode Notes</h3>
          <div className="bg-muted rounded-lg p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-foreground">
                Introduction to the main topics covered in your notes
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-foreground">
                Key concepts and important points highlighted
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
              <p className="text-sm text-foreground">
                Summary and actionable insights from your notes
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 