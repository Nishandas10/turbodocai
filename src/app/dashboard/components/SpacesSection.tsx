"use client";

import { Box, MoreHorizontal, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Space as SpaceType } from "@/lib/types";
import { useRouter } from "next/navigation";
import { createSpace, updateSpace, deleteSpace } from "@/lib/firestore";

interface SpacesSectionProps {
  spaces: SpaceType[];
  spaceCounts: Record<string, number>;
  userId?: string;
}

export default function SpacesSection({ spaces, spaceCounts, userId }: SpacesSectionProps) {
  const router = useRouter();
  const handleCreate = async () => {
    if (!userId) return;
    try {
      const id = await createSpace(userId, { name: "Untitled" });
      router.push(`/spaces/${id}`);
    } catch (e) {
      console.error("Create space failed", e);
      alert("Failed to create space");
    }
  };
  return (
    <div className="max-w-6xl mx-auto mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Spaces</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {spaces.map((sp) => (
          <div
            key={sp.id}
            className="group relative bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-blue-500 transition-colors cursor-pointer"
            onClick={() => router.push(`/spaces/${sp.id}`)}
          >
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Box className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-card-foreground truncate">{sp.name || "Untitled Space"}</p>
              <p className="text-xs text-muted-foreground">
                {spaceCounts[sp.id] ?? 0} {(spaceCounts[sp.id] ?? 0) === 1 ? "content" : "contents"}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Space menu"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onSelect={async (e) => {
                    e.preventDefault();
                    try {
                      const url = `${window.location.origin}/spaces/${sp.id}`;
                      await navigator.clipboard.writeText(url);
                      alert("Space link copied");
                    } catch {}
                  }}
                >
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async (e) => {
                    e.preventDefault();
                    const newName = window.prompt("Rename space", sp.name || "Untitled")?.trim();
                    if (newName && userId) await updateSpace(userId, sp.id, { name: newName });
                  }}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async (e) => {
                    e.preventDefault();
                    if (confirm("Delete this space? This does not remove documents.") && userId) {
                      await deleteSpace(userId, sp.id);
                    }
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        <div
          className="bg-card border border-dashed border-border rounded-2xl p-4 flex items-center justify-center hover:border-blue-500 transition-colors cursor-pointer"
          onClick={handleCreate}
        >
          <Plus className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
