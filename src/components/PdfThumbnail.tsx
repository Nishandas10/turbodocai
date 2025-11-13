"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { FileText } from "lucide-react"

// Dynamically import react-pdf components to avoid SSR issues
const PDFDocument = dynamic(() => import("react-pdf").then(mod => ({ default: mod.Document })), {
  ssr: false,
  loading: () => <div className="text-xs text-muted-foreground">Loading PDF…</div>
})

const PDFPage = dynamic(() => import("react-pdf").then(mod => ({ default: mod.Page })), {
  ssr: false
})

interface PdfThumbnailProps {
  fileUrl: string
  className?: string
}

export default function PdfThumbnail({ fileUrl, className }: PdfThumbnailProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState<number>(160)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Only render after client mount to avoid SSR
  useEffect(() => {
    setMounted(true)
    
    // Configure PDF.js worker on client side only
    import("react-pdf").then(({ pdfjs }) => {
      try {
        (pdfjs as { GlobalWorkerOptions: { workerSrc?: string } }).GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString()
      } catch {
        // Fallback - react-pdf can inline worker
      }
    })
  }, [])

  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const update = () => setWidth(Math.max(120, Math.min(320, el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Reset error when URL changes
  useEffect(() => { setError(null) }, [fileUrl])

  // Show fallback during SSR or before mount
  if (!mounted) {
    return (
      <div className={className ?? "absolute inset-0"}>
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={className ?? "absolute inset-0"}>
      <div className="w-full h-full flex items-center justify-center bg-muted overflow-hidden">
        <PDFDocument
          key={fileUrl}
          file={fileUrl}
          loading={<div className="text-xs text-muted-foreground">Loading…</div>}
          onLoadError={(error: Error) => setError(error.message || "Failed to load PDF")}
          error={<div className="text-xs text-muted-foreground">{error || "No preview"}</div>}
        >
          <div className="max-h-full max-w-full">
            <PDFPage
              pageNumber={1}
              width={width}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        </PDFDocument>
      </div>
    </div>
  )
}
