"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getDocument } from "@/lib/firestore";
import type { Document as Doc } from "@/lib/types";
import DocumentChat from "@/components/DocumentChat";
import PDFViewer from "@/components/PdfViewer";
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
  const [split, setSplit] = useState<number>(0.6);
  const draggingRef = useRef<boolean>(false);

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
    let mounted = true;
    const run = async () => {
      const ownerForFetch = effOwner || user?.uid;
      if (!ownerForFetch || !noteId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const d = await getDocument(noteId, ownerForFetch);
        if (mounted) setDoc(d);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load document";
        if (mounted) setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [noteId, user?.uid, effOwner]);

  const pdfUrl = useMemo(() => {
    if (!doc) return null;
    const mime = doc.metadata?.mimeType || "";
    const isPdf = (doc.type === "pdf") || mime.includes("pdf") || (doc.metadata?.fileName?.toLowerCase().endsWith(".pdf") ?? false);
    return isPdf ? (doc.metadata?.downloadURL || null) : null;
  }, [doc]);

  // Verify the URL is actually a PDF before rendering the viewer to avoid InvalidPDFException
  useEffect(() => {
    let cancelled = false;
    
    // Helper to get/set cached PDF URL with 1-hour TTL
    const getCachedPdfUrl = (url: string): string | null => {
      try {
        const key = `pdf_verified_${btoa(url).slice(0, 20)}`;
        const cached = localStorage.getItem(key);
        if (cached) {
          const { verifiedUrl, timestamp } = JSON.parse(cached);
          const hourAgo = Date.now() - (60 * 60 * 1000);
          if (timestamp > hourAgo) return verifiedUrl;
        }
      } catch {}
      return null;
    };
    
    const setCachedPdfUrl = (originalUrl: string, verifiedUrl: string | null) => {
      try {
        const key = `pdf_verified_${btoa(originalUrl).slice(0, 20)}`;
        localStorage.setItem(key, JSON.stringify({
          verifiedUrl,
          timestamp: Date.now()
        }));
      } catch {}
    };
    
    async function verify(url: string) {
      // Check cache first
      const cached = getCachedPdfUrl(url);
      if (cached !== null) {
        if (!cancelled) setVerifiedPdfUrl(cached);
        return;
      }
      
      setVerifyingPdf(true);
      setVerifiedPdfUrl(null);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        // Try HEAD for content-type first
        let isPdf = false;
        try {
          const headRes = await fetch(url, { method: "HEAD", mode: "cors", signal: controller.signal });
          const ct = headRes.headers.get("content-type") || headRes.headers.get("Content-Type") || "";
          if (headRes.ok && ct.toLowerCase().includes("pdf")) {
            isPdf = true;
          }
        } catch {
          // Ignore, fall back to magic byte check
        }

        if (!isPdf) {
          // Fetch first few bytes and check for %PDF-
          try {
            const rangeRes = await fetch(url, {
              method: "GET",
              headers: { Range: "bytes=0-7" },
              mode: "cors",
              signal: controller.signal,
            });
            if (rangeRes.ok) {
              const buf = await rangeRes.arrayBuffer();
              const bytes = new Uint8Array(buf).slice(0, 5);
              const magic = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
              if (magic === "%PDF-") isPdf = true;
            }
          } catch {
            // If this also fails, we'll treat as not verified
          }
        }

        clearTimeout(timeout);
        const finalUrl = isPdf ? url : null;
        if (!cancelled) {
          setVerifiedPdfUrl(finalUrl);
          setCachedPdfUrl(url, finalUrl);
        }

        // Fallback: For documents of type 'pdf', try reconstructing the original storage path
        if (!isPdf && doc?.type === "pdf" && user?.uid && !cancelled) {
          try {
            const path = `${getUserDocumentsPath(user.uid)}/${noteId}.pdf`;
            const altUrl = await getFileDownloadURL(path);
            if (altUrl) {
              // Quick verify via magic bytes without HEAD (some providers block HEAD)
              try {
                const res = await fetch(altUrl, { headers: { Range: "bytes=0-7" } });
                if (res.ok) {
                  const buf = await res.arrayBuffer();
                  const bytes = new Uint8Array(buf).slice(0, 5);
                  const magic = Array.from(bytes).map((b) => String.fromCharCode(b)).join("");
                  if (magic === "%PDF-") {
                    if (!cancelled) {
                      setVerifiedPdfUrl(altUrl);
                      setCachedPdfUrl(url, altUrl);
                    }
                  }
                }
              } catch {
                // ignore
              }
            }
          } catch {
            // ignore fallback failure
          }
        }
      } finally {
        if (!cancelled) setVerifyingPdf(false);
      }
    }

    if (pdfUrl) verify(pdfUrl);
    else {
      setVerifiedPdfUrl(null);
      setVerifyingPdf(false);
    }
    return () => {
      cancelled = true;
    };
  }, [pdfUrl, doc?.type, noteId, user?.uid]);

  // Resizer handlers (md+ only)
  const onMouseDownDivider = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = Math.max(0.3, Math.min(0.7, x / rect.width));
      setSplit(ratio);
    };
    const onMouseUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full w-full flex overflow-hidden">
      {/* Left: PDF viewer or placeholder */}
      <div
        className="hidden md:flex h-full border-r border-border bg-background"
        style={{ width: `${Math.round(split * 100)}%` }}
      >
        {loading ? (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            Loading document...
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-500">{error}</div>
        ) : pdfUrl ? (
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
        ) : (
          <div className="h-full w-full p-6 flex items-center justify-center text-center text-muted-foreground">
            <div>
              <div className="font-medium mb-1">Preview not available</div>
              <div className="text-sm">{doc?.metadata?.fileName || "Unknown file"}</div>
              <div className="text-xs opacity-70 mt-2">Only PDF files can be previewed here.</div>
            </div>
          </div>
        )}
      </div>

      {/* Divider (md+) */}
      <div
        className="hidden md:block w-1 bg-border hover:bg-blue-500 cursor-col-resize"
        onMouseDown={onMouseDownDivider}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
      />

      {/* Right: Chat */}
      <div
        className="flex-1 min-w-0 h-full"
        style={{ width: `${Math.round((1 - split) * 100)}%` }}
      >
        <DocumentChat documentId={noteId} documentTitle={doc?.title || "Your Document"} ownerId={effOwner || user?.uid} />
      </div>
    </div>
  );
}