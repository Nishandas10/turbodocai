"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { MessageSquare, Zap, Headphones, FileAudio, Pencil, Brain, GitBranch, PenTool, Eye, Share2, Move, Plus, Lock, FileUp, Settings2, RefreshCcw, BarChart3, Timer, Globe, Mic, Camera, Link2, LayoutDashboard, FilePlus} from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Navbar from "./components/navbar"
import HowItWorks from "./components/how-it-works"
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
  <section className="relative mt-20 py-20 md:py-28 overflow-hidden">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6">
        Turn anything into Notes📚<span className="text-blue-600">Study 10x faster 🚀</span>
        </h1>
         <p className="text-base md:text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
         Upload any PDF, video, lecture or website — Humanize AI Essays, get instant notes, quizzes, flashcards and an AI tutor you can chat with.
        </p>

              <div className="mb-12 flex flex-col md:flex-row items-center justify-center gap-4">
                <Button size="lg" className="bg-blue-600/80 hover:bg-blue-700/80 text-white text-lg px-12 py-4 h-auto backdrop-blur-sm border border-blue-500/50 rounded-2xl shadow-lg transition-all duration-300 hover:scale-105" asChild>
                  <Link href="/signup">Start Free</Link>
                </Button>
                <Button size="lg" className="bg-transparent text-white text-lg px-12 py-4 h-auto border border-white/30 rounded-2xl shadow-lg transition-all duration-300 hover:scale-105 hover:bg-white/10" asChild>
                  <Link href="#features">See Features</Link>
                </Button>
              </div>
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
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trusted By Section */}
  <section className="py-8 relative">
          <div className="container mx-auto px-4 text-center mb-12">
            <h2 className="text-lg md:text-xl font-medium text-white mb-4">
              BlumeNote AI is trusted by students , professionals & researchers
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

            {/* Dashboard Creation & Capture Spotlight */}
            <div className="max-w-7xl mx-auto mb-32 px-2">
              <div className="space-y-14">
                <div className="space-y-7 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-medium tracking-wide uppercase">Unified Workspace</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-pink-600/20 border border-pink-500/30 text-pink-300 text-[11px] font-medium tracking-wide uppercase">Capture & Create</span>
                  </div>
                  <h3 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight max-w-5xl mx-auto">
                    Your Command Center: <span className="text-cyan-400">Create</span>, <span className="text-pink-400">Capture</span> & Organize
                  </h3>
                  <p className="text-gray-300 text-lg leading-relaxed max-w-4xl mx-auto">
                    Start from a blank page or ingest anything you encounter—documents, slides, audio, video, links, or live moments. Our feature‑rich dashboard unifies note‑taking, real‑time recording, upload processing, and structured organization inside personalized spaces.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 max-w-6xl mx-auto">
                    {/* Rich Editor / Blank Doc */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-cyan-600/25 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                        <FilePlus className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Rich Note & Doc Editor</p>
                        <p className="text-sm text-gray-400 leading-snug">Start blank with AI outlines, formatting, and markdown enhancements.</p>
                      </div>
                    </div>
                    {/* Real-Time Audio Recording */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-pink-600/25 border border-pink-500/30 flex items-center justify-center text-pink-300">
                        <Mic className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Live Audio Recording</p>
                        <p className="text-sm text-gray-400 leading-snug">Capture lectures & meetings—auto transcribed, time‑stamped & searchable.</p>
                      </div>
                    </div>
                    {/* Multi-Format Uploads */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-600/25 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                        <FileUp className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Multi‑Format Ingestion</p>
                        <p className="text-sm text-gray-400 leading-snug">PDF, PPTX, DOCX, audio, images—normalized into one processing pipeline.</p>
                      </div>
                    </div>
                    {/* Links & YouTube */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                        <Link2 className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">YouTube & Web Links</p>
                        <p className="text-sm text-gray-400 leading-snug">Extract timelines, key sections & semantic summaries from any URL.</p>
                      </div>
                    </div>
                    {/* Camera Capture */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-fuchsia-600/25 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300">
                        <Camera className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Camera & Snapshot Notes</p>
                        <p className="text-sm text-gray-400 leading-snug">Convert whiteboards & handwriting via OCR + clarity enhancement.</p>
                      </div>
                    </div>
                    {/* Personalized Spaces */}
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-rose-600/25 border border-rose-500/30 flex items-center justify-center text-rose-300">
                        <LayoutDashboard className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-white">Personalized Spaces</p>
                        <p className="text-sm text-gray-400 leading-snug">Organize themes, share selectively, and power downstream testing.</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-6">
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Zero‑friction creation</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Live transcription</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">One pipeline for everything</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Capture → structure</span>
                  </div>
                </div>
                <div className="relative group max-w-6xl mx-auto">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/35 via-pink-500/30 to-rose-500/25 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                  <div className="relative rounded-3xl overflow-hidden border border-gray-800/70 bg-gray-900/70 backdrop-blur-sm shadow-[0_0_45px_-8px_rgba(34,211,238,0.45)] p-4">
                    <div className="relative w-full">
                      <Image
                        src="/ss/dashboard.jpg"
                        alt="Feature-rich dashboard with creation & capture tools"
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

            {/* Chat & Reasoning Spotlight */}
            <div className="max-w-7xl mx-auto mb-32 px-2">
              <div className="space-y-14">
                <div className="space-y-7 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-medium tracking-wide uppercase">Conversational AI</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300 text-[11px] font-medium tracking-wide uppercase">Learn Pro Reasoning</span>
                  </div>
                  <h3 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight max-w-5xl mx-auto">
                    Chat, Reason, & Search — <span className="text-blue-400">All Context‑Aware</span>
                  </h3>
                  <p className="text-gray-300 text-lg leading-relaxed max-w-4xl mx-auto">
                    An AI chat built for deep study. Attach your uploaded documents for grounded answers, toggle advanced reasoning (Learn Pro) for multi‑step synthesis, and pull in the latest facts via real‑time web search—without losing citation traceability.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 max-w-6xl mx-auto">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-500/25 border border-blue-400/30 flex items-center justify-center text-blue-200"><MessageSquare className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Contextual Chat Core</p><p className="text-sm text-gray-400 leading-snug">Understands your docs + prior turns for coherent dialogue.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-violet-500/25 border border-violet-400/30 flex items-center justify-center text-violet-200"><Brain className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Learn Pro Reasoning</p><p className="text-sm text-gray-400 leading-snug">Chain‑of‑thought style decomposition for harder queries.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/25 border border-emerald-400/30 flex items-center justify-center text-emerald-200"><FileUp className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Attach Up To 4 Docs</p><p className="text-sm text-gray-400 leading-snug">Drop in recent materials to guide each answer.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-cyan-500/25 border border-cyan-400/30 flex items-center justify-center text-cyan-200"><Globe className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Real‑Time Web Search</p><p className="text-sm text-gray-400 leading-snug">Blend fresh external knowledge with local context.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-amber-500/25 border border-amber-400/30 flex items-center justify-center text-amber-200"><RefreshCcw className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Adaptive Follow‑Ups</p><p className="text-sm text-gray-400 leading-snug">Refine, drill deeper, or pivot topics instantly.</p></div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-rose-500/25 border border-rose-400/30 flex items-center justify-center text-rose-200"><BarChart3 className="h-5 w-5" /></div>
                      <div className="space-y-1"><p className="font-medium text-white">Citation & Traceability</p><p className="text-sm text-gray-400 leading-snug">Source anchors ensure verifiable responses.</p></div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-6">
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Grounded answers</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Reasoning mode</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Live knowledge</span>
                    <span className="px-3 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300">Doc fusion</span>
                  </div>
                </div>
                <div className="relative group max-w-6xl mx-auto">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-blue-400/35 via-violet-500/30 to-rose-500/25 rounded-3xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                  <div className="relative rounded-3xl overflow-hidden border border-gray-800/70 bg-gray-900/70 backdrop-blur-sm shadow-[0_0_45px_-8px_rgba(96,165,250,0.45)] p-4">
                    <div className="relative w-full">
                      <Image
                        src="/ss/chat.jpg"
                        alt="AI chat interface with document context and reasoning toggles"
                        width={2200}
                        height={1700}
                        className="w-full h-auto object-contain mx-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Remaining Feature Grid removed as requested */}
          </div>
        </section>

        {/* How It Works Section */}
        <HowItWorks />

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
