"use client";

import React, { useEffect, useState } from "react";

export default function DocxViewer({ fileUrl, className }: { fileUrl: string; className?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: NodeJS.Timeout;
    
    (async () => {
      setLoading(true);
      setError(null);
      setHtmlContent("");
      
      // Set a timeout to prevent infinite loading
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setError("Loading timeout - DOCX file may be too large or corrupted");
          setLoading(false);
        }
      }, 30000); // 30 second timeout
      
      try {
        console.log("DocxViewer: Starting to fetch file:", fileUrl);
        const res = await fetch(fileUrl, { cache: "reload" });
        if (!res.ok) throw new Error(`Failed to fetch DOCX file: ${res.status} ${res.statusText}`);
        
        console.log("DocxViewer: File fetched, converting to buffer...");
        const buf = await res.arrayBuffer();
        console.log("DocxViewer: Buffer size:", buf.byteLength, "bytes");
        
        if (cancelled) return;
        
        console.log("DocxViewer: Loading mammoth module...");
        const mammoth = await import("mammoth");
        console.log("DocxViewer: Module loaded, converting to HTML...");
        
        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer: buf }, {
          convertImage: mammoth.images.imgElement((image) => {
            return image.read("base64").then((imageBuffer) => {
              return {
                src: `data:${image.contentType};base64,${imageBuffer}`
              };
            });
          })
        });
        
        console.log("DocxViewer: Conversion complete, HTML length:", result.value.length);
        if (result.messages && result.messages.length > 0) {
          console.log("DocxViewer: Conversion messages:", result.messages);
        }
        
        clearTimeout(timeoutId);
        if (!cancelled) {
          setHtmlContent(result.value);
          setLoading(false);
        }
      } catch (e: any) {
        console.error("DocxViewer error:", e);
        clearTimeout(timeoutId);
        if (!cancelled) {
          setError(e?.message || "Failed to render DOCX");
          setLoading(false);
        }
      }
    })();
    
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fileUrl]);

  if (loading) {
    return (
      <div className={"h-full w-full flex items-center justify-center text-muted-foreground " + (className || "")}>
        <div className="text-center">
          <div>Loading DOCX…</div>
          <div className="text-xs mt-2 opacity-70">Converting document to HTML</div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={"h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground " + (className || "")}>
        <div>
          <div className="font-medium mb-1">Preview not available</div>
          <div className="text-sm">{error}</div>
          <div className="text-xs opacity-70 mt-2">Try downloading and opening locally, or check browser console for details.</div>
        </div>
      </div>
    );
  }
  
  const clampZoom = (z: number) => Math.max(0.5, Math.min(2.0, Number(z.toFixed(2))));
  const zoomOut = () => setZoom((z) => clampZoom(z - 0.1));
  const zoomIn = () => setZoom((z) => clampZoom(z + 0.1));
  const resetZoom = () => setZoom(1);

  return (
    <div className={("h-full w-full flex flex-col " + (className || "")).trim()}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background">
        <div className="text-sm font-medium">Document preview</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={zoomOut}
            className="h-8 px-3 rounded border bg-card hover:bg-accent text-sm"
            aria-label="Zoom out"
            title="Zoom out"
          >
            –
          </button>
          <div className="text-sm w-16 text-center tabular-nums">{Math.round(zoom * 100)}%</div>
          <button
            type="button"
            onClick={zoomIn}
            className="h-8 px-3 rounded border bg-card hover:bg-accent text-sm"
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="h-8 px-3 rounded border bg-card hover:bg-accent text-sm"
            aria-label="Reset zoom"
            title="Reset zoom"
          >
            Reset
          </button>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="h-8 px-3 rounded border bg-card hover:bg-accent text-sm"
            title="Download original"
          >
            Download
          </a>
        </div>
      </div>

      {/* Scrollable canvas */}
      <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
        <div className="py-6 flex justify-center">
          {/* Page-like wrapper */}
          <div
            className="shadow-sm rounded-sm bg-white border max-w-4xl w-full"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
              // When scaling down, keep logical width to avoid cutting content; parent centered
              width: `${100 / zoom}%`,
            }}
          >
            <div className="docx-content prose prose-neutral max-w-none px-8 py-8">
              {/* Rendered HTML */}
              <div
                dangerouslySetInnerHTML={{ __html: htmlContent }}
                style={{
                  fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans, sans-serif",
                  lineHeight: 1.65,
                  fontSize: 16,
                  color: "#111827",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scoped styles to enhance typical DOCX elements */}
      <style jsx global>{`
        .docx-content h1 { font-size: 1.875rem; line-height: 2.25rem; margin: 1.2em 0 0.6em; font-weight: 700; }
        .docx-content h2 { font-size: 1.5rem; line-height: 2rem; margin: 1.1em 0 0.55em; font-weight: 700; }
        .docx-content h3 { font-size: 1.25rem; line-height: 1.75rem; margin: 1em 0 0.5em; font-weight: 600; }
        .docx-content h4 { font-size: 1.125rem; line-height: 1.6rem; margin: 0.9em 0 0.45em; font-weight: 600; }
        .docx-content p { margin: 0.7em 0; }
        .docx-content ul, .docx-content ol { padding-left: 1.4em; margin: 0.7em 0; }
        .docx-content li { margin: 0.3em 0; }
        .docx-content table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.95em; }
        .docx-content th, .docx-content td { border: 1px solid #e5e7eb; padding: 0.5em 0.6em; vertical-align: top; }
        .docx-content th { background: #f9fafb; font-weight: 600; }
        .docx-content img { max-width: 100%; height: auto; display: inline-block; }
        .docx-content blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; margin: 1em 0; color: #374151; }
        .docx-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.2em 0; }
        .docx-content a { color: #2563eb; text-decoration: underline; }
        .docx-content code { background: #f3f4f6; padding: 0.15em 0.35em; border-radius: 4px; }
        .docx-content pre { background: #0b1020; color: #e5e7eb; padding: 0.8em; border-radius: 6px; overflow: auto; }
      `}</style>
    </div>
  );
}
