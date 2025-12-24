"use client";

import React, { useEffect, useRef, useState } from "react";

export type WebNotesProps = {
  storageKey: string;
  title?: string;
  subtitle?: React.ReactNode;
  placeholder?: string;
  className?: string;
  minHeightPx?: number;
};

export default function WebNotes({
  storageKey,
  title = "Your notes",
  placeholder = "Write notes here…",
  className,
  minHeightPx = 360,
}: WebNotesProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [value, setValue] = useState("");

  // Load notes when storageKey changes.
  useEffect(() => {
    try {
      const existing = localStorage.getItem(storageKey);
      setValue(existing ?? "");
    } catch {
      setValue("");
    }
  }, [storageKey]);

  // Persist notes.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, storageKey]);

  return (
    <div className={className ?? "bg-white rounded-2xl border border-gray-300 p-6"}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="text-xs text-gray-500">Saved locally</div>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            const nextValue = e.target.value;
            setValue(nextValue);
          }}
          placeholder={placeholder}
          className="w-full p-0 bg-transparent border-0 focus:outline-none focus:ring-0 text-[15px] leading-relaxed"
          style={{ minHeight: minHeightPx }}
        />
      </div>
    </div>
  );
}
