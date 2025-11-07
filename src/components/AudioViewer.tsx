"use client";

import { useEffect, useState } from "react";
import { getFileDownloadURL } from "@/lib/storage";

interface AudioViewerProps {
  storagePath?: string | null; // Prefer explicit storagePath from metadata
  fallbackUrl?: string | null; // If a direct downloadURL already exists
  fileName?: string | null;
  className?: string;
}

/**
 * AudioViewer: Streams/playbacks original uploaded audio files (e.g., recordings) in notes chat preview.
 * - Prefers provided downloadURL (fallbackUrl) if available.
 * - Otherwise resolves Firebase Storage download URL from storagePath.
 * - Provides basic controls + filename + minimal error states.
 */
export default function AudioViewer({
  storagePath,
  fallbackUrl,
  fileName,
  className,
}: AudioViewerProps) {
  const [url, setUrl] = useState<string | null>(fallbackUrl || null);
  const [loading, setLoading] = useState<boolean>(!fallbackUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (fallbackUrl) {
        setLoading(false);
        setUrl(fallbackUrl);
        return;
      }
      if (!storagePath) {
        setLoading(false);
        setError("Missing storage path");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const resolved = await getFileDownloadURL(storagePath);
        if (active) {
          setUrl(resolved);
          setLoading(false);
        }
      } catch {
        if (active) {
          setError("Could not load audio file");
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [storagePath, fallbackUrl]);

  return (
    <div className={"flex flex-col h-full w-full " + (className || "")}>      
      <div className="px-3 py-2 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between">
        <div className="text-sm font-medium text-card-foreground truncate" title={fileName || undefined}>
          {fileName || "Audio"}
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 h-8 rounded-md border border-border text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Download
          </a>
        )}
      </div>
      <div className="flex-1 p-4 overflow-auto flex items-center justify-center">
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading audio…</div>
        ) : error ? (
          <div className="text-center text-muted-foreground text-sm">
            <div className="font-medium mb-1">Audio preview not available</div>
            <div className="text-xs opacity-70">{error}</div>
          </div>
        ) : url ? (
          <div className="w-full max-w-xl flex flex-col items-center gap-4">
            <audio
              controls
              preload="metadata"
              src={url}
              className="w-full"
            >
              Your browser does not support the audio element.
            </audio>
            <div className="text-xs text-muted-foreground w-full truncate" title={fileName || undefined}>{fileName}</div>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">No audio URL found</div>
        )}
      </div>
    </div>
  );
}
