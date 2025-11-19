"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Minus, ExternalLink } from "lucide-react";
// import { getDocument } from "@/lib/firestore";
import type { Document as Doc } from "@/lib/types";
import DocumentChat from "@/components/DocumentChat";
import PDFViewer from "@/components/PdfViewer";
import DocxViewer from "@/components/DocxViewer";
import PptxViewer from "@/components/PptxViewer";
import TxtViewer from "@/components/TxtViewer";
import AudioViewer from "@/components/AudioViewer";
// import { getFileDownloadURL, getUserDocumentsPath } from "@/lib/storage";
import { db } from "@/lib/firebase";
import { doc as fsDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { getFileDownloadURL, getUserDocumentsPath } from "@/lib/storage";

export default function ChatPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const noteId = params.noteId as string;
  const search = useSearchParams();
  const ownerParam = search.get('owner') || undefined;
  const [effOwner, setEffOwner] = useState<string | undefined>(ownerParam);
  const { user } = useAuth();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyingPdf, setVerifyingPdf] = useState<boolean>(false);
  const [verifiedPdfUrl, setVerifiedPdfUrl] = useState<string | null>(null);
  // Split state for resizable panes (0.3 <= split <= 0.7)
  const [split, setSplit] = useState<number>(0.5);
  const draggingRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  // Website preview zoom (0.5x - 2x)
  const [websiteZoom, setWebsiteZoom] = useState<number>(1);
  // Mobile responsive states
  const [isMobile, setIsMobile] = useState<boolean>(false);
  // No mobile view toggle; users can drag the divider. Split is clamped between 10% and 90%.

  useEffect(() => {
    // Keep shared owner consistent with notes page behavior
    try {
      if (noteId && ownerParam) {
        localStorage.setItem(`doc_owner_${noteId}`, ownerParam);
        setEffOwner(ownerParam);
      } else if (noteId && !ownerParam) {
        const stored = localStorage.getItem(`doc_owner_${noteId}`) || undefined;
        if (stored) setEffOwner(stored);
      }
    } catch { /* ignore */ }
  }, [noteId, ownerParam]);

  useEffect(() => {
    const ownerForFetch = effOwner || user?.uid;
    if (!ownerForFetch || !noteId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const ref = fsDoc(db, 'documents', ownerForFetch, 'userDocuments', noteId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setDoc(null);
        setLoading(false);
        return;
      }
      const data = { id: snap.id, ...snap.data() } as Doc;
      setDoc(data);
      setLoading(false);
    }, (err) => {
      setError(err?.message || 'Failed to load document');
      setLoading(false);
    });
    return () => unsub();
  }, [noteId, user?.uid, effOwner]);

  type FileInfo =
    | { kind: 'website'; websiteUrl: string | null }
    | { kind: 'youtube'; youtubeUrl: string | null }
    | { kind: 'audio'; storagePath: string | null; downloadURL: string | null }
    | { kind: 'file'; url: string | null; isPdf: boolean; isDocx: boolean; isPptx: boolean; isTxt: boolean };

  const fileInfo: FileInfo | null = useMemo(() => {
    if (!doc) return null;
    const mime = doc.metadata?.mimeType || "";
    const lowerName = (doc.metadata?.fileName || "").toLowerCase();
    const isWebsite = doc.type === "website";
    const isYouTube = doc.type === "youtube";
  const websiteUrl = isWebsite ? (doc.metadata as { url?: string } | undefined)?.url || null : null;
  const youtubeUrl = isYouTube ? (doc.metadata as { url?: string } | undefined)?.url || null : null;
  const isAudio = doc.type === 'audio';
    const isPdf = doc.type === "pdf" || mime.includes("pdf") || lowerName.endsWith(".pdf");
    const isDocx = doc.type === "docx" || mime.includes("word") || lowerName.endsWith(".docx");
    const isPptx = doc.type === "pptx" || mime.includes("presentation") || lowerName.endsWith(".pptx");
    const isTxt = doc.type === "text" || mime.includes("text/plain") || lowerName.endsWith(".txt");
    const baseUrl = doc.metadata?.downloadURL || null;
    if (isWebsite) return { kind: 'website', websiteUrl };
    if (isYouTube) return { kind: 'youtube', youtubeUrl };
    if (isAudio) {
      return {
        kind: 'audio',
        storagePath: doc.metadata?.storagePath || null,
        downloadURL: doc.metadata?.downloadURL || null,
      };
    }
    if (!baseUrl && !isTxt) return null; // no preview for non-text without URL
    // Add cache-busting so newly uploaded PDFs don't show stale cached content
    const toMs = (val: Timestamp | Date | string | number | undefined): number => {
      try {
        if (!val) return Date.now();
        if (val instanceof Date) return val.getTime();
        if (typeof val === 'string' || typeof val === 'number') {
          const t = new Date(val).getTime();
          return isNaN(t) ? Date.now() : t;
        }
        if (typeof val === 'object' && val && 'toDate' in (val as Timestamp)) {
          try { return (val as Timestamp).toDate().getTime(); } catch { return Date.now(); }
        }
        const t = new Date(String(val)).getTime();
        return isNaN(t) ? Date.now() : t;
      } catch { return Date.now(); }
    };
    const version = toMs(doc.updatedAt || doc.lastAccessed || doc.createdAt || Date.now());
    let url: string | null = baseUrl;
    if (url) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}v=${version}`;
    }
    return { kind: 'file', url, isPdf, isDocx, isPptx, isTxt };
  }, [doc]);

  // If no downloadURL (common for older records), try resolving from storagePath
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!doc) { setResolvedUrl(null); return; }
      const hasUrl = !!doc.metadata?.downloadURL;
      if (hasUrl) { setResolvedUrl(null); return; }
      // Try storagePath first
  const storagePathDirect = doc.metadata?.storagePath || null;
      // If missing, derive from userId + documentId + extension from fileName
  let derivedStoragePath: string | null = storagePathDirect;
  if (!derivedStoragePath) {
        const fileName = doc.metadata?.fileName || "";
        let ext = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : undefined;
        if (!ext) {
          const mime = (doc.metadata?.mimeType || "").toLowerCase();
          if (mime.includes("text/plain")) ext = "txt";
          else if (mime.includes("pdf")) ext = "pdf";
          else if (mime.includes("word") || mime.includes("officedocument.wordprocessingml")) ext = "docx";
          else if (mime.includes("presentation") || mime.includes("officedocument.presentationml")) ext = "pptx";
        }
        if (!ext) {
          // fall back to doc.type
          const t = doc.type;
          if (t === 'text') ext = 'txt';
          else if (t === 'pdf') ext = 'pdf';
          else if (t === 'docx') ext = 'docx';
          else if (t === 'pptx') ext = 'pptx';
        }

        // prefer original source owner if present (imported/public docs)
        const ownerCandidatesRaw = [doc.metadata?.sourceOwnerId, doc.userId, effOwner].filter(Boolean) as string[];
        const ownerCandidates = Array.from(new Set(ownerCandidatesRaw));
        const idCandidatesRaw = [doc.metadata?.sourceDocumentId, doc.id].filter(Boolean) as string[];
        const idCandidates = Array.from(new Set(idCandidatesRaw));

        let found: string | null = null;
        if (ext && ownerCandidates.length && idCandidates.length) {
          for (const ownerId of ownerCandidates) {
            for (const docId of idCandidates) {
              const candidate = `${getUserDocumentsPath(ownerId)}/${docId}.${ext}`;
              try {
                const url = await getFileDownloadURL(candidate);
                if (url) { found = url; }
              } catch {
                // continue to next candidate
              }
              if (found) break;
            }
            if (found) break;
          }
          if (found) {
            if (active) setResolvedUrl(found);
            return;
          }
        }
        // if not found via candidates, set derived path to a best guess using primary owner+id
        if (!found && ext && ownerCandidates.length && idCandidates.length) {
          derivedStoragePath = `${getUserDocumentsPath(ownerCandidates[0])}/${idCandidates[0]}.${ext}`;
        }
      }
      if (!derivedStoragePath) { setResolvedUrl(null); return; }
      try {
        const url = await getFileDownloadURL(derivedStoragePath);
        if (active) setResolvedUrl(url);
      } catch {
        if (active) setResolvedUrl(null);
      }
    })();
    return () => { active = false; };
  }, [doc, effOwner]);

  // Fetch the PDF as a Blob to guarantee fresh content and create an object URL for the viewer
  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;
    (async () => {
      if (!fileInfo || fileInfo.kind !== 'file' || !fileInfo.isPdf) {
        setVerifiedPdfUrl(null);
        setVerifyingPdf(false);
        return;
      }
      setVerifyingPdf(true);
      setVerifiedPdfUrl(null);
      try {
        // Force revalidation to bypass caches
  const res = await fetch(fileInfo.url!, { cache: 'reload' });
        if (!res.ok) throw new Error('Failed to fetch PDF');
        const blob = await res.blob();
        // Magic byte check
        try {
          const head = await blob.slice(0, 5).text();
          if (head !== '%PDF-') throw new Error('Not a PDF');
        } catch {
          // Some environments may block text() but react-pdf will still attempt; proceed anyway
        }
        objUrl = URL.createObjectURL(blob);
        if (!cancelled) setVerifiedPdfUrl(objUrl);
      } catch {
        if (!cancelled) setVerifiedPdfUrl(null);
      } finally {
        if (!cancelled) setVerifyingPdf(false);
      }
    })();
    return () => {
      cancelled = true;
      if (objUrl) {
        try { URL.revokeObjectURL(objUrl); } catch {}
      }
    };
  }, [fileInfo]);

  // Resizer handlers (md+ only)
  const onMouseDownDivider = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setIsDragging(true);
    e.preventDefault();
  }, []);

  const onTouchStartDivider = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setIsDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (isMobile) {
        const y = e.clientY - rect.top;
        const ratio = Math.max(0.1, Math.min(0.9, y / rect.height));
        setSplit(ratio);
      } else {
        const x = e.clientX - rect.left;
        const ratio = Math.max(0.1, Math.min(0.9, x / rect.width));
        setSplit(ratio);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const t = e.touches[0];
      if (!t) return;
      if (isMobile) {
        const y = t.clientY - rect.top;
        const ratio = Math.max(0.1, Math.min(0.9, y / rect.height));
        setSplit(ratio);
      } else {
        const x = t.clientX - rect.left;
        const ratio = Math.max(0.1, Math.min(0.9, x / rect.width));
        setSplit(ratio);
      }
      // prevent the page from scrolling while dragging
      try { e.preventDefault(); } catch {}
    };
  const onMouseUp = () => { draggingRef.current = false; setIsDragging(false); };
  const onTouchEnd = () => { draggingRef.current = false; setIsDragging(false); };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isMobile]);

  // Detect mobile viewport; set initial split (desktop 60%, mobile 50%); subsequent resizes won't override user-adjusted split
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const MOBILE_BP = 768;
    const isMob = window.innerWidth < MOBILE_BP;
    setIsMobile(isMob);
    // Set initial ratio based on device type
  setSplit(isMob ? 0.5 : 0.7);
    const onResize = () => {
      // Only update isMobile state; don't force split after initial mount
      setIsMobile(window.innerWidth < MOBILE_BP);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div ref={containerRef} className={`h-full w-full flex overflow-hidden ${isMobile ? 'flex-col' : ''}`}>
      {/* Document preview pane */}
      <div
        className={isMobile
          ? `w-full border-b border-border bg-background`
          : `hidden md:flex h-full border-r border-border bg-background`}
        style={isMobile ? { height: `${Math.round(split * 100)}%` } : { width: `${Math.round(split * 100)}%` }}
      >
        {loading ? (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            Loading document...
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-500">{error}</div>
        ) : fileInfo ? (
          fileInfo.kind === 'website' ? (
            (() => {
              const url = fileInfo.websiteUrl;
              if (!url) {
                return (
                  <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
                    <div>
                      <div className="font-medium mb-1">Website preview not available</div>
                      <div className="text-sm">Missing or invalid URL.</div>
                    </div>
                  </div>
                );
              }
              const proxySrc = `/api/webpage-proxy?url=${encodeURIComponent(url)}`;
              const z = Math.max(0.5, Math.min(2, websiteZoom));
              const inc = () => setWebsiteZoom((v) => Math.min(2, +(v + 0.1).toFixed(2)));
              const dec = () => setWebsiteZoom((v) => Math.max(0.5, +(v - 0.1).toFixed(2)));
              const reset = () => setWebsiteZoom(1);
              return (
                <div className="h-full w-full flex flex-col">
                  {/* Toolbar */}
                  <div className="px-3 py-2 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between">
                    <div className="text-sm font-medium text-card-foreground truncate" title={url}>
                      Web preview
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={dec}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-card-foreground hover:bg-muted"
                        aria-label="Zoom out"
                        title="Zoom out"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={reset}
                        className="px-2 h-8 rounded-md border border-border text-xs font-medium text-card-foreground hover:bg-muted min-w-[64px]"
                        aria-label="Reset zoom"
                        title="Reset zoom"
                      >
                        {Math.round(z * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={inc}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border text-card-foreground hover:bg-muted"
                        aria-label="Zoom in"
                        title="Zoom in"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center gap-1 px-2 h-8 rounded-md border border-border text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title="Open original in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </a>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 overflow-auto bg-white">
                    <div className="relative h-full w-full">
                      <div
                        style={{
                          transform: `scale(${z})`,
                          transformOrigin: "0 0",
                          width: `${100 / z}%`,
                          height: `${100 / z}%`,
                        }}
                      >
                        <iframe
                          src={proxySrc}
                          className="w-full h-full bg-white"
                          sandbox="allow-same-origin allow-top-navigation-by-user-activation"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : fileInfo.kind === 'youtube' ? (
            (() => {
              const ytUrl = fileInfo.youtubeUrl;
              if (!ytUrl) {
                return (
                  <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
                    <div>
                      <div className="font-medium mb-1">YouTube preview not available</div>
                      <div className="text-sm">Missing or invalid URL.</div>
                    </div>
                  </div>
                );
              }
              const extractVideoId = (input: string): string | null => {
                try {
                  const idPattern = /^[a-zA-Z0-9_-]{11}$/;
                  const m = input.match(idPattern) || input.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) || input.match(/embed\/([a-zA-Z0-9_-]{11})/);
                  const id = m ? (m[1] || m[0]) : null;
                  return id || null;
                } catch { return null; }
              };
              const vid = extractVideoId(ytUrl);
              const embedSrc = vid
                ? `https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1`
                : undefined;
              return (
                <div className="h-full w-full flex flex-col">
                  <div className="px-3 py-2 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between">
                    <div className="text-sm font-medium text-card-foreground truncate" title={ytUrl}>
                      YouTube
                    </div>
                    <a
                      href={ytUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 h-8 rounded-md border border-border text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      title="Open on YouTube"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </a>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {embedSrc ? (
                      <div className="w-full max-w-4xl mx-auto aspect-video bg-black rounded-lg overflow-hidden shadow">
                        <iframe
                          className="w-full h-full"
                          src={embedSrc}
                          title="YouTube video player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
                        <div>
                          <div className="font-medium mb-1">Cannot embed video</div>
                          <div className="text-sm">Unsupported YouTube URL format.</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : fileInfo.kind === 'audio' ? (
            <AudioViewer
              storagePath={fileInfo.storagePath}
              fallbackUrl={fileInfo.downloadURL}
              fileName={doc?.metadata?.fileName || doc?.title || 'Audio'}
              className="h-full w-full"
            />
          ) : fileInfo.kind === 'file' ? (
          fileInfo.isDocx ? (
            <DocxViewer fileUrl={fileInfo.url!} className="h-full w-full" />
          ) : fileInfo.isPdf ? (
          verifyingPdf ? (
            <div className="h-full w-full flex items-center justify-center text-muted-foreground">Checking file…</div>
          ) : verifiedPdfUrl ? (
            <PDFViewer fileUrl={verifiedPdfUrl} className="h-full w-full" />
          ) : (
            <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
              <div>
                <div className="font-medium mb-1">Preview not available</div>
                <div className="text-sm">This file isn&#39;t a valid PDF or couldn&#39;t be fetched.</div>
                <div className="text-xs opacity-70 mt-2">Try re-uploading as a PDF or open it directly from Storage.</div>
              </div>
            </div>
          )
          ) : fileInfo.isPptx ? (
            <PptxViewer fileUrl={fileInfo.url!} className="h-full w-full" />
          ) : fileInfo.isTxt ? (
            (() => {
              const finalUrl = fileInfo.url || resolvedUrl;
              return finalUrl ? (
                <TxtViewer fileUrl={finalUrl} className="h-full w-full" />
              ) : (
                <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
                  <div>
                    <div className="font-medium mb-1">TXT preview not available</div>
                    <div className="text-sm">Missing download URL. The file may not be accessible.</div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
              <div>
                <div className="font-medium mb-1">Preview not available</div>
                <div className="text-sm">{doc?.metadata?.fileName || "Unknown file"}</div>
                <div className="text-xs opacity-70 mt-2">This file type isn&#39;t supported for inline preview.</div>
              </div>
            </div>
          )
          ) : (
            <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
              <div>
                <div className="font-medium mb-1">Preview not available</div>
                <div className="text-sm">Unsupported document type.</div>
              </div>
            </div>
          )
        ) : (
          <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
            <div>
              <div className="font-medium mb-1">Preview not available</div>
              <div className="text-sm">{doc?.metadata?.fileName || "Unknown file"}</div>
              <div className="text-xs opacity-70 mt-2">Upload a PDF, DOCX, PPTX, or TXT for preview.</div>
            </div>
          </div>
        )}
      </div>

      {/* Divider: vertical on desktop, draggable horizontal on mobile */}
      {isMobile ? (
        // Larger touch target for mobile dragging (48px tall)
        <div
          className={`md:hidden h-5 w-full ${isDragging ? 'bg-blue-500' : 'bg-border'} hover:bg-blue-500 cursor-row-resize flex items-center justify-center select-none touch-none transition-colors`}
          onMouseDown={onMouseDownDivider}
          onTouchStart={onTouchStartDivider}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize panels"
        >
          <div className={`h-0.5 w-10 ${isDragging ? 'bg-white' : 'bg-muted-foreground/50'} rounded-full transition-colors`} />
        </div>
      ) : (
        <div
          className={`hidden md:flex w-1 ${isDragging ? 'bg-blue-500' : 'bg-border'} hover:bg-blue-500 cursor-col-resize items-center justify-center select-none touch-none transition-colors`}
          onMouseDown={onMouseDownDivider}
          onTouchStart={onTouchStartDivider}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
        >
          <div className={`w-0.5 h-10 ${isDragging ? 'bg-white' : 'bg-muted-foreground/50'} rounded-full transition-colors`} />
        </div>
      )}

      {/* Chat pane */}
      <div
        className={`${isMobile ? 'w-full' : 'flex-1 min-w-0 h-full'}`}
        style={isMobile ? { height: `${Math.round((1 - split) * 100)}%` } : { width: `${Math.round((1 - split) * 100)}%` }}
      >
        <DocumentChat documentId={noteId} documentTitle={doc?.title || "Your Document"} ownerId={effOwner || user?.uid} />
      </div>
    </div>
  );
}