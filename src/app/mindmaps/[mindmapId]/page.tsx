"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { listenToMindMap } from "@/lib/firestore";
import type { MindMap } from "@/lib/types";
import MindMapGraph from "@/components/MindMapGraph";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function MindMapDetailPage() {
  const params = useParams();
  const router = useRouter();
  const mindmapId = params?.mindmapId as string;
  const { user, loading: authLoading } = useAuth();
  const [mindmap, setMindmap] = useState<MindMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mindmapId || authLoading) return;
    if (!user) {
      setError("You must be signed in to view this mind map");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = listenToMindMap(
      mindmapId,
      (m) => {
        setMindmap(m);
        setLoading(false);
      },
      (err: unknown) => {
        const code = (err as { code?: string } | undefined)?.code;
        if (code === 'permission-denied') {
          setError('Permission denied: you do not have access to this mind map.');
        } else {
          setError('Failed to load mind map');
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, [mindmapId, user, authLoading]);

  return (
    <div className="flex flex-col h-screen p-4 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{mindmap?.title || (error ? 'Mind Map' : 'Loading...')}</h1>
          <p className="text-xs text-muted-foreground">{error ? error : `Status: ${mindmap?.status || 'loading'}`}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/mindmaps")}>Back</Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <MindMapGraph
          // casting due to dynamic AI JSON
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          structure={mindmap?.structure as any}
          loading={loading || mindmap?.status === 'generating'}
          error={error || (mindmap?.status === 'error' ? (mindmap?.errorMessage || 'Generation failed') : undefined)}
        />
      </div>
    </div>
  );
}
