import { BookOpen, FileText, MessageSquare, Upload, Video, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import Navbar from "./components/navbar"
import FeatureCard from "./components/feature-card"
import HowItWorks from "./components/how-it-works"
import Testimonials from "./components/testimonials"
import Pricing from "./components/pricing"
import FAQ from "./components/faq"
import Footer from "./components/footer"
import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Space Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-slate-900 via-purple-900/20 to-black"></div>
      
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
              </div>
              <div className="mb-8">
                <p className="text-gray-400 text-sm mb-4">Works seamlessly with your favorite apps</p>
                <div className="flex items-center justify-center space-x-8">
                  <div className="bg-white rounded-lg p-3 w-12 h-12 flex items-center justify-center">
                    <span className="text-black font-bold text-xl">N</span>
                  </div>
                  <div className="bg-purple-600 rounded-lg p-3 w-12 h-12 flex items-center justify-center">
                    <div className="w-6 h-6 bg-white rounded-sm"></div>
                  </div>
                  <div className="bg-blue-600 rounded-lg p-3 w-12 h-12 flex items-center justify-center">
                    <div className="w-6 h-6 bg-white rounded-sm"></div>
                  </div>
                  <div className="bg-yellow-500 rounded-lg p-3 w-12 h-12 flex items-center justify-center">
                    <div className="w-6 h-6 bg-white rounded-sm"></div>
                  </div>
                  <div className="bg-green-600 rounded-lg p-3 w-12 h-12 flex items-center justify-center">
                    <div className="w-6 h-6 bg-white rounded-sm"></div>
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
              Turbonotes AI is trusted by students and professionals at
            </h2>
          </div>
          
          {/* Animated Logo Scroll */}
          <div className="relative overflow-hidden max-w-4xl mx-auto">
            <div className="flex animate-scroll-left space-x-16">
              {/* First set of logos */}
              <div className="flex items-center space-x-16 flex-shrink-0">
                <span className="text-white/70 font-semibold text-2xl">IIT</span>
                <span className="text-white/70 font-semibold text-2xl">NIT</span>
                <span className="text-white/70 font-semibold text-2xl">IIM</span>
                <span className="text-white/70 font-semibold text-2xl">NIFT</span>
                <span className="text-white/70 font-semibold text-2xl">Deloitte</span>
                <span className="text-white/70 font-semibold text-2xl">Google</span>
                <span className="text-white/70 font-semibold text-2xl">Microsoft</span>
              </div>
              
              {/* Second set for seamless loop */}
              <div className="flex items-center space-x-16 flex-shrink-0">
                <span className="text-white/70 font-semibold text-2xl">IIT</span>
                <span className="text-white/70 font-semibold text-2xl">NIT</span>
                <span className="text-white/70 font-semibold text-2xl">IIM</span>
                <span className="text-white/70 font-semibold text-2xl">NIFT</span>
                <span className="text-white/70 font-semibold text-2xl">Deloitte</span>
                <span className="text-white/70 font-semibold text-2xl">Google</span>
                <span className="text-white/70 font-semibold text-2xl">Microsoft</span>
              </div>
              
              {/* Third set for seamless loop */}
              <div className="flex items-center space-x-16 flex-shrink-0">
                <span className="text-white/70 font-semibold text-2xl">IIT</span>
                <span className="text-white/70 font-semibold text-2xl">NIT</span>
                <span className="text-white/70 font-semibold text-2xl">IIM</span>
                <span className="text-white/70 font-semibold text-2xl">NIFT</span>
                <span className="text-white/70 font-semibold text-2xl">Deloitte</span>
                <span className="text-white/70 font-semibold text-2xl">Google</span>
                <span className="text-white/70 font-semibold text-2xl">Microsoft</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-black/30 backdrop-blur-sm border-t border-gray-800/50" id="features">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Powerful Learning Features
              </h2>
              <p className="text-lg text-gray-300 max-w-2xl mx-auto">
                Our platform transforms any content into interactive learning materials using advanced AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Upload className="h-10 w-10 text-blue-400" />}
                title="Multi-Format Upload"
                description="Upload audio, video, PDFs, YouTube links, or meeting notes. Our platform handles it all."
              />
              <FeatureCard
                icon={<FileText className="h-10 w-10 text-blue-400" />}
                title="Smart Summaries"
                description="Get concise, accurate summaries of your content, highlighting key concepts and takeaways."
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
        <section className="py-20 bg-blue-900/20 backdrop-blur-sm text-white relative border-t border-gray-800/50">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/30 to-purple-900/30"></div>
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
