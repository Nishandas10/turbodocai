"use client";
import { useState, useEffect, useRef } from "react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Headphones, Play, Download, StickyNote } from "lucide-react";
import { Course } from "@/lib/schema";
import Link from "next/link";
import Image from "next/image";
import ChapterChecks from "@/components/ChapterChecks";
import PodcastPlayer from "@/components/PodcastPlayer";
import WikiImage from "@/app/components/WikiImage";
import { buildWikiImageQueryCandidates } from "@/lib/wikiQuery";
import WebNotes from "@/components/WebNotes";

export default function CourseViewer({
  course,
  userPrompt,
}: {
  course: Course;
  userPrompt?: string;
}) {
  // UI State
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"read" | "listen" | "notes">("read");

  // On-demand audio generation/playback state (per current section)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  
  // Image generation state
  const [courseImage, setCourseImage] = useState<string | null>(course?.courseImage ?? null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Web sources (Google CSE results) for transparency/citations
  type WebSource = {
    url: string;
    title?: string;
    snippet?: string;
    displayLink?: string;
  };
  const [sources, setSources] = useState<WebSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);

  const courseId = (course as unknown as { id?: string } | undefined)?.id ?? null;

  // refs for the navigation card and main content so we can scroll selected item into view
  const navRef = useRef<HTMLDivElement | null>(null);
  const mainContentRef = useRef<HTMLDivElement | null>(null);

  // Keep local state in sync when navigating between courses.
  useEffect(() => {
    setCourseImage(course?.courseImage ?? null);
    setImageError(false);
    setIsGeneratingImage(false);
  }, [course?.courseImage]);

  // Fetch web sources (best-effort). Only works once we have a stable courseId.
  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;

    setSourcesLoading(true);
    setSourcesError(null);

    fetch(`/api/courses/sources?courseId=${encodeURIComponent(courseId)}`, {
      method: "GET",
      headers: { accept: "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data?.results)) {
          setSources(data.results as WebSource[]);
        } else {
          setSources([]);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setSourcesError(e instanceof Error ? e.message : "Failed to load sources");
        setSources([]);
      })
      .finally(() => {
        if (cancelled) return;
        setSourcesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // Generate + persist course image only when missing.
  useEffect(() => {
    if (!courseId) return;

    if (!courseImage && !isGeneratingImage && !imageError) {
      setIsGeneratingImage(true);

      fetch("/api/courses/ensure-thumbnail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.success && typeof data?.courseImage === "string" && data.courseImage) {
            setCourseImage(data.courseImage);
          } else {
            setImageError(true);
          }
        })
        .catch(() => setImageError(true))
        .finally(() => setIsGeneratingImage(false));
    }
  }, [courseId, courseImage, isGeneratingImage, imageError]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const selector = `[data-section="m${activeModuleIdx}-s${activeSectionIdx}"]`;
    const el = nav.querySelector(selector) as HTMLElement | null;
    if (el) {
      // center the selected button in the scrollable nav
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    // also scroll the main content area to its top so the selected section starts from the top
    if (mainContentRef.current) {
      // compute element top relative to document and subtract sticky header height so content appears just below header
      const rect = mainContentRef.current.getBoundingClientRect();
      const headerEl = document.querySelector("header");
      const headerHeight = headerEl ? (headerEl as HTMLElement).offsetHeight : 0;
      const top = Math.max(0, window.scrollY + rect.top - headerHeight - 12);
      window.scrollTo({ top, behavior: "smooth" });
    }
  }, [activeModuleIdx, activeSectionIdx]);

  // On mount, scroll the nav card to the top so the first section is visible at the top
  useEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = 0;
    }
  }, []);

  // Safety check for empty streaming data
  const currentModule = course?.modules?.[activeModuleIdx];
  const currentSection = currentModule?.sections?.[activeSectionIdx];

  const notesStorageKey = (cid: string | null, sid: string | undefined) => {
    const c = cid ?? "course";
    const s = sid ?? "section";
    return `currio:courseNotes:${c}:${s}`;
  };

  const wikiQueryCandidates = currentSection
    ? buildWikiImageQueryCandidates({
        userPrompt,
        sectionTitle: currentSection.title,
        sectionImageSearchQuery: currentSection.imageSearchQuery,
        sectionExplanation: currentSection.explanation,
      })
    : undefined;

  // Normalize common “pseudo-headings” into real Markdown headings.
  // This protects the UI if the model outputs lines like:
  // "Chapter Title: ...", "Learning Objectives:", "Synthesis:" etc.
  // Without this, users can see “only paragraphs”.
  const normalizeCourseMarkdown = (raw: string): string => {
    let text = (raw ?? "").replace(/\\n/g, "\n").trim();
    if (!text) return "";

    const lines = text.split("\n");
    let hasExplicitHeading = false;
    for (const l of lines) {
      if (/^\s{0,3}#{1,6}\s+/.test(l)) {
        hasExplicitHeading = true;
        break;
      }
    }

    // If headings already exist, keep them.
    if (hasExplicitHeading) return text;

    // Convert common labels into ATX headings.
    text = text
      // Chapter title patterns
      .replace(/^\s*(Chapter\s*Title)\s*:\s*/gim, "# ")
      // Objectives
      .replace(/^\s*(Learning\s*Objectives)\s*:?\s*$/gim, "## Learning Objectives")
      // Synthesis
      .replace(/^\s*(Synthesis)\s*:?\s*$/gim, "## Synthesis")
      // Subheadings label
      .replace(/^\s*(Subheadings?)\s*:\s*$/gim, "## Subheadings")
      // If a line looks like a standalone title-ish label (ends with ':' and is reasonably short), treat as H2
      .replace(/^\s*([A-Z][^\n]{0,80})\s*:\s*$/gm, "## $1")
      // Also handle "Title -" patterns
      .replace(/^\s*([A-Z][^\n]{0,80})\s*-\s*$/gm, "## $1");

    return text;
  };

  // Split markdown content to insert image after 1st paragraph
  const getMarkdownParts = (content: string) => {
    if (!content) return { before: '', after: '' };
    
    // Split by double newlines to identify paragraphs
    const lines = content.split('\n');
    let paragraphCount = 0;
    let splitIndex = -1;
    let inCodeBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Track code blocks
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      
      // Skip empty lines and lines in code blocks
      if (!line || inCodeBlock) continue;
      
      // Check if this is likely a paragraph (not a heading, list, etc)
      if (!line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*') && 
          !line.startsWith('>') && !line.match(/^\d+\./)) {
        paragraphCount++;
        
        // After the 1st paragraph, find the next empty line or end
        if (paragraphCount === 1) {
          // Find the next empty line after this paragraph
          for (let j = i + 1; j < lines.length; j++) {
            if (!lines[j].trim()) {
              splitIndex = j;
              break;
            }
          }
          if (splitIndex === -1) splitIndex = i + 1;
          break;
        }
      }
    }
    
    if (splitIndex > 0) {
      return {
        before: lines.slice(0, splitIndex).join('\n'),
        after: lines.slice(splitIndex).join('\n'),
      };
    }
    
    return { before: content, after: '' };
  };

  // Navigation helpers
  const goToPreviousSection = () => {
    if (activeSectionIdx > 0) {
      setActiveSectionIdx(activeSectionIdx - 1);
    } else if (activeModuleIdx > 0) {
      const prevModule = course?.modules?.[activeModuleIdx - 1];
      if (prevModule?.sections) {
        setActiveModuleIdx(activeModuleIdx - 1);
        setActiveSectionIdx(prevModule.sections.length - 1);
      }
    }
  };

  const goToNextSection = () => {
    if (currentModule?.sections && activeSectionIdx < currentModule.sections.length - 1) {
      setActiveSectionIdx(activeSectionIdx + 1);
    } else if (course?.modules && activeModuleIdx < course.modules.length - 1) {
      setActiveModuleIdx(activeModuleIdx + 1);
      setActiveSectionIdx(0);
    }
  };

  const canGoPrevious = activeModuleIdx > 0 || activeSectionIdx > 0;
  const canGoNext =
    (currentModule?.sections && activeSectionIdx < currentModule.sections.length - 1) ||
    (course?.modules && activeModuleIdx < course.modules.length - 1);

  // Reset audio state when section changes (and release old blob URL)
  useEffect(() => {
    setAudioError(null);
    setIsGeneratingAudio(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.id]);

  const handlePlayPodcast = async () => {
    if (!currentSection) return;

    const script = (currentSection.podcastScript ?? "").replace(/\\n/g, "\n").trim();
    if (!script) {
      setAudioError("No podcast script available for this section yet.");
      return;
    }

    // If already have audio, let user know to use the player at the bottom
    if (audioUrl) {
      console.log("[Client] Audio already generated, use player controls");
      setAudioError(null);
      return;
    }

    // Don't start multiple generations
    if (isGeneratingAudio) {
      return;
    }

    setAudioError(null);
    setIsGeneratingAudio(true);

    try {
      const res = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          key: `${courseId ?? "course"}:${currentSection.id}`,
        }),
      });

      console.log("[Client] API response status:", res.status);
      console.log("[Client] Response headers:", Object.fromEntries(res.headers.entries()));

      if (!res.ok) {
        const maybeJson = await res
          .json()
          .catch(() => ({ error: `Request failed (${res.status})` }));
        console.error("[Client] API error response:", maybeJson);
        throw new Error(maybeJson?.error || `Audio generation failed (${res.status})`);
      }

      const buf = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "audio/mpeg";
      const blob = new Blob([buf], { type: contentType });
      const url = URL.createObjectURL(blob);
      
      setAudioUrl(url);
      setAudioMimeType(contentType);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate audio";
      setAudioError(msg);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  if (!course)
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-500">Initializing Course...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-white font-sans text-[#1A1A1A] pb-28">
      {/* --- TOP NAVIGATION --- */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-serif font-bold tracking-tight">Currio</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/signup" 
            className="px-5 py-2 text-sm font-medium bg-[#FBE7A1] hover:bg-[#F7D978] text-[#1A1A1A] rounded-full transition-colors"
          >
            Sign Up
          </Link>
          <Link 
            href="/login" 
            className="px-5 py-2 text-sm font-medium border border-gray-200 rounded-full text-[#1A1A1A] hover:bg-gray-50 transition-colors"
          >
            Log In
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* --- LEFT SIDEBAR (Navigation Card) --- */}
          <aside className="w-full lg:w-80 shrink-0">
            <div ref={navRef} className="bg-white border border-gray-300 rounded-2xl p-6 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar shadow-sm">
              {/* Course Info */}
              <div className="pb-6 mb-6 border-b border-gray-300">
                <div className="aspect-video bg-[#F8F6F3] rounded-xl mb-6 relative overflow-hidden flex items-center justify-center">
                  {isGeneratingImage ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                      <span className="text-sm text-gray-500">Generating image...</span>
                    </div>
                  ) : courseImage && !imageError ? (
                    <Image 
                      src={`data:image/png;base64,${courseImage}`}
                      alt={course.courseTitle || "Course thumbnail"}
                      className="w-full h-full object-cover"
                      width={1024}
                      height={576}
                      unoptimized
                    />
                  ) : (
                    <span className="text-4xl">🎓</span>
                  )}
                </div>
                <h2 className="font-serif font-bold text-xl leading-tight text-[#1A1A1A]">
                  {course.courseTitle || "Generating..."}
                </h2>
              </div>

              {/* Navigation */}
              <nav className="space-y-6">
                {course.modules?.map((module, mIdx) => (
                  <div key={mIdx}>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
                      {module.moduleTitle}
                    </h3>
                    <div className="space-y-1">
                      {module.sections?.map((section, sIdx) => {
                        const isActive =
                          mIdx === activeModuleIdx && sIdx === activeSectionIdx;
                        return (
                          <button
                            key={sIdx}
                            data-section={`m${mIdx}-s${sIdx}`}
                            onClick={() => {
                              setActiveModuleIdx(mIdx);
                              setActiveSectionIdx(sIdx);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                              isActive
                                ? "bg-[#F8F6F3] text-black font-medium"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {section.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* --- MAIN CONTENT --- */}
          <main className="flex-1 min-w-0">
              <div ref={mainContentRef} className="max-w-3xl">
              {/* Course Header in Main Content */}
              <div className="mb-5 pb-5">
                <h1 className="font-serif text-4xl md:text-5xl font-medium text-[#1A1A1A] mb-6 leading-tight">
                  {course.courseTitle}
                </h1>
                <p className="text-lg text-gray-600 leading-relaxed">
                  {course.courseDescription}
                </p>
              </div>

              {currentSection ? (
                <div className="animate-in fade-in duration-500">
                  {/* Section Header */}
                  <div className="mb-8">
                    <h2 className="font-serif text-3xl font-medium text-[#1A1A1A] mb-6">
                      {currentSection.title}
                    </h2>

                    {/* Separator Line */}
                    <div className="border-t border-gray-300 mb-6"></div>

                    {/* Tabs & Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-8">
                        <button
                          onClick={() => setActiveTab("read")}
                          className={`pb-4 flex items-center gap-2 text-sm font-medium transition-all border-b-2 ${
                            activeTab === "read"
                              ? "border-black text-black"
                              : "border-transparent text-gray-500 hover:text-gray-800"
                          }`}
                        >
                          <BookOpen size={18} /> Explanation
                        </button>
                        <button
                          onClick={() => setActiveTab("listen")}
                          className={`pb-4 flex items-center gap-2 text-sm font-medium transition-all border-b-2 ${
                            activeTab === "listen"
                              ? "border-black text-black"
                              : "border-transparent text-gray-500 hover:text-gray-800"
                          }`}
                        >
                          <Headphones size={18} /> Podcast
                        </button>
                        <button
                          onClick={() => setActiveTab("notes")}
                          className={`pb-4 flex items-center gap-2 text-sm font-medium transition-all border-b-2 ${
                            activeTab === "notes"
                              ? "border-black text-black"
                              : "border-transparent text-gray-500 hover:text-gray-800"
                          }`}
                        >
                          <StickyNote size={18} /> Notes
                        </button>
                      </div>
                      <div className="pb-3 flex items-center gap-3">
                        <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                          <Download size={18} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsSourcesOpen(true)}
                          disabled={sourcesLoading || !courseId}
                          className={`text-xs font-medium bg-gray-100 px-3 py-1.5 rounded-full transition-colors ${
                            sourcesLoading || !courseId
                              ? "text-gray-400 cursor-not-allowed"
                              : "text-gray-700 hover:bg-gray-200"
                          }`}
                          title={
                            !courseId
                              ? "Sources will appear once the course is assigned an ID"
                              : sourcesLoading
                                ? "Loading sources…"
                                : "View web sources"
                          }
                        >
                          {sourcesLoading ? "Sources…" : `${sources.length} Sources`}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sources Modal */}
                  {isSourcesOpen ? (
                    <div className="fixed inset-0 z-50">
                      <button
                        type="button"
                        className="absolute inset-0 bg-black/40"
                        aria-label="Close sources"
                        onClick={() => setIsSourcesOpen(false)}
                      />
                      <div className="absolute left-1/2 top-1/2 w-[min(720px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white border border-gray-200 shadow-xl">
                        <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">Web sources</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              These are the web search results used to ground the course generation.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsSourcesOpen(false)}
                            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            Close
                          </button>
                        </div>

                        <div className="p-6 max-h-[70vh] overflow-y-auto">
                          {sourcesError ? (
                            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                              {sourcesError}
                            </div>
                          ) : null}

                          {!sourcesLoading && sources.length === 0 ? (
                            <div className="text-sm text-gray-600">
                              No web sources were recorded for this course. (Search might be disabled/misconfigured, or generation happened without search results.)
                            </div>
                          ) : null}

                          <div className="space-y-4">
                            {sources.map((s, idx) => (
                              <div key={s.url + idx} className="p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <a
                                      href={s.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm font-semibold text-gray-900 hover:underline break-words"
                                    >
                                      {s.title || s.url}
                                    </a>
                                    <div className="text-xs text-gray-500 mt-1 break-words">
                                      {s.displayLink || (() => {
                                        try { return new URL(s.url).hostname; } catch { return s.url; }
                                      })()}
                                    </div>
                                  </div>
                                </div>
                                {s.snippet ? (
                                  <p className="text-sm text-gray-700 mt-3 leading-relaxed">{s.snippet}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Content */}
                  <div className="max-w-none">
                    {activeTab === "read" ? (
                      <>
                        {(() => {
                          const content = normalizeCourseMarkdown(currentSection.explanation ?? '');
                          const { before, after } = getMarkdownParts(content);
                          
                          /* eslint-disable @typescript-eslint/no-explicit-any */
                          const markdownComponents = {
                            h1: ({ children, ...props }: any) => {
                              // Hide the first H1 if it matches the section title
                              const headingText = typeof children === 'string' ? children : 
                                Array.isArray(children) ? children.join('') : '';
                              if (headingText.trim() === currentSection.title.trim()) {
                                return null;
                              }
                              return (
                                <h1
                                  className="font-serif text-3xl font-medium text-[#1A1A1A] mt-12 mb-6 leading-tight"
                                  {...props}
                                >
                                  {children}
                                </h1>
                              );
                            },
                            h2: ({ ...props }: any) => (
                              <h2
                                className="font-serif text-2xl font-medium text-[#1A1A1A] mt-10 mb-5 leading-tight"
                                {...props}
                              />
                            ),
                            h3: ({ ...props }: any) => (
                              <h3
                                className="font-serif text-xl font-medium text-[#1A1A1A] mt-8 mb-4 leading-tight"
                                {...props}
                              />
                            ),
                            h4: ({ ...props }: any) => (
                              <h4
                                className="font-sans text-lg font-semibold text-[#1A1A1A] mt-6 mb-3"
                                {...props}
                              />
                            ),
                            p: ({ children, ...props }: any) => (
                              <p
                                className="text-[#1A1A1A] leading-relaxed mb-6 text-[17px]"
                                {...props}
                              >
                                {children}
                              </p>
                            ),
                            ul: ({ ...props }: any) => (
                              <ul
                                className="list-none mb-8 space-y-3 text-[#1A1A1A]"
                                {...props}
                              />
                            ),
                            ol: ({ ...props }: any) => (
                              <ol
                                className="list-decimal list-outside ml-6 mb-8 space-y-3 text-[#1A1A1A]"
                                {...props}
                              />
                            ),
                            li: ({ children, ...props }: any) => {
                              // Check if this is a nested list item (definition-style)
                              const hasNestedContent = React.Children.toArray(children).some(
                                child => typeof child === 'object'
                              );
                              
                              return (
                                <li 
                                  className={`leading-relaxed text-[17px] ${
                                    hasNestedContent ? 'ml-0' : 'ml-0'
                                  }`}
                                  {...props}
                                >
                                  <span className="inline-flex items-start">
                                    <span className="mr-3 mt-2 text-gray-400">•</span>
                                    <span className="flex-1">{children}</span>
                                  </span>
                                </li>
                              );
                            },
                            blockquote: ({ children, ...props }: any) => {
                              return (
                                <blockquote
                                  className="border-l-4 border-[#F7D978] pl-6 pr-4 py-5 my-8 bg-[#fbe7a1] text-[#1A1A1A] rounded-r-lg shadow-sm"
                                  {...props}
                                >
                                  <div className="space-y-3">
                                    {children}
                                  </div>
                                </blockquote>
                              );
                            },
                            strong: ({ children, ...props }: any) => {
                              return (
                                <strong
                                  className="font-semibold text-[#1A1A1A]"
                                  {...props}
                                >
                                  {children}
                                </strong>
                              );
                            },
                            em: ({ ...props }: any) => (
                              <em
                                className="text-gray-500 text-sm not-italic"
                                {...props}
                              />
                            ),
                            code: ({ ...props }: any) => (
                              <code
                                className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[15px] font-mono"
                                {...props}
                              />
                            ),
                            pre: ({ ...props }: any) => (
                              <pre
                                className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6 overflow-x-auto"
                                {...props}
                              />
                            ),
                            hr: ({ ...props }: any) => (
                              <hr
                                className="border-t border-gray-300 my-10"
                                {...props}
                              />
                            ),
                            table: ({ ...props }: any) => (
                              <div className="overflow-x-auto my-8 border border-gray-300 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-300 text-sm" {...props} />
                              </div>
                            ),
                            thead: ({ ...props }: any) => (
                              <thead className="bg-gray-50" {...props} />
                            ),
                            tbody: ({ ...props }: any) => (
                              <tbody className="divide-y divide-gray-300 bg-white" {...props} />
                            ),
                            tr: ({ ...props }: any) => (
                              <tr className="transition-colors hover:bg-gray-50/50" {...props} />
                            ),
                            th: ({ ...props }: any) => (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-sans" {...props} />
                            ),
                            td: ({ ...props }: any) => (
                              <td className="px-4 py-3 whitespace-normal text-gray-700" {...props} />
                            ),
                          };
                          /* eslint-enable @typescript-eslint/no-explicit-any */

                          return (
                            <>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {before}
                              </ReactMarkdown>
                              
                              {wikiQueryCandidates && after ? (
                                <div className="mb-6">
                                  <WikiImage 
                                    key={currentSection.id}
                                    queries={wikiQueryCandidates} 
                                  />
                                </div>
                              ) : null}
                              
                              {after ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={markdownComponents}
                                >
                                  {after}
                                </ReactMarkdown>
                              ) : null}
                            </>
                          );
                        })()}
                        
                        <ChapterChecks
                          key={currentSection.id}
                          quiz={currentSection.quiz}
                          flashcards={currentSection.flashcards}
                        />
                      </>
                    ) : (
                      activeTab === "listen" ? (
                        // Podcast View
                        <div className="bg-[#F8F6F3] rounded-2xl p-8 border border-gray-300">
                          {audioUrl ? (
                            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-sm text-green-700 font-medium">
                                ✓ Audio ready! Use the player at the bottom of the page to play, pause, and control playback.
                              </p>
                            </div>
                          ) : null}
                          
                          <div className="flex items-center gap-5 mb-8">
                            <button
                              onClick={handlePlayPodcast}
                              disabled={isGeneratingAudio || !!audioUrl}
                              className={`w-14 h-14 bg-black rounded-full flex items-center justify-center transition shadow-lg ${
                                isGeneratingAudio || audioUrl ? "opacity-60 cursor-not-allowed" : "hover:scale-105"
                              }`}
                              aria-label={audioUrl ? "Audio ready - use player below" : "Generate and play podcast"}
                            >
                              {isGeneratingAudio ? (
                                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Play
                                  fill="white"
                                  size={24}
                                  className="ml-1 text-white"
                                />
                              )}
                            </button>
                            <div>
                              <p className="font-bold text-lg text-gray-900">
                                Audio Overview
                              </p>
                              <p className="text-sm text-gray-500">
                                {isGeneratingAudio
                                  ? "Generating audio…"
                                  : `AI Generated Conversation • ${currentSection.readingTime} listen`}
                              </p>
                            </div>
                          </div>

                          {audioError ? (
                            <div className="mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                              {audioError}
                            </div>
                          ) : null}

                          <div className="prose prose-sm font-mono text-gray-600 whitespace-pre-line">
                            {(currentSection.podcastScript ?? '').replace(/\\n/g, '\n')}
                          </div>
                        </div>
                      ) : (
                        // Notes View
                        <WebNotes storageKey={notesStorageKey(courseId, currentSection?.id)} />
                      )
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 animate-pulse">
                <div className="h-4 w-3/4 bg-gray-100 rounded mb-4"></div>
                <div className="h-4 w-1/2 bg-gray-100 rounded"></div>
                <p className="mt-8 text-sm">Generating course content...</p>
              </div>
            )}
          </div>
        </main>
     </div>
    </div>

      {/* Persistent Bottom Podcast Player */}
      <PodcastPlayer
        audioUrl={audioUrl}
        audioMimeType={audioMimeType}
        title={currentSection?.title}
        thumbnail={courseImage}
        isLoading={isGeneratingAudio}
        onPrevious={goToPreviousSection}
        onNext={goToNextSection}
        canGoPrevious={canGoPrevious}
        canGoNext={canGoNext}
      />
  </div>
  );
}