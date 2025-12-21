"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link";
import { ArrowUp } from "lucide-react"
import Image from "next/image"
import WebsiteLinkModal from "./components/WebsiteLinkModal"

// --- NEW IMPORTS ---
import { experimental_useObject as useObject } from "@ai-sdk/react"
import { courseSchema, type Course } from "@/lib/schema" // Make sure this path is correct
import CourseViewer from "@/components/CourseViewer" // Make sure this path is correct

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // UI States
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement | null>(null)
  const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false)
  
  // --- NEW LOGIC STATE ---
  type Source = { type: string; content: string }
  const [input, setInput] = useState("")
  const [sources, setSources] = useState<Source[]>([]) 

  // --- AI HOOK ---
  const courseIdRef = useRef<string | null>(null);

  const { object, submit, isLoading } = useObject({
    api: "/api/generate",
    schema: courseSchema,
    fetch: async (input, init) => {
      const res = await fetch(input, init);
      if (res.ok) {
        const id = res.headers.get("x-course-id");
        if (id) courseIdRef.current = id;
      }
      return res;
    },
    onFinish: ({ object }) => {
      // MAGIC: Automatically update URL to the permanent public link without reload
      const id = courseIdRef.current;
      if (id && object?.courseTitle) {
        const slug = slugify(object.courseTitle);
        // Use Next.js router to update navigation so the app state and router pathname stay in sync
        router.replace(`/course/${slug}-${id}`);
      } else if (id) {
        router.replace(`/course/${id}`);
      }
    },
  })

  // --- HANDLER ---
  const handleGenerate = () => {
    if (!input.trim()) return
    // Trigger the AI generation
    submit({ prompt: input, sources: sources })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGenerate()
    }
  }

  // Close the add menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setIsAddMenuOpen(false)
      }
    }

    if (isAddMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isAddMenuOpen])

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // If user is authenticated, redirect to dashboard
  if (user) {
    return null
  }

  // --- CONDITIONAL RENDERING ---
  // If the AI has started generating (object exists) or is loading, swap the view
  if (object || isLoading) {
    return <CourseViewer course={object as Course} />
  }

  return (
    <div className="min-h-screen bg-[#fcfaf8] flex flex-col">
      {/* Top bar: Brand + Auth - Fixed at top */}
      <div className="w-full flex items-center justify-between px-4 md:px-8 py-6">
        <Link href="/" className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Currio</Link>
        <div className="flex items-center gap-2">
              <nav className="flex items-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-full bg-[#FBE7A1] hover:bg-[#F7D978] text-[#1A1A1A] px-5 py-2 text-sm font-medium transition-colors"
                >
                  Sign Up
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm font-medium text-[#1A1A1A] hover:bg-black/5 transition-colors"
                >
                  Log In
                </Link>
              </nav>
        </div>
      </div>

      <main className="flex-1 px-6 pb-16">

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center mt-20">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <span className="text-6xl leading-none" role="img" aria-label="sloth">🦥</span>
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-normal text-[#3A3A3A] mb-1">
          What do you want to learn today?
        </h1>
        {/* Search */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 rounded-full bg-white ring-1 ring-[#cccccc] px-6 py-4 relative focus-within:ring-2 focus-within:ring-black/20 transition-shadow">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Teach me about..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-600 placeholder:text-gray-400"
            />
            <div ref={addMenuRef} className="relative">
              <button
                aria-label="Add topic"
                onClick={() => setIsAddMenuOpen((open) => !open)}
                className="text-3xl text-gray-400 hover:text-gray-600 transition-colors leading-none"
              >
                +
              </button>
              {isAddMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white text-sm text-gray-800 border border-gray-100 shadow-sm py-2 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddMenuOpen(false)
                      setIsWebsiteModalOpen(true)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">🔗</span>
                    <span>Add website link</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">▶️</span>
                    <span>YouTube video</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">🎙️</span>
                    <span>Record audio</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">📄</span>
                    <span>Upload docs</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs">📷</span>
                    <span>Camera</span>
                  </button>
                </div>
              )}
            </div>
            <button
              aria-label="Search"
              onClick={handleGenerate}
              disabled={!input.trim()}
              className="size-10 rounded-full bg-black text-white grid place-items-center text-base hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </section>

      <WebsiteLinkModal
        isOpen={isWebsiteModalOpen}
        onClose={() => setIsWebsiteModalOpen(false)}
        onLinkAdded={(url: string) => {
          setSources((prev) => [...prev, { type: "website", content: url }])
        }}
      />

      {/* Trending / Suggestions */}
      <section className="max-w-2xl mx-auto mt-12 space-y-6">
        {/* Group 1 */}
        <div>
          <div className="flex items-center gap-2 text-gray-500 mb-3 text-sm">
            <span>↗</span>
            <span>Art of Spending Money</span>
          </div>
          <button
            onClick={() => {
                setInput("Mastering Your Money");
                // Optional: Auto-submit on click?
                // submit({ prompt: "Mastering Your Money" });
            }}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-3 hover:ring-black/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-linear-to-br from-orange-300 to-yellow-400 grid place-items-center overflow-hidden">
                <Image src="/window.svg" alt="topic" width={20} height={20} className="opacity-90" />
              </div>
              <div className="text-sm font-normal text-[#3A3A3A]">Mastering Your Money</div>
            </div>
            <div className="text-xl text-gray-300 group-hover:text-gray-400 transition-colors">›</div>
          </button>
        </div>

        {/* Group 2 */}
        <div>
          <div className="flex items-center gap-2 text-gray-500 mb-3 text-sm">
            <span>↗</span>
            <span>Terminology of watches</span>
          </div>
          <button
            onClick={() => setInput("Watch Terminology Explained")}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-3 hover:ring-black/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-linear-to-br from-orange-200 to-orange-300 grid place-items-center overflow-hidden">
                <Image src="/file.svg" alt="topic" width={20} height={20} className="opacity-90" />
              </div>
              <div className="text-sm font-normal text-[#3A3A3A]">Watch Terminology Explained</div>
            </div>
            <div className="text-xl text-gray-300 group-hover:text-gray-400 transition-colors">›</div>
          </button>
        </div>

        {/* Group 3 */}
        <div>
          <div className="flex items-center gap-2 text-gray-500 mb-3 text-sm">
            <span>↗</span>
            <span>mixology</span>
          </div>
          <button
             onClick={() => setInput("Cocktail Mixology Basics")}
            className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-3 hover:ring-black/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-linear-to-br from-purple-200 to-pink-200 grid place-items-center overflow-hidden">
                <Image src="/globe.svg" alt="topic" width={20} height={20} className="opacity-90" />
              </div>
              <div className="text-sm font-normal text-[#3A3A3A]">Cocktail Mixology Basics</div>
            </div>
            <div className="text-xl text-gray-300 group-hover:text-gray-400 transition-colors">›</div>
          </button>
        </div>
      </section>
    </main>
    </div>
  )
}