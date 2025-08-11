import { ArrowRight, Upload, Sparkles, BookOpen } from "lucide-react"
import Image from "next/image"

export default function HowItWorks() {
  return (
    <section className="py-20 bg-gray-900/30 backdrop-blur-sm" id="how-it-works">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Transform any content into an interactive learning experience in just three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="bg-blue-900/50 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-blue-800/50">
              <Upload className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">1. Upload Content</h3>
            <p className="text-gray-300">
              Upload or link any content type - PDFs, videos, audio, or text.
            </p>
          </div>

          <div className="text-center relative">
            <div className="hidden md:block absolute top-8 left-0 w-full">
              <ArrowRight className="h-6 w-6 text-blue-400 mx-auto" />
            </div>
            <div className="bg-blue-900/50 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-blue-800/50">
              <Sparkles className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">2. AI Processing</h3>
            <p className="text-gray-300">
              Our AI analyzes and transforms your content into learning materials.
            </p>
          </div>

          <div className="text-center relative">
            <div className="hidden md:block absolute top-8 left-0 w-full">
              <ArrowRight className="h-6 w-6 text-blue-400 mx-auto" />
            </div>
            <div className="bg-blue-900/50 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-blue-800/50">
              <BookOpen className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">3. Learn & Interact</h3>
            <p className="text-gray-300">
              Access summaries, quizzes, flashcards, and chat with your content.
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="relative max-w-3xl mx-auto">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-pink-600 rounded-lg blur opacity-25"></div>
            <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-xl overflow-hidden border border-gray-800/50">
              <Image
                src="/placeholder.svg"
                alt="Platform workflow demonstration"
                width={800}
                height={400}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
