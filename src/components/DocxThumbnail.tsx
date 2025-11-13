"use client"

import { useEffect, useRef, useState } from "react"

interface DocxThumbnailProps {
  fileUrl: string
  className?: string
}

// Lightweight DOCX thumbnail that converts to HTML (using dynamic import of mammoth)
// and renders the first chunk within a small, clipped area.
export default function DocxThumbnail({ fileUrl, className }: DocxThumbnailProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState<number>(200)
  const [html, setHtml] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const update = () => setWidth(Math.max(120, Math.min(480, el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setError(null)
        setHtml("")
        const res = await fetch(fileUrl, { cache: "reload" })
        if (!res.ok) throw new Error("Failed to fetch DOCX")
        const buf = await res.arrayBuffer()
        const mammoth = await import("mammoth")
        const result = await mammoth.convertToHtml({ arrayBuffer: buf })
        if (cancelled) return
        // Keep only the first ~800 characters to limit cost
        const trimmed = result.value.slice(0, 1200)
        setHtml(trimmed)
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Preview not available"
          setError(message)
        }
      }
    })()
    return () => { cancelled = true }
  }, [fileUrl])

  return (
    <div ref={wrapRef} className={className ?? "absolute inset-0"}>
      <div className="absolute inset-0 bg-white overflow-hidden border border-border/50">
        {html ? (
          <div
            className="p-3 text-[10px] leading-4 text-foreground/90"
            style={{ transform: `scale(${Math.max(0.6, Math.min(1, width/320))})`, transformOrigin: "top left" }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] text-muted-foreground">
            {error ? error : "Loading…"}
          </div>
        )}
      </div>
    </div>
  )
}
