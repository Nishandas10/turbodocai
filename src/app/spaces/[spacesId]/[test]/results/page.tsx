"use client"
import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useRouter, useParams } from 'next/navigation'
import { RotateCcw, ArrowLeft, Share2, ChevronLeft, ChevronRight } from 'lucide-react'
import DashboardSidebar from '@/components/DashboardSidebar'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { listenToSpaceDocuments } from '@/lib/firestore'

interface StoredSession {
  sessionId: string
  spaceId?: string
  docs: string[]
  type: string
  difficulty: string
  count: number
  durationMin: number
  startTime: number
  endTime: number
  items: Array<{
    kind: 'mcq' | 'long'
    docId: string
    category?: string
    picked?: number | null
    correct?: boolean
    skipped?: boolean
    verdict?: string
  }>
  skipped: number
  score: number
}

export default function TestResultsPage() {
  const sp = useSearchParams()
  const router = useRouter()
  const routeParams = useParams<{ spacesId: string }>()
  const spacesId = routeParams?.spacesId || ''
  const { user } = useAuth()
  const sessionId = sp.get('session') || ''
  const [data, setData] = useState<StoredSession | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const [index, setIndex] = useState<number>(0) // position in sessions array

  // Load all sessions for this space and determine current index
  useEffect(() => {
    if (!spacesId) return
    try {
      const collected: StoredSession[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith('testSession:')) continue
        try {
          const raw = localStorage.getItem(k)
          if (!raw) continue
          const parsed = JSON.parse(raw) as StoredSession
          if (parsed.spaceId === spacesId) collected.push(parsed)
        } catch {}
      }
      collected.sort((a,b) => (a.endTime || 0) - (b.endTime || 0)) // oldest -> newest
      setSessions(collected)
      if (collected.length === 0) {
        setNotFound(true)
        return
      }
      const curIdx = collected.findIndex(s => s.sessionId === sessionId)
      if (curIdx >= 0) {
        setIndex(curIdx)
        setData(collected[curIdx])
        setNotFound(false)
      } else if (sessionId && collected.length) {
        // If specific sessionId not found, mark notFound
        setNotFound(true)
      } else if (!sessionId && collected.length) {
        // default to last (newest)
        setIndex(collected.length - 1)
        setData(collected[collected.length - 1])
      }
    } catch { /* ignore */ }
  }, [sessionId, spacesId])

  // When index changes, update route (session param) & data
  useEffect(() => {
    if (!sessions.length) return
    const s = sessions[index]
    if (!s) return
    setData(s)
    const params = new URLSearchParams(window.location.search)
    params.set('session', s.sessionId)
    const newUrl = `${window.location.pathname}?${params.toString()}`
    // Avoid pushing duplicates
    if (window.location.search !== `?${params.toString()}`) {
      router.replace(newUrl)
    }
  }, [index, sessions, router])

  const durationTaken = useMemo(() => {
    if (!data) return '--'
    const ms = data.endTime - data.startTime
    if (ms <= 0) return '--'
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${m}m ${s}s`
  }, [data])

  const percent = useMemo(() => {
    if (!data) return 0
    const valid = data.items?.filter(Boolean) || []
    return Math.round((data.score / Math.max(1, valid.length)) * 100)
  }, [data])

  // (Legacy perDoc breakdown removed; superseded by hierarchical structure below)

  // Map docId -> title (live listener)
  const [docTitles, setDocTitles] = useState<Record<string,string>>({})
  useEffect(()=>{
    if(!user?.uid || !spacesId) return
    const unsub = listenToSpaceDocuments(user.uid, spacesId, docs => {
      const map: Record<string,string> = {}
      docs.forEach(d=>{ map[d.id] = d.title || 'Untitled' })
      setDocTitles(map)
    })
    return () => { try { unsub() } catch {} }
  },[user?.uid, spacesId])

  // Hierarchical breakdown: doc -> individual question rows
  interface DocRow { docId: string; total: number; correct: number; skipped: number; questions: Array<{ id: number; text: string; correct: boolean; skipped: boolean; kind: 'mcq'|'long' }> }
  const hierarchical = useMemo(()=>{
    if(!data) return [] as DocRow[]
    const map = new Map<string, DocRow>()
    let qCounter = 0
    for(const item of data.items||[]) {
      if(!item?.docId) continue
      let row = map.get(item.docId)
      if(!row){ row = { docId: item.docId, total:0, correct:0, skipped:0, questions:[] }; map.set(item.docId,row) }
      row.total += 1
      if(item.correct) row.correct += 1
      if(item.skipped) row.skipped += 1
      let text = ''
      if(item.kind==='mcq') {
        const mcq = item as unknown as { question?: string; category?: string }
        text = mcq.question || mcq.category || 'Question'
      } else {
        const lg = item as unknown as { front?: string }
        text = lg.front || 'Question'
      }
      row.questions.push({ id: qCounter++, text, correct: !!item.correct, skipped: !!item.skipped, kind: item.kind })
    }
    return Array.from(map.values()).sort((a,b)=>a.docId.localeCompare(b.docId))
  },[data])

  if (notFound) {
    return (
      <ProtectedRoute>
        <div className='p-8 text-center'>Session not found.</div>
      </ProtectedRoute>
    )
  }

  if (!data) {
    return (
      <ProtectedRoute>
        <div className='p-8 text-center text-muted-foreground'>Loading results…</div>
      </ProtectedRoute>
    )
  }

  const retake = () => {
    // Replay exact same questions
    const params = new URLSearchParams()
    params.set('docs', data.docs.join(','))
    params.set('count', String(data.count))
    params.set('difficulty', data.difficulty)
    params.set('type', data.type)
    params.set('duration', String(data.durationMin))
    params.set('sessionReplay', data.sessionId)
    router.push(`/spaces/${spacesId}/test?${params.toString()}`)
  }

  const newQuestions = () => {
    // Fresh generation (omit sessionReplay param)
    const params = new URLSearchParams()
    params.set('docs', data.docs.join(','))
    params.set('count', String(data.count))
    params.set('difficulty', data.difficulty)
    params.set('type', data.type)
    params.set('duration', String(data.durationMin))
    router.push(`/spaces/${spacesId}/test?${params.toString()}`)
  }

  return (
    <ProtectedRoute>
      <div className='h-screen bg-background flex overflow-hidden'>
        <DashboardSidebar onAddContentClick={() => { window.location.href = '/dashboard' }} />
        <div className='flex-1 flex flex-col min-w-0'>
        <div className='p-4 flex items-center justify-between border-b border-border'>
          <div className='flex items-center gap-4'>
            <button onClick={() => history.back()} className='p-2 rounded hover:bg-muted'><ArrowLeft className='h-5 w-5'/></button>
            <h1 className='text-lg font-semibold'>Test Results</h1>
          </div>
          <button className='px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1 hover:bg-muted'>
            <Share2 className='h-4 w-4'/> Share
          </button>
        </div>

        {/* Session switcher */}
        <div className='border-border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40'>
          <div className='max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-6'>
            <button
              aria-label='Previous test'
              disabled={index <= 0}
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              className={`p-1 rounded transition-colors ${index <= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted'}`}
            >
              <ChevronLeft className='h-5 w-5' />
            </button>
            <div className='text-sm font-medium'>Test {sessions.length ? index + 1 : '-'} of {sessions.length || '-'}</div>
            <button
              aria-label='Next test'
              disabled={index >= sessions.length - 1}
              onClick={() => setIndex(i => Math.min(sessions.length - 1, i + 1))}
              className={`p-1 rounded transition-colors ${index >= sessions.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-muted'}`}
            >
              <ChevronRight className='h-5 w-5' />
            </button>
          </div>
        </div>

  <div className='p-8 flex flex-col items-center text-center gap-6 overflow-y-auto'>
          <h2 className='text-xl font-medium'>Learning takes time, keep going!</h2>
          <div className='flex gap-12'>
            <div>
              <div className='text-2xl font-semibold'>{data.skipped}</div>
              <div className='text-xs text-muted-foreground mt-1'>Skipped</div>
            </div>
            <div className='flex flex-col items-center'>
              <div className='relative w-36 h-36'>
                <svg viewBox='0 0 100 100' className='w-36 h-36'>
                  <circle cx='50' cy='50' r='45' className='stroke-gray-200 fill-none' strokeWidth='10'/>
                  <circle cx='50' cy='50' r='45' className='stroke-blue-600 fill-none' strokeWidth='10' strokeDasharray={`${percent * 2.83} 999`} strokeLinecap='round' transform='rotate(-90 50 50)'/>
                </svg>
                <div className='absolute inset-0 flex flex-col items-center justify-center'>
                  <div className='text-xl font-semibold'>{percent}%</div>
                  <div className='text-xs text-muted-foreground'>Score</div>
                </div>
              </div>
            </div>
            <div>
              <div className='text-2xl font-semibold'>{durationTaken}</div>
              <div className='text-xs text-muted-foreground mt-1'>Time Taken</div>
            </div>
          </div>
        </div>

  <div className='max-w-5xl w-full mx-auto px-6 pb-32'>
          <div className='bg-card border border-border rounded-xl p-0 overflow-hidden'>
            <div className='p-6 pb-4'>
              <h3 className='font-semibold mb-2'>Questions Breakdown</h3>
              <p className='text-xs text-muted-foreground'>Per document with each question. “Review” retakes only that document.</p>
            </div>
            <div>
              {hierarchical.map(doc => {
                const docPct = Math.round((doc.correct / Math.max(1, doc.total)) * 100)
                return (
                  <div key={doc.docId} className='px-6 pt-4 last:pb-6 border-t first:border-t-0 border-border/70'>
                    <div className='flex items-center justify-between mb-3'>
                      <div className='font-semibold truncate'>{docTitles[doc.docId] || doc.docId}</div>
                      <div className='flex items-center gap-3'>
                        <div className='text-xs text-muted-foreground'>{doc.correct}/{doc.total} correct</div>
                        <div className='w-40 h-2 bg-muted rounded-full overflow-hidden'>
                          <div className='h-full bg-blue-600 transition-all' style={{ width: `${docPct}%` }} />
                        </div>
                        <div className='text-xs text-muted-foreground'>{docPct}%</div>
                      </div>
                    </div>
                    <div className='space-y-2 mb-5'>
                      {doc.questions.map(q => (
                        <div key={q.id} className='flex items-center gap-4'>
                          <div className='flex-1 text-sm truncate'>{q.text}</div>
                          <div className='text-[10px] text-muted-foreground w-16 text-right'>{q.correct ? '✔' : q.skipped ? 'Skipped' : '✖'}</div>
                          <button
                            onClick={() => {
                              const params = new URLSearchParams()
                              params.set('docs', doc.docId)
                              params.set('count', String(doc.total))
                              params.set('difficulty', data.difficulty)
                              params.set('type', data.type)
                              params.set('duration', String(data.durationMin || 0))
                              router.push(`/spaces/${data.spaceId || spacesId}/test?${params.toString()}`)
                            }}
                            className='px-3 py-1 rounded-full text-[11px] bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                          >Review ›</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {hierarchical.length === 0 && (
                <div className='px-6 pb-6 text-sm text-muted-foreground'>No questions recorded.</div>
              )}
            </div>
          </div>

          <div className='flex justify-center gap-4 mt-10'>
            <button onClick={retake} className='px-6 py-2 rounded-lg border flex items-center gap-2 text-sm'>
              <RotateCcw className='h-4 w-4'/> Try Again
            </button>
            <button onClick={newQuestions} className='px-6 py-2 rounded-lg bg-blue-600 text-white text-sm'>New-Question Retake</button>
          </div>
        </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}