"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DashboardSidebar from "@/components/DashboardSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { listenToUserSpaces, updateDocument, createWebsiteDocument, getDocument as getUserDoc, getUserDocuments } from "@/lib/firestore";
import type { Space as SpaceType } from "@/lib/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

type PublicStats = { views?: number; likes?: number } | undefined;

export type PublicDocument = {
  id: string;
  ownerId: string;
  title: string;
  type: "pdf" | "docx" | "pptx" | "text" | "audio" | "youtube" | "note" | string;
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
  const { user } = useAuth();
  const router = useRouter();
  const [signupOpen, setSignupOpen] = useState(false);
  const [spaces, setSpaces] = useState<SpaceType[]>([]);
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});
  const [recommended, setRecommended] = useState<PublicDocument[] | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const TOPICS: string[] = [
    "For You",
    "Chemistry","Education","Arts, Design & Media","Languages & Literature",
    "History & Archaeology","Philosophy & Ethics","Social & Behavioural Sciences",
    "Journalism & Information","Business Administration","Law & Policy",
    "Biological Sciences","Environmental Sciences","Earth Sciences",
    "Physics","Mathematics & Statistics","Computer Science","AI",
  ];
  const [selectedTopic, setSelectedTopic] = useState<string>(TOPICS[0]);

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

  // Fetch personalized recommendations for "For You" using user's latest document
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.uid) { setRecommended(null); return; }
      try {
        setRecLoading(true);
        const myDocs = await getUserDocuments(user.uid, 1);
        const latest = myDocs?.[0];
        if (!latest) { setRecommended(null); return; }
        const call = httpsCallable(functions, "recommendPublicDocs");
        const resp = await call({ userId: user.uid, documentId: latest.id, limit: 24 });
        type ResultItem = {
          id: string;
          ownerId: string;
          title: string;
          type: string;
          status: string;
          isPublic: boolean;
          tags?: string[];
          preview?: string;
          storagePath?: string;
          masterUrl?: string;
          content?: { processed?: string; raw?: string };
          summary?: string;
          metadata?: PublicDocument["metadata"];
          stats?: PublicStats;
        };
        const payload = (resp?.data as unknown) as { success: boolean; data?: ResultItem[] } | undefined;
        const items = payload?.data;
        if (!items || !Array.isArray(items)) { if (!cancelled) setRecommended(null); return; }
        const mapped: PublicDocument[] = items.map((d) => ({
          id: d.id,
          ownerId: d.ownerId,
          title: d.title,
          type: d.type,
          status: d.status,
          isPublic: d.isPublic,
          tags: d.tags,
          preview: d.preview,
          storagePath: d.storagePath,
          masterUrl: d.masterUrl,
          content: d.content,
          summary: d.summary,
          metadata: d.metadata,
          stats: d.stats,
        }));
        if (!cancelled) setRecommended(mapped);
      } catch (e) {
        console.error("recommendPublicDocs failed", e);
        if (!cancelled) setRecommended(null);
      } finally {
        if (!cancelled) setRecLoading(false);
      }
    };
    run();
    return () => { cancelled = true };
  }, [user?.uid]);

  // After docs load, fetch summary/content from the source userDocuments to ensure rich previews
  useEffect(() => {
    let cancelled = false;
    const loadPreviews = async () => {
      if (!docs.length) { setPreviewMap({}); return; }
      try {
        const entries = await Promise.all(
          docs.map(async (d) => {
            const idx = d.id.indexOf("_");
            const ownerId = idx === -1 ? d.ownerId : d.id.slice(0, idx) || d.ownerId;
            const documentId = idx === -1 ? d.id : d.id.slice(idx + 1);
            if (!ownerId || !documentId) return [d.id, ""] as const;
            try {
              const full = await getUserDoc(documentId, ownerId);
              const text = (full?.summary || full?.content?.processed || full?.content?.raw || "").trim();
              return [d.id, text] as const;
            } catch {
              return [d.id, ""] as const;
            }
          })
        );
        if (!cancelled) {
          const map: Record<string, string> = {};
          for (const [id, text] of entries) map[id] = text;
          setPreviewMap(map);
        }
      } catch {/* noop */}
    };
    loadPreviews();
    return () => { cancelled = true; };
  }, [docs]);

  // Load user's spaces (recent first) for the Add-to-space menu
  useEffect(() => {
    if (!user?.uid) { setSpaces([]); return; }
    const unsub = listenToUserSpaces(user.uid, (sps) => setSpaces(sps));
    return () => { try { unsub(); } catch {} };
  }, [user?.uid]);

  const renderPreview = (doc: PublicDocument) => {
    const url = doc.masterUrl || doc.metadata?.downloadURL;
    const mime = doc.metadata?.mimeType || "";
    const override = previewMap[doc.id];
    const text = (override || doc.preview || doc.summary || doc.content?.processed || doc.content?.raw || "").trim();

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

  // Apply client-side topic filtering when a topic is selected (other than "For You")
  const filteredDocs = selectedTopic === "For You"
    ? (recommended && recommended.length ? recommended : docs)
    : docs.filter(d => Array.isArray(d.tags) && d.tags?.includes(selectedTopic));

  const parseMirrorId = (mirrorId: string) => {
    const idx = mirrorId.indexOf("_");
    if (idx === -1) return { ownerId: "", documentId: mirrorId };
    return { ownerId: mirrorId.slice(0, idx), documentId: mirrorId.slice(idx + 1) };
  };

  const handleOpenDoc = (doc: PublicDocument) => {
    if (!doc?.id) return;
    if (!user?.uid) { setSignupOpen(true); return; }
    const { ownerId: fromId, documentId } = parseMirrorId(doc.id);
    const ownerId = doc.ownerId || fromId;
    // Pass ownerId so the note page can import & process into the current user's workspace
    router.push(`/notes/${documentId}?owner=${ownerId}`);
  };

  const addExploreDocToSpace = async (doc: PublicDocument, spaceId: string) => {
    if (!user?.uid) { setSignupOpen(true); return; }
  const { ownerId: fromId, documentId } = parseMirrorId(doc.id);
  const ownerId = doc.ownerId || fromId;
    try {
      if (ownerId && ownerId === user.uid) {
        // It's your own doc: attach to space directly
        await updateDocument(documentId, user.uid, { spaceId });
      } else {
        // Not your doc: save a link to your space
        const url = `${window.location.origin}/notes/${documentId}`;
        await createWebsiteDocument(user.uid, url, doc.title, spaceId);
      }
      alert('Added to space');
    } catch (e) {
      console.error('Add to space failed', e);
      alert('Failed to add to space');
    }
  };

  return (
    <>
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Left Sidebar (same component as Dashboard) */}
      <DashboardSidebar onAddContentClick={() => router.push('/dashboard')} />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Explore</h1>
          </div>

          {/* Topic filter pills */}
          <div className="mb-6 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {TOPICS.map((t) => {
                const active = selectedTopic === t;
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedTopic(t)}
                    className={
                      active
                        ? "px-3 py-1.5 rounded-full text-sm bg-foreground text-background"
                        : "px-3 py-1.5 rounded-full text-sm border border-border text-foreground hover:bg-muted"
                    }
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading public documents…</div>
          ) : (selectedTopic === "For You" && recLoading) ? (
            <div className="text-sm text-muted-foreground">Finding recommendations…</div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No public documents{selectedTopic!=="For You"?` for "${selectedTopic}"`:''} yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredDocs.map((doc) => (
                <article
                  key={doc.id}
                  className="group rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer relative"
                  onClick={() => handleOpenDoc(doc)}
                >
                  <div className="relative h-32 bg-muted flex items-center justify-center">
                    {renderPreview(doc)}
                    <span className="absolute left-3 bottom-3 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-background/80 border border-border">
                      {doc.type}
                    </span>
                    {/* Hover menu for adding to spaces */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-black/90 text-white hover:bg-black"
                          onClick={(e) => { e.stopPropagation(); }}
                          aria-label="Document menu"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-56">
                        {(!user?.uid) ? (
                          <DropdownMenuItem onSelect={(e)=>{ e.preventDefault(); setSignupOpen(true); }}>Sign in to add to space</DropdownMenuItem>
                        ) : spaces.length === 0 ? (
                          <DropdownMenuItem disabled>Add to space (none)</DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem disabled className="opacity-70">Add to space</DropdownMenuItem>
                            {spaces.slice(0,6).map(sp => (
                              <DropdownMenuItem key={sp.id} onSelect={(e)=>{ e.preventDefault(); addExploreDocToSpace(doc, sp.id) }}>
                                {sp.name || 'Untitled'}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                        {doc.tags
                          .filter((t) => t !== "uploaded")
                          .slice(0, 3)
                          .map((t) => (
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
      </div>
    </div>
    {/* Signup Modal */}
    {signupOpen && (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-lg font-semibold">Sign in to continue</h2>
            <p className="text-sm text-muted-foreground mt-1">Create a free account to open documents and add them to your spaces.</p>
          </div>
          <div className="p-5 flex items-center justify-end gap-2">
            <button onClick={()=>setSignupOpen(false)} className="px-3 py-1.5 rounded-md border border-border">Cancel</button>
            <a href="/signup" className="px-3 py-1.5 rounded-md bg-foreground text-background">Sign up / Sign in</a>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
