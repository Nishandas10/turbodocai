"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { BookOpen, MessageSquare, Upload, Video, Zap, Headphones, FileAudio, Pencil, Brain, GitBranch, PenTool, Eye, Share2, Move, Plus, Lock, FileUp, Settings2, RefreshCcw, BarChart3, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Navbar from "./components/navbar"
import FeatureCard from "./components/feature-card"
import HowItWorks from "./components/how-it-works"
import Testimonials from "./components/testimonials"
import Pricing from "./components/pricing"
import FAQ from "./components/faq"
import Footer from "./components/footer"
import Link from "next/link"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // Organization logos for the Trusted By section
  const logos = [
    { src: "/orgs/iitj.png", alt: "IIT Jodhpur" },
    { src: "/orgs/National_Institute_of_Technology,_Nagaland_Logo.png", alt: "NIT Nagaland" },
    { src: "/orgs/Gauhati_University_Logo.png", alt: "Gauhati University" },
    { src: "/orgs/Deloitte-Logo.wine.png", alt: "Deloitte" },
    { src: "/orgs/google-logo.png", alt: "Google" },
    { src: "/orgs/trellix.png", alt: "Trellix" },
  ]

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
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Space Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-purple-900/20 to-black"></div>
      
      {/* Nebula Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(120,119,198,0.3),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(59,130,246,0.2),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(120,119,198,0.15),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.15),transparent_50%)]"></div>
      
      {/* Stars */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-1 h-1 bg-white rounded-full animate-pulse"></div>
        <div className="absolute top-40 left-40 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-60 left-60 w-1 h-1 bg-blue-300 rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute top-80 left-80 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
        <div className="absolute top-32 left-96 w-1 h-1 bg-purple-300 rounded-full animate-pulse" style={{animationDelay: '1.5s'}}></div>
        <div className="absolute top-96 left-32 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '2.5s'}}></div>
        
        <div className="absolute top-20 right-20 w-1 h-1 bg-white rounded-full animate-pulse" style={{animationDelay: '0.8s'}}></div>
        <div className="absolute top-40 right-40 w-0.5 h-0.5 bg-blue-300 rounded-full animate-pulse" style={{animationDelay: '1.8s'}}></div>
        <div className="absolute top-60 right-60 w-1 h-1 bg-white rounded-full animate-pulse" style={{animationDelay: '0.3s'}}></div>
        <div className="absolute top-80 right-80 w-0.5 h-0.5 bg-purple-300 rounded-full animate-pulse" style={{animationDelay: '1.2s'}}></div>
        <div className="absolute top-32 right-96 w-1 h-1 bg-white rounded-full animate-pulse" style={{animationDelay: '2.8s'}}></div>
        <div className="absolute top-96 right-32 w-0.5 h-0.5 bg-blue-300 rounded-full animate-pulse" style={{animationDelay: '0.7s'}}></div>
        
        <div className="absolute top-1/2 left-1/4 w-1 h-1 bg-white rounded-full animate-pulse" style={{animationDelay: '1.3s'}}></div>
        <div className="absolute top-1/3 left-1/3 w-0.5 h-0.5 bg-purple-300 rounded-full animate-pulse" style={{animationDelay: '0.9s'}}></div>
        <div className="absolute top-2/3 left-2/3 w-1 h-1 bg-blue-300 rounded-full animate-pulse" style={{animationDelay: '2.1s'}}></div>
        <div className="absolute top-1/4 left-1/2 w-0.5 h-0.5 bg-white rounded-full animate-pulse" style={{animationDelay: '1.7s'}}></div>
      </div>
      
      {/* Shooting Stars */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-0.5 h-0.5 bg-white rounded-full animate-ping" style={{animationDuration: '3s', animationIterationCount: 'infinite'}}></div>
        <div className="absolute top-0 right-1/3 w-0.5 h-0.5 bg-blue-300 rounded-full animate-ping" style={{animationDuration: '4s', animationIterationCount: 'infinite', animationDelay: '1s'}}></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <Navbar />

        {/* Hero Section */}
        <section className="relative py-20 md:py-28 overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6">
                Transform Content Into <span className="text-blue-600">Learning Experiences</span>
                </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto">
                  Upload any content. Get AI-powered summaries, quizzes, flashcards, and a smart chatbot that understands
                  your material.
                </p>
              <div className="mb-12">
                <Button size="lg" className="bg-blue-600/80 hover:bg-blue-700/80 text-white text-lg px-12 py-4 h-auto backdrop-blur-sm border border-blue-500/50 rounded-2xl shadow-lg transition-all duration-300 hover:scale-105" asChild>
                  <Link href="/signup">Get Started</Link>
                  </Button>
                <div className="mt-6 flex flex-col items-center space-y-3">
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    {/* Simple avatar circles using brand accents */}
                    <span className="flex -space-x-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white ring-2 ring-black">A</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-600 text-[10px] font-semibold text-white ring-2 ring-black">F</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[10px] font-semibold text-white ring-2 ring-black">R</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white ring-2 ring-black">Z</span>
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white ring-2 ring-black">A</span>
                    </span>
                    <span className="text-gray-300">
                      <span className="font-semibold text-white">17,857+</span> users getting ahead of the competition
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trusted By Section */}
  <section className="py-8 relative">
          <div className="container mx-auto px-4 text-center mb-12">
            <h2 className="text-lg md:text-xl font-medium text-white mb-4">
              BlumeNote AI is trusted by students and professionals at
            </h2>
          </div>

          {/* Animated Logo Scroll */}
          <div className="relative overflow-hidden max-w-5xl mx-auto">
            <div className="flex animate-scroll-left space-x-16">
              {/* First set of logos */}
              <div className="flex items-center space-x-16 flex-shrink-0">
                {logos.map(l => (
                  <div key={l.alt} className="flex items-center justify-center">
                    <Image
                      src={l.src}
                      alt={l.alt}
                      width={140}
                      height={60}
                      className="h-12 w-auto object-contain"
                      priority
                    />
                  </div>
                ))}
              </div>
              {/* Second set for seamless loop */}
              <div className="flex items-center space-x-16 flex-shrink-0">
                {logos.map(l => (
                  <div key={l.alt + '-2'} className="flex items-center justify-center">
                    <Image
                      src={l.src}
                      alt={l.alt}
                      width={140}
                      height={60}
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
              {/* Third set for seamless loop */}
              <div className="flex items-center space-x-16 flex-shrink-0">
                {logos.map(l => (
                  <div key={l.alt + '-3'} className="flex items-center justify-center">
                    <Image
                      src={l.src}
                      alt={l.alt}
                      width={140}
                      height={60}
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
  <section className="py-20 border-t border-gray-800/40" id="features">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              {/* <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Powerful Learning Features
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Our platform transforms any content into interactive learning materials using advanced AI.
              </p> */}
            </div>

            {/* Spotlight Feature: Smart Summaries */}
            <div className="max-w-7xl mx-auto mb-32 px-2">
              <div className="space-y-14">
                <div className="space-y-7 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-300 text-[11px] font-medium tracking-wide uppercase">Unified Intelligence</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-[11px] font-medium tracking-wide uppercase">AI Powered</span>
                  </div>
                  <h3 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight max-w-5xl mx-auto">
                    Beyond Summaries: Your <span className="text-blue-500">All‑In‑One</span> Learning Workspace
                  </h3>
                  <p className="text-gray-300 text-lg leading-relaxed max-w-4xl mx-auto">
                    Turn raw content into a living knowledge layer. Upload anything—PDFs, lecture videos, meetings, research papers—then watch it transform into structured summaries, interactive study assets, and real-time AI collaboration.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 max-w-6xl mx-auto">
                    {/* Feature Tile */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-600/25 border border-blue-500/30 flex items-center justify-center text-blue-300">
                        <Brain className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Semantic Summaries</p>
                        <p className="text-sm text-gray-400 leading-snug">Layered structure with key concepts & context linking.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-purple-600/25 border border-purple-500/30 flex items-center justify-center text-purple-300">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Chat Any Document</p>
                        <p className="text-sm text-gray-400 leading-snug">Follow‑ups with citations & reasoning traceability.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-600/25 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Flashcards & Quizzes</p>
                        <p className="text-sm text-gray-400 leading-snug">Adaptive recall + spaced assessment generation.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-pink-600/25 border border-pink-500/30 flex items-center justify-center text-pink-300">
                        <Headphones className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">AI Podcast Mode</p>
                        <p className="text-sm text-gray-400 leading-snug">Natural narrated audio of your compiled insights.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-orange-500/25 border border-orange-500/40 flex items-center justify-center text-orange-300">
                        <Pencil className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Live Cursor Editor</p>
                        <p className="text-sm text-gray-400 leading-snug">Real-time AI drafting & refinement collaboration.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                        <FileAudio className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Context Memory Engine</p>
                        <p className="text-sm text-gray-400 leading-snug">Cross‑doc synthesis & persistent reasoning context.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-6">
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">No copy-paste prep</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Source traceability</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Study acceleration</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Retention focused</span>
                  </div>
                </div>
                <div className="relative group max-w-6xl mx-auto">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/40 via-purple-600/30 to-fuchsia-600/20 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                  <div className="relative rounded-3xl overflow-hidden border border-gray-800/70 bg-gray-900/70 backdrop-blur-sm shadow-[0_0_45px_-8px_rgba(59,130,246,0.55)] p-4">
                    <div className="relative w-full">
                      <Image
                        src="/ss/summary.jpg"
                        alt="Unified AI learning workspace screenshot"
                        width={2200}
                        height={1700}
                        className="w-full h-auto object-contain mx-auto"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mindmaps Spotlight */}
            <div className="max-w-7xl mx-auto mb-32 px-2">
              <div className="space-y-14">
                <div className="space-y-7 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-600/20 border border-green-500/30 text-green-300 text-[11px] font-medium tracking-wide uppercase">Visual Learning</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium tracking-wide uppercase">Active Recall</span>
                  </div>
                  <h3 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight max-w-5xl mx-auto">
                    Mindmaps: Structure <span className="text-green-400">Ideas</span>, Strengthen <span className="text-indigo-400">Memory</span>
                  </h3>
                  <p className="text-gray-300 text-lg leading-relaxed max-w-4xl mx-auto">
                    Instantly convert complex topics into living, explorable knowledge graphs. Perfect for rapid revision, conceptual clarity, and visual memory retention. Build, expand, and refine ideas in a fluid canvas that grows with your understanding.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 max-w-6xl mx-auto">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-green-600/25 border border-green-500/30 flex items-center justify-center text-green-300">
                        <GitBranch className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Organic Knowledge Graphs</p>
                        <p className="text-sm text-gray-400 leading-snug">Break big subjects into digestible, linked concept nodes.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                        <PenTool className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Inline Editing</p>
                        <p className="text-sm text-gray-400 leading-snug">Rename, annotate & color‑code nodes without breaking focus.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-fuchsia-600/25 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300">
                        <Move className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Fluid Drag & Arrange</p>
                        <p className="text-sm text-gray-400 leading-snug">Smooth physics-inspired repositioning and clustering.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-purple-600/25 border border-purple-500/30 flex items-center justify-center text-purple-300">
                        <Plus className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Instant Expansion</p>
                        <p className="text-sm text-gray-400 leading-snug">Add sibling or child nodes with a single intelligent action.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-cyan-600/25 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                        <Eye className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Revision Heat Zones</p>
                        <p className="text-sm text-gray-400 leading-snug">Visual emphasis on weak or under-explored areas.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-amber-600/25 border border-amber-500/30 flex items-center justify-center text-amber-300">
                        <Share2 className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Share & Co‑Create</p>
                        <p className="text-sm text-gray-400 leading-snug">Collaborate or export snapshots for spaced repetition decks.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-6">
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Spatial memory boost</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Rapid revision views</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Cognitive mapping</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Focus-driven layout</span>
                  </div>
                </div>
                <div className="relative group max-w-6xl mx-auto">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-green-500/35 via-indigo-500/30 to-fuchsia-500/20 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                  <div className="relative rounded-3xl overflow-hidden border border-gray-800/70 bg-gray-900/70 backdrop-blur-sm shadow-[0_0_45px_-8px_rgba(16,185,129,0.45)] p-4">
                    <div className="relative w-full">
                      <Image
                        src="/ss/mindmap.png"
                        alt="Mindmap feature canvas screenshot"
                        width={2200}
                        height={1700}
                        className="w-full h-auto object-contain mx-auto"
                        priority
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Spaces & Testing Spotlight */}
            <div className="max-w-7xl mx-auto mb-32 px-2">
              <div className="space-y-14">
                <div className="space-y-7 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-400/30 text-yellow-300 text-[11px] font-medium tracking-wide uppercase">Private Spaces</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-[11px] font-medium tracking-wide uppercase">Custom Testing</span>
                  </div>
                  <h3 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight max-w-5xl mx-auto">
                    Your Secure <span className="text-yellow-300">Spaces</span> & Fully <span className="text-teal-300">Custom Tests</span>
                  </h3>
                  <p className="text-gray-300 text-lg leading-relaxed max-w-4xl mx-auto">
                    Organize learning inside private spaces where you can upload any format—PDFs, Docs, images, audio, links, or videos. Generate highly customizable tests (MCQs to long answers) with adjustable difficulty, timing, regeneration, and rich analytics for every attempt.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 max-w-6xl mx-auto">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-yellow-500/25 border border-yellow-400/30 flex items-center justify-center text-yellow-200"><Lock className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Private & Organized</p><p className="text-sm text-gray-400 leading-snug">Separate work, study, and research collections effortlessly.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-teal-500/25 border border-teal-400/30 flex items-center justify-center text-teal-200"><FileUp className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Multi‑Format Ingestion</p><p className="text-sm text-gray-400 leading-snug">PDF, video, audio, links, images—unified processing pipeline.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-sky-500/25 border border-sky-400/30 flex items-center justify-center text-sky-200"><Settings2 className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Adaptive Multi‑Format Testing</p><p className="text-sm text-gray-400 leading-snug">Difficulty tuning + MCQ & long answer generation in one smart engine.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/25 border border-emerald-400/30 flex items-center justify-center text-emerald-200"><Timer className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Custom Timing</p><p className="text-sm text-gray-400 leading-snug">Set focused sprint timers or full practice exam durations.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-500/25 border border-indigo-400/30 flex items-center justify-center text-indigo-200"><RefreshCcw className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Regenerate Attempts</p><p className="text-sm text-gray-400 leading-snug">Fresh question sets or targeted reattempt by document.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-rose-500/25 border border-rose-400/30 flex items-center justify-center text-rose-200"><BarChart3 className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Deep Performance Analytics</p><p className="text-sm text-gray-400 leading-snug">Granular per‑doc, per‑question, and trend breakdowns.</p></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-6">
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Unlimited iterations</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Retention tracking</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Exam prep mode</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Progress insights</span>
                  </div>
                </div>
                <div className="relative group max-w-6xl mx-auto">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-yellow-400/35 via-teal-400/30 to-indigo-400/20 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                  <div className="relative rounded-3xl overflow-hidden border border-gray-800/70 bg-gray-900/70 backdrop-blur-sm shadow-[0_0_45px_-8px_rgba(234,179,8,0.4)] p-4">
                    <div className="relative w-full">
                      <Image
                        src="/ss/spaces.png"
                        alt="Private spaces dashboard with test customization"
                        width={2200}
                        height={1700}
                        className="w-full h-auto object-contain mx-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Remaining Feature Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <FeatureCard
                icon={<Upload className="h-10 w-10 text-blue-400" />}
                title="Multi-Format Upload"
                description="Upload audio, video, PDFs, YouTube links, or meeting notes. Our platform handles it all."
              />
              <FeatureCard
                icon={<BookOpen className="h-10 w-10 text-blue-400" />}
                title="Interactive Quizzes"
                description="AI-generated quizzes to test your knowledge and reinforce learning with adaptive difficulty."
              />
              <FeatureCard
                icon={<Zap className="h-10 w-10 text-blue-400" />}
                title="Flashcards"
                description="Study efficiently with automatically generated flashcards covering important concepts."
              />
              <FeatureCard
                icon={<MessageSquare className="h-10 w-10 text-blue-400" />}
                title="Context-Aware Chatbot"
                description="Ask questions about your content and get accurate, contextual answers from our AI assistant."
              />
              <FeatureCard
                icon={<Video className="h-10 w-10 text-blue-400" />}
                title="Video Insights"
                description="Extract key moments and insights from video content with timestamps and transcripts."
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <HowItWorks />

        {/* Testimonials Section */}
        <Testimonials />

        {/* Pricing Section */}
        <Pricing />

        {/* FAQ Section */}
        <FAQ />

        {/* CTA Section */}
        <section className="py-20 text-white relative border-t border-gray-800/40">
          <div className="container mx-auto px-4 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Learning Experience?</h2>
            <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
              Join thousands of students and professionals who are learning smarter, not harder.
            </p>
            <Button size="lg" className="bg-white text-blue-900 hover:bg-gray-100" asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}
