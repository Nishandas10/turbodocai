"use client";
import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { ImageIcon, Loader2 } from "lucide-react";

const ALLOWED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function isLikelyImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase();
    if (!ext) return false;
    return ALLOWED_IMAGE_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

export default function WikiImage({
  query,
  queries,
}: {
  query?: string;
  queries?: string[];
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const candidateQueries = useMemo(() => {
    return (queries && queries.length > 0 ? queries : query ? [query] : [])
      .map((q) => q?.trim())
      .filter(Boolean) as string[];
  }, [queries, query]);

  const candidateKey = useMemo(() => candidateQueries.join("|"), [candidateQueries]);

  useEffect(() => {
    const attempts = candidateKey
      .split("|")
      .map((q) => q.trim())
      .filter(Boolean);
    if (attempts.length === 0) return;

    let isMounted = true;
    setImageUrl(null);
    setResolvedQuery(null);
    setLoading(true);
    setError(false);

    const tryFetch = async () => {
      try {
        for (const q of attempts) {
          if (!isMounted) return;

          const res = await fetch(`/api/wiki-image?term=${encodeURIComponent(q)}`);
          const data: unknown = await res.json().catch(() => ({}));
          const url =
            typeof data === "object" && data !== null && "url" in data && typeof (data as { url?: unknown }).url === "string"
              ? (data as { url: string }).url
              : null;
          if (url && isLikelyImageUrl(url)) {
            if (isMounted) {
              setImageUrl(url);
              setResolvedQuery(q);
              setError(false);
            }
            return;
          }
        }

        if (isMounted) setError(true);
      } catch {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void tryFetch();

    return () => { isMounted = false; };
  }, [candidateKey]);

  if (candidateQueries.length === 0) return null; // Don't render until we have a query

  return (
    <div className="my-8 w-full">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100 border border-gray-200 shadow-sm">
        
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-xs">Finding relevant image...</span>
          </div>
        )}

        {imageUrl && !loading && (
          <Image
            src={imageUrl}
            alt={resolvedQuery ?? candidateQueries[0]}
            fill
            className="object-cover transition-opacity duration-500 hover:scale-105"
            unoptimized // Wikimedia blocks Next.js optimization usually, so keep this
          />
        )}

        {(error || (!loading && !imageUrl)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
            <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
            <span className="text-xs">No image found</span>
          </div>
        )}

        {/* Caption */}
        {imageUrl && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-2 text-white text-[10px] px-4 truncate">
            Source: Wikimedia Commons • {resolvedQuery ?? candidateQueries[0]}
          </div>
        )}
      </div>
    </div>
  );
}