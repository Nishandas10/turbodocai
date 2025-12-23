"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react";

type PodcastPlayerProps = {
  /** Current audio blob URL */
  audioUrl: string | null;
  /** MIME type for the current audio URL (e.g., audio/wav or audio/mpeg) */
  audioMimeType?: string | null;
  /** Section title for display */
  title?: string;
  /** Thumbnail image (base64 or URL) */
  thumbnail?: string | null;
  /** Whether audio is currently loading */
  isLoading?: boolean;
  /** Callback when user wants to go to previous section */
  onPrevious?: () => void;
  /** Callback when user wants to go to next section */
  onNext?: () => void;
  /** Whether previous button should be disabled */
  canGoPrevious?: boolean;
  /** Whether next button should be disabled */
  canGoNext?: boolean;
};

export default function PodcastPlayer({
  audioUrl,
  audioMimeType,
  title = "Podcast",
  thumbnail,
  isLoading = false,
  onPrevious,
  onNext,
  canGoPrevious = true,
  canGoNext = true,
}: PodcastPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<HTMLSourceElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);

  // Load audio when URL changes
  useEffect(() => {
    const audio = audioRef.current;
    const source = sourceRef.current;
    if (!audio || !source || !audioUrl) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    // Reset state for new media
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    const mime = (audioMimeType || "audio/wav").trim();

    // Use explicit <source type> to help browsers decode blob URLs.
    source.src = audioUrl;
    source.type = mime;
    
    audio.load();

    // Wait for the audio to be ready before attempting to play
    const attemptPlay = () => {
      audio.play().then(
        () => {
          setIsPlaying(true);
        },
        () => {
          setIsPlaying(false);
        }
      );
    };

    // Try to play once data is loaded
    if (audio.readyState >= 2) {
      // HAVE_CURRENT_DATA or better
      attemptPlay();
    } else {
      const onCanPlay = () => {
        attemptPlay();
        audio.removeEventListener("canplay", onCanPlay);
      };
      audio.addEventListener("canplay", onCanPlay);
    }
  }, [audioUrl, audioMimeType]);

  // Setup event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (canGoNext && onNext) {
        onNext();
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [canGoNext, onNext]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Don't show player if no audio
  if (!audioUrl && !isLoading) return null;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <audio ref={audioRef} preload="auto">
        <source ref={sourceRef} type="audio/mpeg" />
      </audio>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        {/* Progress bar */}
        <div className="mb-3">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            disabled={!audioUrl || isLoading}
            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1A1A1A]"
            style={{
              background: audioUrl
                ? `linear-gradient(to right, #1A1A1A 0%, #1A1A1A ${
                    progressPct
                  }%, #E5E5E5 ${progressPct}%, #E5E5E5 100%)`
                : "#E5E5E5",
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Player controls */}
        <div className="flex items-center gap-4">
          {/* Thumbnail & Title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    thumbnail.startsWith("data:")
                      ? thumbnail
                      : `data:image/png;base64,${thumbnail}`
                  }
                  alt="Podcast thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl">
                  🎓
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {title}
              </p>
              {isLoading && (
                <p className="text-xs text-gray-500">Generating audio...</p>
              )}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onPrevious}
              disabled={!canGoPrevious || !audioUrl || isLoading}
              className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous section"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlayPause}
              disabled={!audioUrl || isLoading}
              className="p-3 rounded-full bg-[#1A1A1A] text-white hover:bg-[#2A2A2A] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>

            <button
              onClick={onNext}
              disabled={!canGoNext || !audioUrl || isLoading}
              className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next section"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Speed & Volume controls */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleSpeedChange}
              disabled={!audioUrl || isLoading}
              className="px-3 py-1 text-sm font-medium border border-gray-300 rounded-full hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Playback speed"
            >
              {playbackRate}x
            </button>

            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-gray-500" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                disabled={!audioUrl || isLoading}
                className="w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1A1A1A]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
