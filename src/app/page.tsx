import { ArrowRight, BookOpen, FileText, MessageSquare, Upload, Video, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Navbar from "./components/navbar"
import FeatureCard from "./components/feature-card"
import HowItWorks from "./components/how-it-works"
import Testimonials from "./components/testimonials"
import Pricing from "./components/pricing"
import FAQ from "./components/faq"
import Footer from "./components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />

      {/* Hero Section */}
      <section className="relative py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-950 z-0"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-12 md:mb-0">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
                Transform Content Into <span className="text-blue-600 dark:text-blue-400">Learning Experiences</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-lg">
                Upload any content. Get AI-powered summaries, quizzes, flashcards, and a smart chatbot that understands
                your material.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                >
                  See Demo
                </Button>
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-pink-600 rounded-lg blur opacity-25"></div>
                <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt="AI Learning Platform Dashboard"
                    width={300}
                    height={300}
                    className="w-3/4 h-3/4"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-950" id="features">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Powerful Learning Features
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Our platform transforms any content into interactive learning materials using advanced AI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Upload className="h-10 w-10 text-blue-600 dark:text-blue-400" />}
              title="Multi-Format Upload"
              description="Upload audio, video, PDFs, YouTube links, or meeting notes. Our platform handles it all."
            />
            <FeatureCard
              icon={<FileText className="h-10 w-10 text-blue-600 dark:text-blue-400" />}
              title="Smart Summaries"
              description="Get concise, accurate summaries of your content, highlighting key concepts and takeaways."
            />
            <FeatureCard
              icon={<BookOpen className="h-10 w-10 text-blue-600 dark:text-blue-400" />}
              title="Interactive Quizzes"
              description="AI-generated quizzes to test your knowledge and reinforce learning with adaptive difficulty."
            />
            <FeatureCard
              icon={<Zap className="h-10 w-10 text-blue-600 dark:text-blue-400" />}
              title="Flashcards"
              description="Study efficiently with automatically generated flashcards covering important concepts."
            />
            <FeatureCard
              icon={<MessageSquare className="h-10 w-10 text-blue-600 dark:text-blue-400" />}
              title="Context-Aware Chatbot"
              description="Ask questions about your content and get accurate, contextual answers from our AI assistant."
            />
            <FeatureCard
              icon={<Video className="h-10 w-10 text-blue-600 dark:text-blue-400" />}
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
      <section className="py-20 bg-blue-900 dark:bg-blue-950 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Learning Experience?</h2>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            Join thousands of students and professionals who are learning smarter, not harder.
          </p>
          <Button size="lg" className="bg-white text-blue-900 hover:bg-gray-100 dark:bg-gray-100 dark:hover:bg-white">
            Start Your Free Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
