"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link";
import { ArrowUp } from "lucide-react"
import Image from "next/image"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

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
          What do you want to learn about?
        </h1>
        {/* Search */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 rounded-full bg-white ring-1 ring-[#cccccc] px-6 py-4">
            <input
              type="text"
              placeholder="Teach me about..."
              className="flex-1 bg-transparent outline-none text-sm text-gray-600 placeholder:text-gray-400"
            />
            <button
              aria-label="Add topic"
              className="text-3xl text-gray-400 hover:text-gray-600 transition-colors leading-none"
            >
              +
            </button>
            <button
              aria-label="Search"
              className="size-10 rounded-full bg-black text-white grid place-items-center text-base hover:bg-gray-800 transition-colors"
            >
              <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </section>

      {/* Trending / Suggestions */}
      <section className="max-w-2xl mx-auto mt-12 space-y-6">
        {/* Group 1 */}
        <div>
          <div className="flex items-center gap-2 text-gray-500 mb-3 text-sm">
            <span>↗</span>
            <span>Art of Spending Money</span>
          </div>
          <a
            href="#"
            className="flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-3 hover:ring-black/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-linear-to-br from-orange-300 to-yellow-400 grid place-items-center overflow-hidden">
                <Image src="/window.svg" alt="topic" width={20} height={20} className="opacity-90" />
              </div>
              <div className="text-sm font-normal text-[#3A3A3A]">Mastering Your Money</div>
            </div>
            <div className="text-xl text-gray-300 group-hover:text-gray-400 transition-colors">›</div>
          </a>
        </div>

        {/* Group 2 */}
        <div>
          <div className="flex items-center gap-2 text-gray-500 mb-3 text-sm">
            <span>↗</span>
            <span>Terminology of watches</span>
          </div>
          <a
            href="#"
            className="flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-3 hover:ring-black/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-linear-to-br from-orange-200 to-orange-300 grid place-items-center overflow-hidden">
                <Image src="/file.svg" alt="topic" width={20} height={20} className="opacity-90" />
              </div>
              <div className="text-sm font-normal text-[#3A3A3A]">Watch Terminology Explained</div>
            </div>
            <div className="text-xl text-gray-300 group-hover:text-gray-400 transition-colors">›</div>
          </a>
        </div>

        {/* Group 3 */}
        <div>
          <div className="flex items-center gap-2 text-gray-500 mb-3 text-sm">
            <span>↗</span>
            <span>mixology</span>
          </div>
          <a
            href="#"
            className="flex items-center justify-between gap-3 rounded-2xl bg-white ring-1 ring-black/5 px-3 py-3 hover:ring-black/10 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-linear-to-br from-purple-200 to-pink-200 grid place-items-center overflow-hidden">
                <Image src="/globe.svg" alt="topic" width={20} height={20} className="opacity-90" />
              </div>
              <div className="text-sm font-normal text-[#3A3A3A]">Cocktail Mixology Basics</div>
            </div>
            <div className="text-xl text-gray-300 group-hover:text-gray-400 transition-colors">›</div>
          </a>
        </div>
      </section>
    </main>
    </div>
  )
}
