"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useAuth } from "@/contexts/AuthContext"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const { user, loading, signInWithEmail, signInWithGoogle } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (user) return null

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")
    if (!email.trim() || !password) {
      setMessage("Please enter both email and password.")
      return
    }

    try {
      setIsLoading(true)
      await signInWithEmail(email.trim(), password)
    } catch (error) {
      console.error("Login error:", error)
      const errMsg = error instanceof Error ? error.message : "Failed to sign in. Please try again."
      setMessage(errMsg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogle = async () => {
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

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950"></div>
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-white cursor-pointer">BlumeNote AI</h1>
          </Link>
        </div>

        <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-8 shadow-2xl border border-gray-800/50 relative">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-gray-400">Sign in to your account</p>
          </div>

          {message && (
            <div className="mb-4 p-3 rounded bg-red-700/20 border border-red-700/30 text-red-200 text-sm">{message}</div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 mb-6">
            <label htmlFor="email" className="text-sm font-medium text-white">Email</label>
            <Input id="email" type="email" placeholder="name@example.com" className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} required />

            <label htmlFor="password" className="text-sm font-medium text-white">Password</label>
            <Input id="password" type="password" placeholder="Your password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} required />

            <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium" disabled={isLoading}>
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : null}
              Sign in
            </Button>
          </form>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-700" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-gray-900/80 px-2 text-gray-500">or</span></div>
          </div>

          <div className="mb-6">
            <Button className="w-full h-11 justify-start gap-3 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700" onClick={handleGoogle} disabled={isLoading}>
              <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </Button>
          </div>

          <div className="text-center text-sm">
            <span className="text-gray-400">Don&apos;t have an account? </span>
            <Link href="/signup" className="text-blue-400 hover:underline">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
