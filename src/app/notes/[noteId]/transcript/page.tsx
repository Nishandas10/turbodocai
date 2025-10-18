"use client"

import { useEffect, useMemo, useState } from 'react'
import { FileText, Copy, Download, Search, Loader2 } from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getDocumentText } from '@/lib/ragService'

export default function TranscriptPage() {
  const params = useParams()
  const { user } = useAuth()
  const noteId = params?.noteId as string
  const search = useSearchParams()
  const ownerFromUrl = search?.get('owner') || undefined
  const [effOwner, setEffOwner] = useState<string | undefined>(ownerFromUrl)

  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  // Resolve and persist effective owner for shared links
  useEffect(() => {
    try {
      if (noteId && ownerFromUrl) {
        localStorage.setItem(`doc_owner_${noteId}`, ownerFromUrl)
        setEffOwner(ownerFromUrl)
      } else if (noteId && !ownerFromUrl) {
        const stored = localStorage.getItem(`doc_owner_${noteId}`) || undefined
        if (stored) setEffOwner(stored)
        else setEffOwner(user?.uid)
      }
    } catch {
      setEffOwner(ownerFromUrl || user?.uid)
    }
  }, [noteId, ownerFromUrl, user?.uid])

  useEffect(() => {
    const targetUser = effOwner || user?.uid
    if (!noteId || !targetUser) return
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await getDocumentText({ documentId: noteId, userId: targetUser })
        setRawText(res.text || '')
      } catch (e) {
        console.error('Transcript load failed', e)
        // For shared docs, if we cannot read raw text due to permissions, keep UI graceful
        setError('Failed to load transcript text')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [noteId, effOwner, user?.uid])

  const filtered = useMemo(() => {
    if (!searchTerm) return rawText
    // Simple highlight via splitting; we'll render with <mark>
    return rawText
  }, [rawText, searchTerm])

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText)
  }

  const handleDownload = () => {
    const blob = new Blob([rawText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <FileText className="h-6 w-6 text-indigo-600" />
          <h1 className="text-xl font-semibold text-foreground">Transcript</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Raw text reconstructed from your uploaded document. PDFs load from Pinecone vectors; DOCX loads from stored transcript or Firestore fallback.
        </p>
      </div>

      {/* Controls */}
      <div className="border-b border-border p-4 space-y-4">
        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Copy className="h-4 w-4" />
            <span>Copy All</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading transcript...
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : rawText ? (
            <article className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              {/* Render with search highlight */}
              {searchTerm ? (
                <HighlightedText text={filtered} query={searchTerm} />
              ) : (
                <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">{rawText}</pre>
              )}
            </article>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No transcript text available.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">{text}</pre>
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  return (
    <pre className="whitespace-pre-wrap text-gray-800 leading-relaxed">
      {parts.map((part, i) => (
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded-sm">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      ))}
    </pre>
  )
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}