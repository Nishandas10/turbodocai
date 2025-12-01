"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X} from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 py-4">
      <div className="container mx-auto px-4 flex justify-center">
        <div className="bg-gray-900/55 backdrop-blur-xl border border-gray-700/60 rounded-full px-8 py-2.5 flex items-center justify-between max-w-4xl w-full shadow-lg">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-2">
            <span className="text-white font-medium text-sm">BlumeNote AI</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-gray-300 hover:text-blue-400 transition-colors text-sm"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-gray-300 hover:text-blue-400 transition-colors text-sm"
            >
              How It Works
            </Link>
            <Link
              href="#pricing"
              className="text-gray-300 hover:text-blue-400 transition-colors text-sm"
            >
              Pricing
            </Link>
            <Link
              href="#faq"
              className="text-gray-300 hover:text-blue-400 transition-colors text-sm"
            >
              FAQ
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <Button 
              className="bg-transparent border border-gray-400 text-white hover:bg-white/10 text-sm px-4 py-1.5 rounded-full"
              asChild
            >
              <Link href="/signup">Start free</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-300 hover:text-blue-400 focus:outline-none"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-gray-950/95 backdrop-blur-xl border-b border-gray-800/70 shadow-xl">
          <div className="container mx-auto px-4 py-4 space-y-4">
            <Link
              href="#features"
              className="block text-gray-300 hover:text-blue-400 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="block text-gray-300 hover:text-blue-400 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Pricing
            </Link>
            <Link
              href="#faq"
              className="block text-gray-300 hover:text-blue-400 transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              FAQ
            </Link>
            <div className="pt-4 flex flex-col space-y-2">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                asChild
              >
                <Link href="/signup">Start free</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
