"use client"

import { useMemo } from "react"

interface PptxThumbnailProps {
  fileUrl: string
  className?: string
}

export default function PptxThumbnail({ fileUrl, className }: PptxThumbnailProps) {
  const viewerUrl = useMemo(() => {
    try {
      const u = new URL(fileUrl)
      if (u.hostname.includes("firebasestorage.googleapis.com")) {
        if (!u.searchParams.has("alt")) u.searchParams.set("alt", "media")
        if (!u.searchParams.has("response-content-disposition")) {
          u.searchParams.set("response-content-disposition", "inline")
        }
      }
      return u.toString()
    } catch { return fileUrl }
  }, [fileUrl])
  const embed = useMemo(() => `https://docs.google.com/gview?url=${encodeURIComponent(viewerUrl)}&embedded=true`, [viewerUrl])

  return (
    <div className={className ?? "absolute inset-0"}>
      <div className="absolute inset-0 bg-white overflow-hidden">
        {/* Scale the big embed to fit thumbnail space */}
        <div className="w-full h-full" style={{ transform: "scale(0.25)", transformOrigin: "top left", width: "400%", height: "400%" }}>
          <iframe
            key={embed}
            src={embed}
            title="PPTX preview"
            className="w-[1200px] h-[800px] bg-white"
          />
        </div>
      </div>
    </div>
  )
}
