"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type PublicStats = { views?: number; likes?: number } | undefined;

export type PublicDocument = {
  id: string;
  ownerId: string;
  title: string;
  type: "pdf" | "docx" | "ppt" | "audio" | "youtube" | "note" | string;
  status: "uploading" | "processing" | "ready" | "error" | string;
  isPublic: boolean;
  tags?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  preview?: string;
  storagePath?: string;
  masterUrl?: string;
  // mirror may contain richer fields copied from userDocuments
  content?: { processed?: string; raw?: string };
  summary?: string;
  metadata?: {
    pageCount?: number;
    duration?: number;
    fileSize?: number;
    lang?: string;
    fileName?: string;
    mimeType?: string;
    downloadURL?: string;
  };
  stats?: PublicStats;
};

export default function ExplorePage() {
  const [docs, setDocs] = useState<PublicDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const col = collection(db, "allDocuments");
        const qy = query(col, where("isPublic", "==", true), orderBy("createdAt", "desc"), limit(48));
        const snap = await getDocs(qy);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as PublicDocument[];
        setDocs(items);
      } catch (e) {
        console.error("Failed to load explore docs", e);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, []);

  const renderPreview = (doc: PublicDocument) => {
    const url = doc.masterUrl || doc.metadata?.downloadURL;
    const mime = doc.metadata?.mimeType || "";
    const text = (doc.preview || doc.summary || doc.content?.processed || doc.content?.raw || "").trim();

    const iconCls = "h-8 w-8 text-muted-foreground";

    if (url && mime.startsWith("image/")) {
      return (
        <div className="absolute inset-0 w-full h-full">
          <Image
            src={url}
            alt={doc.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      );
    }
    if (doc.type === "youtube") return <span className={iconCls}>▶</span>;
    if (doc.type === "website") return <span className={iconCls}>🌐</span>;
    if (doc.type === "audio") return <span className={iconCls}>🎙️</span>;

    if (text) {
      const excerpt = text.split(/\n+/).slice(0, 4).join("\n");
      return (
        <div className="absolute inset-0 p-3 text-[11px] leading-4 text-foreground/80 whitespace-pre-line overflow-hidden">
          {excerpt}
        </div>
      );
    }
    return null;
  };

  return (
    <main className="min-h-screen w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Explore</h1>
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            Home
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading public documents…</div>
        ) : docs.length === 0 ? (
          <div className="text-sm text-muted-foreground">No public documents yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {docs.map((doc) => (
              <article key={doc.id} className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative h-32 bg-muted flex items-center justify-center">
                  {renderPreview(doc)}
                  <span className="absolute left-3 bottom-3 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-background/80 border border-border">
                    {doc.type}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    {doc.stats?.views != null && (
                      <span className="text-xs text-muted-foreground">{doc.stats?.views} views</span>
                    )}
                  </div>
                  <h3 className="font-medium line-clamp-2">{doc.title}</h3>
                  {doc.preview && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{doc.preview}</p>
                  )}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {doc.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
