"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from 'react-dom';
import { listenToUserDocuments } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Document as AppDocument } from "@/lib/types";
import { X, Search } from "lucide-react";
import Link from "next/link";

interface SearchModalProps {
  open: boolean;
  // Instead of passing function props (can cause serialization issues in some build contexts),
  // we allow parent to toggle `open`. We still accept onClose but mark optional.
  onClose?: () => void;
}

// Simple fuzzy match scoring (case-insensitive substring occurrences + title boost)
function scoreDoc(doc: AppDocument, q: string) {
  const hay = `${doc.title || ""} ${doc.summary || ""} ${(doc.content?.processed || doc.content?.raw || "")}`.toLowerCase();
  const title = (doc.title || "").toLowerCase();
  const query = q.toLowerCase().trim();
  if (!query) return 0;
  let score = 0;
  if (title.includes(query)) score += 5;
  // count occurrences
  const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  const matches = hay.match(re);
  if (matches) score += matches.length;
  return score;
}

export default function SearchModal({ open, onClose }: SearchModalProps) {
  const { user } = useAuth();
  const [allDocs, setAllDocs] = useState<AppDocument[]>([]);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open || !user?.uid) return;
    const unsub = listenToUserDocuments(user.uid, (docs) => setAllDocs(docs));
    return () => { try { unsub(); } catch {} };
  }, [open, user?.uid]);

  // Debounce query
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(id);
  }, [query]);

  const results = useMemo(() => {
    if (!debounced.trim()) return allDocs.slice(0, 20);
    const scored = allDocs.map(d => ({ d, s: scoreDoc(d, debounced) }))
      .filter(x => x.s > 0)
      .sort((a,b) => b.s - a.s || (b.d.updatedAt?.toMillis?.() || 0) - (a.d.updatedAt?.toMillis?.() || 0))
      .slice(0, 50)
      .map(x => x.d);
    return scored;
  }, [allDocs, debounced]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;
  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your documents..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button onClick={() => onClose?.()} className="p-2 rounded-md hover:bg-muted" aria-label="Close search">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {results.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No matches found.</div>
          ) : results.map(doc => (
            <Link
              key={doc.id}
              href={`/notes/${doc.id}`}
              onClick={() => onClose?.()}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/70 transition-colors"
            >
              <span className="text-sm font-medium truncate">{doc.title || 'Untitled'}</span>
              <span className="text-xs text-muted-foreground line-clamp-2">
                {(doc.summary || doc.content?.processed || doc.content?.raw || '').slice(0, 180)}
              </span>
            </Link>
          ))}
        </div>
        <div className="px-4 py-2 text-[10px] text-muted-foreground bg-muted/30 flex justify-between">
          <span>Showing {results.length} result{results.length!==1?'s':''}</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
