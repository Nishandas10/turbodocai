"use client";

import Image from "next/image";
import { FileText, Globe, Mic, MoreHorizontal, Unlock, Lock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Document as UserDoc, Space as SpaceType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { updateDocument, deleteDocument } from "@/lib/firestore";

interface RecentsSectionProps {
  username: string;
  recentDocs: UserDoc[];
  spaces: SpaceType[];
  userId?: string;
}

export default function RecentsSection({ username, recentDocs, spaces, userId }: RecentsSectionProps) {
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

  const renderDocPreview = (doc: UserDoc) => {
    const url = doc?.metadata?.downloadURL;
    const mime = doc?.metadata?.mimeType || "";
    const text = (doc.summary || doc.content?.processed || doc.content?.raw || "").trim();
    const iconCls = "h-8 w-8 text-muted-foreground";
    if (url && mime.startsWith("image/")) {
      return (
        <div className="absolute inset-0 w-full h-full">
          <Image src={url} alt={doc.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
        </div>
      );
    }
    if (doc.type === "youtube") return <Globe className={iconCls} />;
    if (doc.type === "website") return <Globe className={iconCls} />;
    if (doc.type === "audio") return <Mic className={iconCls} />;
    if (text) {
      const excerpt = text.split(/\n+/).slice(0, 4).join("\n");
      return (
        <div className="absolute inset-0 p-3 text-[11px] leading-4 text-foreground/80 whitespace-pre-line overflow-hidden">{excerpt}</div>
      );
    }
    return <FileText className={iconCls} />;
  };

  return (
    <div className="max-w-6xl mx-auto mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Recents</h2>
        <button onClick={() => router.push("/notes")} className="text-sm text-muted-foreground hover:text-foreground">
          View all
        </button>
      </div>

      {recentDocs.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">No recent documents yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recentDocs.map((d) => (
            <div
              key={d.id}
              className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer relative"
              onClick={() => router.push(`/notes/${d.id}`)}
            >
              <div className="relative h-32 bg-muted flex items-center justify-center">
                {renderDocPreview(d)}
                <span className="absolute left-3 bottom-3 text-xs bg-background/80 border border-border rounded-full px-2 py-0.5">
                  {username}&apos;s Space
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Document menu"
                    >
                      <MoreHorizontal className="h-4 w-4 text-black" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-56">
                    <DropdownMenuItem
                      onSelect={async (e) => {
                        e.preventDefault();
                        if (!userId) return;
                        await updateDocument(d.id, userId, { isPublic: !d.isPublic });
                      }}
                      className="flex items-center gap-2"
                    >
                      {d.isPublic ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      <span>{d.isPublic ? "Make private" : "Make public"}</span>
                    </DropdownMenuItem>
                    <div className="my-1 h-px bg-border" />
                    {spaces.length === 0 ? (
                      <DropdownMenuItem disabled>Add to space (none)</DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem disabled className="opacity-70">Add to space</DropdownMenuItem>
                        {spaces.slice(0, 6).map((sp) => (
                          <DropdownMenuItem
                            key={sp.id}
                            onSelect={async (e) => {
                              e.preventDefault();
                              if (!userId) return;
                              await updateDocument(d.id, userId, { spaceId: sp.id });
                            }}
                          >
                            {sp.name || "Untitled"}
                          </DropdownMenuItem>
                        ))}
                        {d.spaceId ? (
                          <DropdownMenuItem
                            onSelect={async (e) => {
                              e.preventDefault();
                              if (!userId) return;
                              await updateDocument(d.id, userId, { spaceId: '' as unknown as undefined });
                            }}
                          >
                            Remove from space
                          </DropdownMenuItem>
                        ) : null}
                      </>
                    )}
                    <div className="my-1 h-px bg-border" />
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={async (e) => {
                        e.preventDefault();
                        if (!userId) return;
                        if (!confirm("Delete this document permanently?")) return;
                        await deleteDocument(d.id, userId);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="p-4">
                <p className="font-medium text-card-foreground truncate" title={d.title}>
                  {d.title || "Untitled"}
                </p>
                <p className="text-xs text-muted-foreground">{relativeTime(d.createdAt || d.updatedAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
