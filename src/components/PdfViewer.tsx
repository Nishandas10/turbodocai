"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Document as PDFDocument, Page, pdfjs } from "react-pdf";
import { Loader2 } from "lucide-react";

// Optional but recommended for selectable text and annotations
// These imports are safe in Next.js and only affect client bundles
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

interface PDFViewerProps {
  fileUrl: string;
  className?: string;
}

export default function PDFViewer({ fileUrl, className }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [width, setWidth] = useState<number>(800);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [isZooming, setIsZooming] = useState<boolean>(false);
  const zoomTimerRef = useRef<number | null>(null);

  // Configure PDF.js worker
  useEffect(() => {
    try {
      // ESM worker path for pdfjs-dist >= 3.x
      (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    } catch {
      // Fallback for environments where new URL may fail; react-pdf can still inline worker
    }
  }, []);

  // Track container width responsively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const markZoomActivity = useCallback(() => {
    setIsZooming(true);
    if (zoomTimerRef.current) {
      window.clearTimeout(zoomTimerRef.current);
    }
    zoomTimerRef.current = window.setTimeout(() => {
      setIsZooming(false);
      zoomTimerRef.current = null;
    }, 250);
  }, []);

  const zoomIn = useCallback(() => {
    markZoomActivity();
    setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)));
  }, [markZoomActivity]);
  const zoomOut = useCallback(() => {
    markZoomActivity();
    setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)));
  }, [markZoomActivity]);
  const resetZoom = useCallback(() => {
    markZoomActivity();
    setZoom(1);
  }, [markZoomActivity]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Ctrl + Wheel to zoom; otherwise allow normal scroll
    if (e.ctrlKey) {
      e.preventDefault();
      markZoomActivity();
      if (e.deltaY > 0) zoomOut();
      else zoomIn();
    }
  }, [zoomIn, zoomOut, markZoomActivity]);

  const renderWidth = Math.max(320, Math.min(2000, (width - 24) * zoom));

  return (
    <div ref={containerRef} className={className ?? "h-full w-full bg-background"}>
      <div className="h-full w-full flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-border px-3 py-2 flex items-center gap-2 bg-card text-card-foreground">
          <span className="text-sm opacity-80">Zoom:</span>
          <button className="px-2 py-1 rounded bg-muted hover:bg-muted/70" onClick={zoomOut} title="Zoom out">−</button>
          <div className="min-w-[48px] text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</div>
          <button className="px-2 py-1 rounded bg-muted hover:bg-muted/70" onClick={zoomIn} title="Zoom in">+</button>
          <button className="ml-2 px-2 py-1 rounded bg-muted hover:bg-muted/70 text-xs" onClick={resetZoom} title="Reset zoom">Reset</button>
          <div className="ml-auto text-xs opacity-70">Pages: {numPages || "–"}</div>
        </div>

        {/* Scrollable pages */}
        <div className="flex-1 overflow-auto" onWheel={onWheel}>
      <PDFDocument
        key={fileUrl}
        file={fileUrl}
        onLoadSuccess={(info) => {
          setNumPages(info.numPages);
          setError(null);
        }}
        onLoadError={(e) => setError(e?.message || "Failed to load PDF")}
        loading={
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading PDF...
          </div>
        }
        error={
          <div className="p-4 text-sm text-red-500">
            {error || "Failed to load PDF"}
          </div>
        }
      >
        <div className="mx-auto max-w-full">
          {Array.from(new Array(numPages), (_el, index) => (
            <div key={`page_${index + 1}`} className="mb-4 flex justify-center">
              <Page
                pageNumber={index + 1}
                width={renderWidth}
                renderTextLayer={!isZooming}
                renderAnnotationLayer
                onRenderError={(err: unknown) => {
                  // Ignore task aborts that happen during unmount/navigation
                  const name = (err as { name?: string } | null)?.name;
                  if (name === "AbortException") return;
                  console.error(err);
                }}
                onLoadError={(err: unknown) => {
                  const name = (err as { name?: string } | null)?.name;
                  if (name === "AbortException") return;
                  console.error(err);
                }}
              />
            </div>
          ))}
        </div>
      </PDFDocument>
        </div>
      </div>
    </div>
  );
}
