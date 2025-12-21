"use client";
import { useState, useEffect, useRef } from "react";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Headphones, Play, Download } from "lucide-react";
import { Course } from "@/lib/schema";
import Link from "next/link";
import Image from "next/image";

export default function CourseViewer({ course }: { course: Course }) {
  // UI State
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"read" | "listen">("read");
  
  // Image generation state
  const [courseImage, setCourseImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState(false);

  // refs for the navigation card and main content so we can scroll selected item into view
  const navRef = useRef<HTMLDivElement | null>(null);
  const mainContentRef = useRef<HTMLDivElement | null>(null);

  // Generate course image when course title is available
  useEffect(() => {
    if (course?.courseTitle && !courseImage && !isGeneratingImage && !imageError) {
      setIsGeneratingImage(true);
      
      fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: course.courseTitle }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success && data.image) {
            setCourseImage(data.image);
          } else {
            setImageError(true);
          }
        })
        .catch(() => {
          setImageError(true);
        })
        .finally(() => {
          setIsGeneratingImage(false);
        });
    }
  }, [course?.courseTitle, courseImage, isGeneratingImage, imageError]);

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
    <div className="min-h-screen bg-white font-sans text-[#1A1A1A]">
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
              <div className="mb-12 border-b border-gray-300 pb-12">
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
                    <h2 className="font-serif text-3xl font-medium text-[#1A1A1A] mb-8">
                      {currentSection.title}
                    </h2>

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
                      </div>
                      <div className="pb-3 flex items-center gap-3">
                        <button className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                          <Download size={18} />
                        </button>
                        {/* <span className="text-xs font-medium bg-gray-100 px-3 py-1.5 rounded-full text-gray-600">
                          2 Sources
                        </span> */}
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="max-w-none">
                    {activeTab === "read" ? (
                      <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ ...props }) => (
                          <h1
                            className="font-serif text-3xl font-medium text-[#1A1A1A] mt-12 mb-6 leading-tight"
                            {...props}
                          />
                        ),
                        h2: ({ ...props }) => (
                          <h2
                            className="font-serif text-2xl font-medium text-[#1A1A1A] mt-10 mb-5 leading-tight"
                            {...props}
                          />
                        ),
                        h3: ({ ...props }) => (
                          <h3
                            className="font-serif text-xl font-medium text-[#1A1A1A] mt-8 mb-4 leading-tight"
                            {...props}
                          />
                        ),
                        h4: ({ ...props }) => (
                          <h4
                            className="font-sans text-lg font-semibold text-[#1A1A1A] mt-6 mb-3"
                            {...props}
                          />
                        ),
                        p: ({ children, ...props }) => {
                          return (
                            <p
                              className="text-[#1A1A1A] leading-relaxed mb-6 text-[17px]"
                              {...props}
                            >
                              {children}
                            </p>
                          );
                        },
                        ul: ({ ...props }) => (
                          <ul
                            className="list-none mb-8 space-y-3 text-[#1A1A1A]"
                            {...props}
                          />
                        ),
                        ol: ({ ...props }) => (
                          <ol
                            className="list-decimal list-outside ml-6 mb-8 space-y-3 text-[#1A1A1A]"
                            {...props}
                          />
                        ),
                        li: ({ children, ...props }) => {
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
                        blockquote: ({ children, ...props }) => {
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
                        strong: ({ children, ...props }) => {
                          return (
                            <strong
                              className="font-semibold text-[#1A1A1A]"
                              {...props}
                            >
                              {children}
                            </strong>
                          );
                        },
                        em: ({ ...props }) => (
                          <em
                            className="text-gray-500 text-sm not-italic"
                            {...props}
                          />
                        ),
                        code: ({ ...props }) => (
                          <code
                            className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[15px] font-mono"
                            {...props}
                          />
                        ),
                        pre: ({ ...props }) => (
                          <pre
                            className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6 overflow-x-auto"
                            {...props}
                          />
                        ),
                        hr: ({ ...props }) => (
                          <hr
                            className="border-t border-gray-300 my-10"
                            {...props}
                          />
                        ),
                        table: ({ ...props }) => (
                          <div className="overflow-x-auto my-8 border border-gray-300 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300 text-sm" {...props} />
                          </div>
                        ),
                        thead: ({ ...props }) => (
                          <thead className="bg-gray-50" {...props} />
                        ),
                        tbody: ({ ...props }) => (
                          <tbody className="divide-y divide-gray-300 bg-white" {...props} />
                        ),
                        tr: ({ ...props }) => (
                          <tr className="transition-colors hover:bg-gray-50/50" {...props} />
                        ),
                        th: ({ ...props }) => (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider font-sans" {...props} />
                        ),
                        td: ({ ...props }) => (
                          <td className="px-4 py-3 whitespace-normal text-gray-700" {...props} />
                        ),
                      }}
                    >
                      { (currentSection.explanation ?? '').replace(/\\n/g, '\n') }
                    </ReactMarkdown>
                  ) : (
                    // Podcast View
                    <div className="bg-[#F8F6F3] rounded-2xl p-8 border border-gray-300">
                      <div className="flex items-center gap-5 mb-8">
                        <button className="w-14 h-14 bg-black rounded-full flex items-center justify-center hover:scale-105 transition shadow-lg">
                          <Play
                            fill="white"
                            size={24}
                            className="ml-1 text-white"
                          />
                        </button>
                        <div>
                          <p className="font-bold text-lg text-gray-900">
                            Audio Overview
                          </p>
                          <p className="text-sm text-gray-500">
                            AI Generated Conversation • {currentSection.readingTime} listen
                          </p>
                        </div>
                      </div>
                      <div className="prose prose-sm font-mono text-gray-600 whitespace-pre-line">
                        {(currentSection.podcastScript ?? '').replace(/\\n/g, '\n')}
                      </div>
                    </div>
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
  </div>
  );
}