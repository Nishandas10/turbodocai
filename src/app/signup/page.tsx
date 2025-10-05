"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"
import { useEmailSignIn } from "@/hooks/useEmailSignIn"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const { user, loading, signInWithGoogle, signInWithEmail } = useAuth()
  const { isReturningWithLink } = useEmailSignIn()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // If user is authenticated, redirect to dashboard
  if (user) {
    return null
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setMessage("")
      await signInWithGoogle()
    } catch (error) {
      console.error("Google sign-in error:", error)
      setMessage("Failed to sign in with Google. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setMessage("Please enter a valid email address.")
      return
    }

    try {
      setIsLoading(true)
      setMessage("")
      await signInWithEmail(email.trim())
    } catch (error) {
      console.error("Email sign-in error:", error)
      setMessage("Failed to send sign-in link. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
      
      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">BlumeNote AI</h1>
        </div>

        {/* Main Card */}
        <div className="w-full max-w-md">
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-gray-800/50 relative">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl blur opacity-30"></div>
            <div className="relative">
              {/* Title */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {isReturningWithLink ? "Completing Sign In" : "Welcome back"}
                </h2>
                <p className="text-gray-400">
                  {isReturningWithLink ? "Processing your sign-in link..." : "Sign in to your account"}
                </p>
              </div>

              {/* Message Display */}
              {message && (
                <div className="mb-6 p-3 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm">
                  {message}
                </div>
              )}

              {/* Show processing message when returning with link */}
              {isReturningWithLink && (
                <div className="mb-6 p-4 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-center">
                  <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p>Processing your sign-in link...</p>
                </div>
              )}

              {/* Google Sign In Button */}
              <div className="mb-6">
                <Button 
                  variant="outline" 
                  className="w-full h-11 justify-start gap-3 bg-white hover:bg-gray-50 text-gray-900 border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isReturningWithLink}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {isLoading ? "Signing in..." : "Continue with Google"}
                </Button>
              </div>

              {/* Separator */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-gray-900/80 px-2 text-gray-500">or</span>
                </div>
              </div>

              {/* Email Input Section */}
              <form onSubmit={handleEmailSignIn} className="space-y-4 mb-6">
                <label htmlFor="email" className="text-sm font-medium text-white">
                  Email
                </label>
                
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isReturningWithLink}
                  required
                />

                {/* Sign In Button */}
                <Button 
                  type="submit"
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading || isReturningWithLink}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sending link...
                    </>
                  ) : (
                    "Continue with Email"
                  )}
                </Button>
              </form>

              {/* Legal Text */}
              <div className="mt-6 text-xs text-gray-500 text-center leading-relaxed">
                By continuing, you agree to our{" "}
                <Link href="#" className="text-blue-400 hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="text-blue-400 hover:underline">
                  Privacy Policy
                </Link>
                , and to receive periodic emails with updates.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 