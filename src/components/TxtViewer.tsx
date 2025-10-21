"use client";

import React, { useEffect, useMemo, useState } from "react";

type TxtViewerProps = {
  fileUrl: string;
  className?: string;
};

/**
 * Lightweight TXT file viewer that fetches the file and renders its contents.
 * - Forces cache reload to avoid stale content
 * - Graceful error handling with a direct open link
 */
export default function TxtViewer({ fileUrl, className }: TxtViewerProps) {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Normalize URL to avoid accidental double query params
  const normalizedUrl = useMemo(() => {
    try {
      // Let URL constructor validate; fallback to original on error
      const u = new URL(fileUrl);
      return u.toString();
    } catch {
      return fileUrl;
    }
  }, [fileUrl]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setText("");

    (async () => {
      try {
        const res = await fetch(normalizedUrl, { cache: "reload" });
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const body = await res.text();
        if (!cancelled) setText(body);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to load text file";
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedUrl]);

  if (loading) {
    return (
      <div className={"h-full w-full flex items-center justify-center text-muted-foreground " + (className || "")}>Loading text…</div>
    );
  }

  if (error) {
    return (
      <div className={"h-full w-full p-6 flex items-center justify-center text-center " + (className || "") }>
        <div>
          <div className="font-medium mb-1">Unable to load TXT</div>
          <div className="text-sm text-muted-foreground break-all">{error}</div>
          <a className="text-xs text-blue-600 hover:underline mt-2 inline-block" href={normalizedUrl} target="_blank" rel="noreferrer">Open file in new tab</a>
        </div>
      </div>
    );
  }

  return (
    <div className={"h-full w-full overflow-auto bg-background " + (className || "") }>
      <pre className="h-full w-full m-0 p-4 whitespace-pre-wrap break-words font-mono text-sm">
        {text}
      </pre>
    </div>
  );
}
