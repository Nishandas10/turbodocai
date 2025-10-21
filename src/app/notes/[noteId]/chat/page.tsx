"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
// import { getDocument } from "@/lib/firestore";
import type { Document as Doc } from "@/lib/types";
import DocumentChat from "@/components/DocumentChat";
import PDFViewer from "@/components/PdfViewer";
import DocxViewer from "@/components/DocxViewer";
import PptxViewer from "@/components/PptxViewer";
import TxtViewer from "@/components/TxtViewer";
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

  const fileInfo = useMemo(() => {
    if (!doc) return null;
    const mime = doc.metadata?.mimeType || "";
    const lowerName = (doc.metadata?.fileName || "").toLowerCase();
    const isPdf = doc.type === "pdf" || mime.includes("pdf") || lowerName.endsWith(".pdf");
    const isDocx = doc.type === "docx" || mime.includes("word") || lowerName.endsWith(".docx");
    const isPptx = doc.type === "pptx" || mime.includes("presentation") || lowerName.endsWith(".pptx");
    const isTxt = doc.type === "text" || mime.includes("text/plain") || lowerName.endsWith(".txt");
    const baseUrl = doc.metadata?.downloadURL || null;
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
    return { url, isPdf, isDocx, isPptx, isTxt };
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
      if (!fileInfo || !fileInfo.isPdf) {
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
        ) : fileInfo ? (
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
              <div className="text-sm">{doc?.metadata?.fileName || "Unknown file"}</div>
              <div className="text-xs opacity-70 mt-2">Upload a PDF, DOCX, PPTX, or TXT for preview.</div>
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