"use client";

import Image from "next/image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Globe, MoreHorizontal, Play } from "lucide-react";
import type { PublicDocumentMeta } from "@/lib/firestore";
import type { Space as SpaceType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createWebsiteDocument, updateDocument } from "@/lib/firestore";

interface ExploreSectionProps {
  exploreDocs: PublicDocumentMeta[];
  spaces: SpaceType[];
  explorePreviewMap: Record<string, string>;
  userId?: string;
}

export default function ExploreSection({ exploreDocs, spaces, explorePreviewMap, userId }: ExploreSectionProps) {
  const router = useRouter();

  const relativeTime = (date: unknown) => {
    try {
      let d: Date;
      if (!date) d = new Date();
      else if (date instanceof Date) d = date;
      else if (typeof date === "object" && date !== null && "toDate" in date) d = (date as { toDate: () => Date }).toDate();
      else if (typeof date === "number" || typeof date === "string") d = new Date(date);
      else d = new Date();
      const diff = Date.now() - d.getTime();
      const s = Math.floor(diff / 1000);
      if (s < 60) return `just now`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
      const days = Math.floor(h / 24);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    } catch {
      return "";
    }
  };

  const renderPublicDocPreview = (doc: PublicDocumentMeta) => {
    const url = doc.masterUrl || doc.metadata?.downloadURL;
    const mime = doc.metadata?.mimeType || "";
    const override = explorePreviewMap[doc.id];
    const text = (override || doc.preview || doc.summary || doc.content?.processed || doc.content?.raw || "").trim();
    const iconCls = "h-8 w-8 text-muted-foreground";
    if (url && typeof url === "string" && mime.startsWith("image/")) {
      return (
        <div className="absolute inset-0 w-full h-full">
          <Image src={url} alt={doc.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        </div>
      );
    }
    if (doc.type === "youtube") return <Play className={iconCls} />;
    if (doc.type === "website") return <Globe className={iconCls} />;
    if (doc.type === "audio") return <Globe className={iconCls} />;
    if (text) {
      const excerpt = text.split(/\n+/).slice(0, 4).join("\n");
      return (
        <div className="absolute inset-0 p-3 text-[11px] leading-4 text-foreground/80 whitespace-pre-line overflow-hidden">{excerpt}</div>
      );
    }
    return <Globe className={iconCls} />;
  };

  const parseMirrorId = (mirrorId: string) => {
    const idx = mirrorId.indexOf("_");
    if (idx === -1) return { ownerId: "", documentId: mirrorId };
    return { ownerId: mirrorId.slice(0, idx), documentId: mirrorId.slice(idx + 1) };
  };

  const addExploreDocToSpace = async (doc: PublicDocumentMeta, spaceId: string) => {
    if (!userId) return;
    const { ownerId: fromId, documentId } = parseMirrorId(doc.id);
    const ownerId = (doc as unknown as { ownerId?: string })?.ownerId || fromId;
    try {
      if (ownerId && ownerId === userId) {
        // Own document: attach directly to the selected space
        await updateDocument(documentId, userId, { spaceId });
        alert("Added to space");
      } else {
        const url = `${window.location.origin}/notes/${documentId}`;
        await createWebsiteDocument(userId, url, doc.title, spaceId);
        alert("Added to space");
      }
    } catch (e) {
      console.error("Add to space failed", e);
      alert("Failed to add to space");
    }
  };

  const openExploreDoc = (doc: PublicDocumentMeta) => {
    const { ownerId: fromId, documentId } = parseMirrorId(doc.id);
    const ownerId = (doc as unknown as { ownerId?: string })?.ownerId || fromId;
    router.push(`/notes/${documentId}?owner=${ownerId}`);
  };

  return (
    <div className="max-w-6xl mx-auto mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Explore</h2>
        <button onClick={() => router.push("/explore")} className="text-sm text-muted-foreground hover:text-foreground">
          View all
        </button>
      </div>
      {exploreDocs.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">No public documents yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {exploreDocs.map((d) => (
            <div
              key={d.id}
              className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer relative"
              onClick={() => openExploreDoc(d)}
            >
              <div className="relative h-32 bg-muted flex items-center justify-center">
                {renderPublicDocPreview(d)}
                <span className="absolute left-3 bottom-3 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-background/80 border border-border">
                  {d.type}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-black/90 text-white hover:bg-black"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      aria-label="Document menu"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-56">
                    {spaces.length === 0 ? (
                      <DropdownMenuItem disabled>Add to space (none)</DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem disabled className="opacity-70">Add to space</DropdownMenuItem>
                        {spaces.slice(0, 6).map((sp) => (
                          <DropdownMenuItem key={sp.id} onSelect={(e) => { e.preventDefault(); addExploreDocToSpace(d, sp.id); }}>
                            {sp.name || "Untitled"}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="p-4">
                <p className="font-medium text-card-foreground truncate" title={d.title}>
                  {d.title || "Untitled"}
                </p>
                <p className="text-xs text-muted-foreground">{relativeTime(d.createdAt || d.updatedAt)}</p>
                {d.preview && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{d.preview}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
