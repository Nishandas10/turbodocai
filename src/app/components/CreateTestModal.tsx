"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Loader2, Target, FileText, Check } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { listenToSpaceDocuments, createSpaceTest } from "@/lib/firestore"
import type { Document as UserDoc } from "@/lib/types"
import { useRouter } from "next/navigation"

type Option = { label: string; value: string }

function DropdownSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (val: string) => void
  options: Option[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-9 text-left text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 hover:border-blue-400/60 transition"
      >
        <span className="truncate">{selected?.label || placeholder || "Select"}</span>
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-2 w-full max-h-56 overflow-auto rounded-lg border border-border bg-card shadow-lg focus:outline-none"
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between text-sm ${
                  active ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300" : "hover:bg-muted/60"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {active && <Check className="h-4 w-4 text-blue-600" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function CreateTestModal(props: any) {
  const { isOpen, onClose, spaceId } = props as { isOpen: boolean; onClose: () => void; spaceId: string }
  const { user } = useAuth()
  const router = useRouter()
  const [docs, setDocs] = useState<UserDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [count, setCount] = useState(10)
  const [countText, setCountText] = useState("10")
  const [difficulty, setDifficulty] = useState<"mixed" | "easy" | "medium" | "hard">("mixed")
  const [qType, setQType] = useState<"mcq" | "long" | "mixed">("mcq")
  const [duration, setDuration] = useState<number>(30)
  const [durationText, setDurationText] = useState("30")

  // Helpers to normalize/clamp numeric fields only when committing (blur/enter/proceed)
  const commitCount = () => {
    const n = parseInt(countText, 10)
    const v = isNaN(n) ? count : Math.max(5, Math.min(50, n))
    setCount(v)
    setCountText(String(v))
  }
  const commitDuration = () => {
    const n = parseInt(durationText, 10)
    const v = isNaN(n) ? duration : Math.max(1, Math.min(240, n))
    setDuration(v)
    setDurationText(String(v))
  }

  useEffect(() => {
    if (!isOpen || !user?.uid || !spaceId) return
    setLoading(true)
    const unsub = listenToSpaceDocuments(user.uid, spaceId, (d) => {
      setDocs(d)
      setLoading(false)
    })
    return () => {
      try { if (unsub) unsub() } catch {}
    }
  }, [isOpen, user?.uid, spaceId])

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  )

  const toggle = (id: string) =>
    setSelected((s) => ({ ...s, [id]: !s[id] }))

  const proceed = async () => {
    if (!selectedIds.length) return
    // Persist test metadata in Firestore (non-blocking)
    try {
      if (user?.uid) {
        await createSpaceTest(user.uid, spaceId, {
          documentIds: selectedIds,
          type: qType,
          difficulty,
          questionCount: count,
          durationMin: Math.max(1, Math.min(240, duration || 30)),
          title: `Test - ${new Date().toLocaleString()}`,
        })
      }
    } catch (e) {
      console.error("Failed to create test record", e)
    }
    const q = new URLSearchParams()
    q.set("docs", selectedIds.join(","))
  // Ensure committed values before routing
  commitCount()
  commitDuration()
  q.set("count", String(Math.max(5, Math.min(50, count))))
    q.set("difficulty", difficulty)
    q.set("type", qType)
    q.set("duration", String(Math.max(1, Math.min(240, duration || 30))))
  router.push(`/spaces/${spaceId}/test?${q.toString()}`)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
    <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
  <Target className="h-5 w-5 text-blue-600" />
  <h2 className="text-xl font-semibold text-card-foreground">Create Test</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Questions</label>
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={50}
                value={countText}
                onChange={(e) => setCountText(e.target.value)}
                onBlur={commitCount}
                onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Type</label>
              <DropdownSelect
                value={qType}
                onChange={(val) => setQType(val as "mcq" | "long" | "mixed")}
                options={[
                  { label: "Multiple Choice", value: "mcq" },
                  { label: "Long Questions", value: "long" },
                  { label: "Mixed", value: "mixed" },
                ]}
                placeholder="Select type"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Difficulty</label>
              <DropdownSelect
                value={difficulty}
                onChange={(val) => setDifficulty(val as "mixed" | "easy" | "medium" | "hard")}
                options={[
                  { label: "Easy", value: "easy" },
                  { label: "Medium", value: "medium" },
                  { label: "Hard", value: "hard" },
                  { label: "Mixed", value: "mixed" },
                ]}
                placeholder="Select difficulty"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Duration (min)</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={240}
                value={durationText}
                onChange={(e) => setDurationText(e.target.value)}
                onBlur={commitDuration}
                onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={proceed}
                disabled={!selectedIds.length}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 disabled:opacity-50"
              >
                Start Test ({selectedIds.length || 0} docs)
              </button>
            </div>
          </div>

          {/* Documents list */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-muted text-muted-foreground text-sm">Select documents from this space</div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
        {loading ? (
                <div className="p-6 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading...
                </div>
              ) : docs.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">No documents available.</div>
              ) : (
                docs.map((d) => (
                  <label key={d.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
            className="accent-blue-600"
                      checked={!!selected[d.id]}
                      onChange={() => toggle(d.id)}
                    />
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center border border-border">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-card-foreground truncate" title={d.title}>{d.title || "Untitled"}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.metadata?.fileName || d.type}</div>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
