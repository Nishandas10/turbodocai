"use client";

import { useEffect, useRef, useState } from "react";
import useSpeechToText from "@/hooks/useSpeechToText";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowUp, AtSign, Brain, ChevronDown, Globe, Mic, X } from "lucide-react";
import type { Document as UserDoc } from "@/lib/types";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

interface PromptBarProps {
  userId?: string;
  username: string;
  recentDocs: UserDoc[];
}

export default function PromptBar({ userId, username, recentDocs }: PromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [thinkModeEnabled, setThinkModeEnabled] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [contextSearch, setContextSearch] = useState("");
  const contextWrapperRef = useRef<HTMLDivElement | null>(null);
  const userEditedRef = useRef<boolean>(false);
  const userEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { supported: speechSupported, listening, interimTranscript, start: startSpeech, stop: stopSpeech, reset: resetSpeech } = useSpeechToText({
    lang: "en-US",
    fallbackLangs: ["en-US"],
    continuous: false,
    interimResults: true,
    onPartial: () => {},
    onSegment: (seg) => {
      if (!userEditedRef.current) {
        setPrompt((prev) => (prev ? prev + " " + seg : seg));
      }
    },
  });

  const [voiceActive, setVoiceActive] = useState(false);
  const deactivateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantVoiceRef = useRef(false);

  const handleStartVoice = () => {
    if (!speechSupported) return;
    if (deactivateTimerRef.current) {
      clearTimeout(deactivateTimerRef.current);
      deactivateTimerRef.current = null;
    }
    wantVoiceRef.current = true;
    resetSpeech();
    userEditedRef.current = false;
    setVoiceActive(true);
    startSpeech();
  };

  const handleStopVoice = () => {
    wantVoiceRef.current = false;
    stopSpeech();
    if (deactivateTimerRef.current) clearTimeout(deactivateTimerRef.current);
    setVoiceActive(false);
    userEditedRef.current = false;
  };

  useEffect(() => {
    if (listening) {
      if (wantVoiceRef.current && !voiceActive) setVoiceActive(true);
      if (deactivateTimerRef.current) {
        clearTimeout(deactivateTimerRef.current);
        deactivateTimerRef.current = null;
      }
    } else {
      if (wantVoiceRef.current) {
        setTimeout(() => {
          if (wantVoiceRef.current) startSpeech();
        }, 120);
      } else {
        if (voiceActive) setVoiceActive(false);
      }
    }
  }, [listening, voiceActive, startSpeech]);

  useEffect(() => {
    return () => {
      if (userEditTimerRef.current) clearTimeout(userEditTimerRef.current);
    };
  }, []);

  const effectivePromptValue =
    voiceActive && !userEditedRef.current && interimTranscript
      ? prompt
        ? prompt + " " + interimTranscript
        : interimTranscript
      : prompt;

  // Close context popover on outside click / Escape
  useEffect(() => {
    if (!contextOpen) return;
    const onDown = (e: MouseEvent) => {
      if (contextWrapperRef.current && !contextWrapperRef.current.contains(e.target as Node)) {
        setContextOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextOpen]);

  const handleSendPrompt = async () => {
    if (!prompt.trim() || !userId) return;
    try {
      const initial = prompt.trim();
      setPrompt("");
      const callCreate = httpsCallable(functions, "createChat");
      const createRes = (await callCreate({
        userId,
        language: "en",
        title: initial,
        contextDocIds: selectedDocIds,
        webSearch: webSearchEnabled,
        thinkMode: thinkModeEnabled,
      })) as unknown as { data: { success: boolean; data?: { chatId?: string } } };
      const chatId = createRes?.data?.data?.chatId;
      if (chatId) {
        const q = new URLSearchParams({ prompt: initial });
        q.set("webSearch", webSearchEnabled ? "1" : "0");
        q.set("thinkMode", thinkModeEnabled ? "1" : "0");
        if (selectedDocIds.length) q.set("docs", selectedDocIds.join(","));
        window.location.href = `/chat/${chatId}?${q.toString()}`;
      } else {
        throw new Error("Failed to create chat");
      }
    } catch (e) {
      console.error("Start chat failed", e);
      alert("Failed to start chat");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-card border border-border rounded-2xl shadow-sm relative">
        {/* Top row: input + Send button */}
        <div className="flex items-center gap-3 px-4 pt-3">
          <input
            className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground px-2 py-2"
            placeholder={`Greetings ${username}`}
            value={effectivePromptValue}
            onChange={(e) => {
              const v = e.target.value;
              const interimShown = interimTranscript || "";
              let base = v;
              if (voiceActive && interimShown) {
                if (base.endsWith(" " + interimShown)) base = base.slice(0, -(" ".length + interimShown.length));
                else if (base.endsWith(interimShown)) base = base.slice(0, -interimShown.length);
              }
              setPrompt(base);
              if (voiceActive) {
                userEditedRef.current = true;
                if (userEditTimerRef.current) clearTimeout(userEditTimerRef.current);
                userEditTimerRef.current = setTimeout(() => {
                  userEditedRef.current = false;
                }, 1200);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendPrompt();
            }}
          />
          <button
            type="button"
            onClick={handleSendPrompt}
            disabled={!prompt.trim()}
            className="rounded-full p-2 bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send"
            aria-label="Send"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom row: toggles and context */}
        <div className="flex items-center justify-between px-4 pb-3 mt-2">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  <span className="hidden sm:inline">{thinkModeEnabled ? "Learn Pro" : "Learn+"}</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setThinkModeEnabled((v) => !v);
                  }}
                  className="flex items-center gap-3"
                >
                  <Brain className="h-4 w-4 text-emerald-600" />
                  <span className="flex-1">Learn Pro</span>
                  <span
                    role="switch"
                    aria-checked={thinkModeEnabled}
                    className={`relative shrink-0 w-16 h-7 rounded-full transition-colors duration-200 ${
                      thinkModeEnabled ? "bg-violet-600" : "bg-muted"
                    }`}
                  >
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${thinkModeEnabled ? "text-white opacity-100" : "opacity-0"}`}>
                      ON
                    </span>
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${thinkModeEnabled ? "opacity-0" : "text-foreground/60 opacity-100"}`}>
                      OFF
                    </span>
                    <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${thinkModeEnabled ? "translate-x-8" : ""}`} />
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setWebSearchEnabled((v) => !v);
                  }}
                  className="flex items-center gap-3"
                >
                  <Globe className="h-4 w-4 text-blue-600" />
                  <span className="flex-1">Search</span>
                  <span
                    role="switch"
                    aria-checked={webSearchEnabled}
                    className={`relative shrink-0 w-16 h-7 rounded-full transition-colors duration-200 ${
                      webSearchEnabled ? "bg-blue-600" : "bg-muted"
                    }`}
                  >
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${webSearchEnabled ? "text-white opacity-100" : "opacity-0"}`}>
                      ON
                    </span>
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${webSearchEnabled ? "opacity-0" : "text-foreground/60 opacity-100"}`}>
                      OFF
                    </span>
                    <span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${webSearchEnabled ? "translate-x-8" : ""}`} />
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative" ref={contextWrapperRef}>
              <button
                type="button"
                onClick={() => setContextOpen((o) => !o)}
                className="flex items-center gap-2 text-sm rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground"
              >
                <AtSign className="h-4 w-4" />
                <span>
                  Add Context{selectedDocIds.length ? ` (${selectedDocIds.length})` : ""}
                </span>
              </button>
              {contextOpen && (
                <div className="absolute left-0 mt-2 w-96 bg-card border border-border rounded-xl shadow-xl z-50 p-3">
                  <div className="mb-2 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Recents</span>
                    <button
                      onClick={() => {
                        setContextOpen(false);
                      }}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      Done
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <input
                      value={contextSearch}
                      onChange={(e) => setContextSearch(e.target.value)}
                      placeholder="Search"
                      className="w-full text-sm px-3 py-2 rounded-lg bg-muted border border-border focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {recentDocs
                      .filter(
                        (d) => !contextSearch.trim() || d.title.toLowerCase().includes(contextSearch.toLowerCase())
                      )
                      .slice(0, 4)
                      .map((d) => {
                        const active = selectedDocIds.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() =>
                              setSelectedDocIds((prev) =>
                                prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id].slice(0, 4)
                              )
                            }
                            className={`w-full text-left text-sm rounded-lg px-3 py-2 border transition-colors ${
                              active
                                ? "border-blue-500 bg-blue-500/10 text-foreground"
                                : "border-transparent hover:bg-muted/60 text-muted-foreground"
                            }`}
                          >
                            {d.title || "Untitled"}
                          </button>
                        );
                      })}
                    {recentDocs.length === 0 && (
                      <div className="text-xs text-muted-foreground px-1 py-6">No documents yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {webSearchEnabled && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 rounded-full pl-2 pr-1 py-0.5 border border-blue-500/30">
                <Globe className="h-3 w-3" />
                <span>@WebSearch</span>
                <button
                  type="button"
                  onClick={() => setWebSearchEnabled(false)}
                  className="hover:text-destructive/80 ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="h-9 flex items-center">
              {voiceActive ? (
                <div className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1 pr-3 transition-all duration-200 ease-in-out">
                  <div className="flex items-center gap-1 mr-1" aria-label={listening ? "Listening…" : "Processing voice…"}>
                    <span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite]" />
                    <span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite_0.15s]" />
                    <span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite_0.3s]" />
                  </div>
                  <button
                    type="button"
                    onClick={handleStopVoice}
                    className="p-1.5 rounded-full bg-red-500/90 text-white hover:bg-red-600 transition-colors"
                    title="Stop voice input"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  title={speechSupported ? "Start voice input" : "Speech not supported"}
                  onClick={handleStartVoice}
                  className="hover:text-foreground p-2 transition-colors duration-200"
                  type="button"
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedDocIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 px-1">
          {selectedDocIds.map((id) => {
            const title = recentDocs.find((r) => r.id === id)?.title || "Document";
            return (
              <span key={id} className="inline-flex items-center gap-1 text-xs bg-muted/70 rounded-full pl-2 pr-1 py-0.5">
                {title.length > 22 ? title.slice(0, 22) + "…" : title}
                <button
                  type="button"
                  onClick={() => setSelectedDocIds((prev) => prev.filter((x) => x !== id))}
                  className="hover:text-destructive"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
