"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
// import { getDocument } from "@/lib/firestore";
import type { Document as Doc } from "@/lib/types";
import DocumentChat from "@/components/DocumentChat";
import PDFViewer from "@/components/PdfViewer";
// import { getFileDownloadURL, getUserDocumentsPath } from "@/lib/storage";
import { db } from "@/lib/firebase";
import { doc as fsDoc, onSnapshot, Timestamp } from "firebase/firestore";

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

  const pdfUrl = useMemo(() => {
    if (!doc) return null;
    const mime = doc.metadata?.mimeType || "";
    const isPdf = (doc.type === "pdf") || mime.includes("pdf") || (doc.metadata?.fileName?.toLowerCase().endsWith(".pdf") ?? false);
    const baseUrl = isPdf ? (doc.metadata?.downloadURL || null) : null;
    if (!baseUrl) return null;
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
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}v=${version}`;
  }, [doc]);

  // Fetch the PDF as a Blob to guarantee fresh content and create an object URL for the viewer
  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;
    (async () => {
      if (!pdfUrl) {
        setVerifiedPdfUrl(null);
        setVerifyingPdf(false);
        return;
      }
      setVerifyingPdf(true);
      setVerifiedPdfUrl(null);
      try {
        // Force revalidation to bypass caches
        const res = await fetch(pdfUrl, { cache: 'reload' });
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
  }, [pdfUrl]);

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