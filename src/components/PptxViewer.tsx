"use client";

import React, { useMemo, useState } from "react";

interface PptxViewerProps {
  fileUrl: string;
  className?: string;
}

export default function PptxViewer({ fileUrl, className }: PptxViewerProps) {
  const [zoom, setZoom] = useState(1);
  const viewerUrl = useMemo(() => {
    try {
      const u = new URL(fileUrl);
      // Ensure Firebase Storage uses raw media response for viewers
      if (u.hostname.includes("firebasestorage.googleapis.com")) {
        if (!u.searchParams.has("alt")) u.searchParams.set("alt", "media");
        // Hint inline display (some viewers respect this)
        if (!u.searchParams.has("response-content-disposition")) {
          u.searchParams.set("response-content-disposition", "inline");
        }
      }
      return u.toString();
    } catch {
      return fileUrl;
    }
  }, [fileUrl]);
  const encoded = useMemo(() => encodeURIComponent(viewerUrl), [viewerUrl]);
  const googleEmbed = useMemo(
    () => `https://docs.google.com/gview?url=${encoded}&embedded=true`,
    [encoded]
  );

  const zoomIn = () => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10));
  const zoomOut = () => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10));
  const resetZoom = () => setZoom(1);

  return (
    <div className={`flex flex-col w-full h-full ${className || ""}`.trim()}>
      {/* Toolbar */}
      <div className="shrink-0 border-b border-border px-3 py-2 bg-muted/40 flex items-center gap-2">
        <button
          onClick={zoomOut}
          className="px-2 py-1 text-sm rounded border border-border bg-background hover:bg-muted"
          aria-label="Zoom out"
        >
          -
        </button>
        <div className="px-2 text-sm tabular-nums">{Math.round(zoom * 100)}%</div>
        <button
          onClick={zoomIn}
          className="px-2 py-1 text-sm rounded border border-border bg-background hover:bg-muted"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={resetZoom}
          className="ml-2 px-2 py-1 text-sm rounded border border-border bg-background hover:bg-muted"
          aria-label="Reset zoom"
        >
          Reset
        </button>
        <div className="flex-1" />
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="px-2 py-1 text-sm rounded border border-border bg-blue-600 text-white hover:bg-blue-700"
        >
          Download PPTX
        </a>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-background">
        {/* Zoom wrapper: scale iframe; compensate width to keep scroll usable */}
        <div
          className="w-full h-full flex items-start justify-center p-4"
          style={{
            // container just centers the scaled frame
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: `${100 / zoom}%`,
            }}
            className="shadow-sm border border-border bg-white"
          >
            <iframe
              key={googleEmbed}
              src={googleEmbed}
              title="PPTX Preview"
              className="w-[1200px] h-[800px] bg-white"
              allowFullScreen
            />
          </div>
        </div>
        {/* Helpers */}
        <div className="px-4 pb-3 text-center text-xs text-muted-foreground">
          If the preview doesn’t load, try
          {" "}
          <a
            href={viewerUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline"
          >
            opening the file directly
          </a>
          .
        </div>
      </div>
    </div>
  );
}
