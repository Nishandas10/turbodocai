"use client"

import { useMemo } from "react"

interface WebsiteThumbnailProps {
  url: string
  className?: string
}

// Lightweight website thumbnail: loads the proxied HTML in an iframe and scales it down.
// This gives a visual snapshot feel without needing server-side screenshoting.
export default function WebsiteThumbnail({ url, className }: WebsiteThumbnailProps) {
  const proxyUrl = useMemo(() => `/api/webpage-proxy?url=${encodeURIComponent(url)}`, [url])
  return (
    <div className={className ?? "absolute inset-0"}>
      <div className="absolute inset-0 bg-white overflow-hidden">
        <div
          // Scale page down; enlarge logical area so we see portion of site
          className="w-full h-full"
          style={{ transform: 'scale(0.25)', transformOrigin: 'top left', width: '400%', height: '400%' }}
        >
          <iframe
            src={proxyUrl}
            title="Website preview"
            className="w-[1600px] h-[1200px] bg-white"
            sandbox="allow-same-origin allow-top-navigation-by-user-activation"
          />
        </div>
      </div>
    </div>
  )
}
