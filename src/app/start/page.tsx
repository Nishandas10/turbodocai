"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { FileText, Mic, Play, Globe, Camera, ArrowRight, AtSign, Brain, ChevronDown, ArrowUp, Plus, Search, Clock, GitBranch } from "lucide-react"
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getDocument as getUserDoc } from '@/lib/firestore'

// Public explore doc minimal type (mirrors subset of dashboard/explore logic)
type PublicDocument = {
	id: string
	ownerId?: string
	title: string
	type: string
	preview?: string
	masterUrl?: string
	summary?: string
	content?: { processed?: string; raw?: string }
	metadata?: { mimeType?: string; downloadURL?: string }
	createdAt?: unknown
	updatedAt?: unknown
}

// Fetch a small set of public docs similar to explore page
async function fetchPublicDocs(): Promise<PublicDocument[]> {
  try {
    const col = collection(db, 'allDocuments')
    const qy = query(col, where('isPublic','==',true), orderBy('createdAt','desc'), limit(12))
    const snap = await getDocs(qy)
	return snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as PublicDocument[]
  } catch {
    return []
  }
}

// Prefilled sidebar replicating structure (without recents) - all actions redirect to signup
function StartSidebar({ onAction }: { onAction: () => void }) {
	return (
		<aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
			<div className="px-5 pt-5 pb-3 flex items-center justify-between">
				<div className="text-sidebar-foreground font-semibold text-xl leading-none">BlumeNote AI</div>
			</div>
			<div className="flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
				<nav className="space-y-1 mb-4">
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Plus className="h-4 w-4" /><span className="text-sm">Add content</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><GitBranch className="h-4 w-4" /><span className="text-sm">Mind Maps</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Globe className="h-4 w-4" /><span className="text-sm">Explore</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Search className="h-4 w-4" /><span className="text-sm">Search</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Clock className="h-4 w-4" /><span className="text-sm">History</span></button>
				</nav>
						<div className="px-2 py-2">
							<div className="text-xs uppercase tracking-wide text-sidebar-accent-foreground mb-2 select-none">Spaces</div>
							<div className="space-y-1">
								<button onClick={onAction} className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Plus className="h-4 w-4" /><span className="text-sm">Create Space</span></button>
							</div>
						</div>
				<div className="px-4 pt-3 space-y-3">
					<div className="text-center text-xs text-sidebar-accent-foreground border rounded-md py-1.5">Free Preview</div>
					<p className="text-[14px] leading-relaxed text-sidebar-accent-foreground/90">
						An AI tutor personalized to you.<br/><br/>
						Understand your files, YouTube video, website links or recorded lecture through key concepts, familiar learning tools like flashcards, and interactive conversations.
					</p>
				</div>
			</div>
			<div className="px-4 py-4 border-t border-sidebar-border">
				<Link href="/signup" className="block w-full text-center bg-white text-black font-medium rounded-md py-2 hover:bg-gray-200 transition">Sign up</Link>
			</div>
		</aside>
	)
}

export default function StartPage() {
	const router = useRouter()
	const [exploreDocs, setExploreDocs] = useState<PublicDocument[]>([])
	const [loadingExplore, setLoadingExplore] = useState(true)
	const [previewMap, setPreviewMap] = useState<Record<string,string>>({})

	useEffect(() => {
		fetchPublicDocs().then(d => { setExploreDocs(d); setLoadingExplore(false) })
	}, [])

	// After docs load, fetch richer previews from user documents mirroring explore logic
	useEffect(() => {
		let cancelled = false
		const loadPreviews = async () => {
			if (!exploreDocs.length) { setPreviewMap({}); return }
			try {
				const entries = await Promise.all(exploreDocs.map(async (d) => {
					const idx = d.id.indexOf('_')
					const ownerId = idx === -1 ? d.ownerId : d.id.slice(0, idx) || d.ownerId
					const documentId = idx === -1 ? d.id : d.id.slice(idx + 1)
					if (!ownerId || !documentId) return [d.id, ''] as const
					try {
						const full = await getUserDoc(documentId, ownerId as string)
						const text = (full?.summary || full?.content?.processed || full?.content?.raw || '').trim()
						return [d.id, text] as const
					} catch { return [d.id, ''] as const }
				}))
				if (!cancelled) {
					const map: Record<string,string> = {}
					for (const [id, text] of entries) map[id] = text
					setPreviewMap(map)
				}
			} catch { /* noop */ }
		}
		loadPreviews()
		return () => { cancelled = true }
	}, [exploreDocs])

	// Generic click handler for all gated widgets
	const goSignup = () => router.push('/signup')

	const widgets = [
		{ key: 'blank', title: 'Blank document', desc: 'Start from scratch', icon: <FileText className="h-5 w-5 text-blue-600" />, badgeCls: 'bg-white', boxCls: 'bg-white' },
		{ key: 'audio', title: 'Record or upload audio', desc: 'Lecture or podcast', icon: <Mic className="h-5 w-5 text-white" />, badgeCls: 'bg-blue-600', boxCls: 'bg-blue-600' },
		{ key: 'docs', title: 'Document upload', desc: 'PDF / PPTX / DOCX', icon: <span className="text-white font-bold text-sm">DOC</span>, badgeCls: 'bg-blue-600', boxCls: 'bg-blue-600' },
		{ key: 'youtube', title: 'YouTube video', desc: 'Auto chapter & summary', icon: <Play className="h-5 w-5 text-white" />, badgeCls: 'bg-red-600', boxCls: 'bg-red-600' },
		{ key: 'website', title: 'Website link', desc: 'Extract structured insights', icon: <Globe className="h-5 w-5 text-white" />, badgeCls: 'bg-green-600', boxCls: 'bg-green-600' },
		{ key: 'camera', title: 'Camera capture', desc: 'Whiteboard / notes OCR', icon: <Camera className="h-5 w-5 text-white" />, badgeCls: 'bg-purple-600', boxCls: 'bg-purple-600' },
	]

		const renderDocPreview = (doc: PublicDocument) => {
			const override = previewMap[doc.id]
			const url = doc.masterUrl || doc.metadata?.downloadURL
			const mime = doc.metadata?.mimeType || ''
			const text = (override || doc.preview || doc.summary || doc.content?.processed || doc.content?.raw || '').trim()
			if (url && mime.startsWith('image/')) {
				return <div className="absolute inset-0"><Image src={url} alt={doc.title} fill className="object-cover" sizes="(max-width:768px)100vw,33vw" /></div>
			}
			if (doc.type === 'youtube') return <span className="text-4xl">▶</span>
			if (doc.type === 'website') return <span className="text-2xl">🌐</span>
			if (doc.type === 'audio') return <span className="text-2xl">🎙️</span>
			if (text) return <div className="absolute inset-0 p-3 text-[11px] leading-4 text-foreground/80 whitespace-pre-line overflow-hidden">{text.split(/\n+/).slice(0,4).join('\n')}</div>
			return <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No preview</div>
		}

	return (
			<div className="h-screen bg-background flex overflow-hidden">
				<StartSidebar onAction={goSignup} />
				<div className="flex-1 overflow-y-auto p-8">
				<header className="mb-10">
					<h1 className="text-3xl font-bold mb-2">Get Started Free</h1>
					<p className="text-muted-foreground max-w-xl">Create, ingest, explore and personalize your study hub. Sign up to activate every workflow below.</p>
				</header>

				{/* Widgets */}
				<section className="mb-12">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{widgets.map(w => (
							<div key={w.key} onClick={goSignup} className="bg-card rounded-lg p-4 border border-border hover:border-blue-500 transition-colors cursor-pointer group shadow-sm">
								<div className="flex items-center justify-between mb-3">
									<div className={`w-10 h-10 ${w.boxCls} rounded-lg flex items-center justify-center`}>{w.icon}</div>
									<ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-400 transition-colors" />
								</div>
								<h3 className="text-card-foreground font-medium text-sm mb-1">{w.title}</h3>
								<p className="text-muted-foreground text-xs">{w.desc}</p>
							</div>
						))}
					</div>
				</section>

						{/* Prompt Bar Preview */}
						<div className="max-w-3xl mx-auto mb-12">
							<div className="bg-card border border-border rounded-2xl shadow-sm relative">
								<div className="flex items-center gap-3 px-4 pt-3">
									<input
										className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground px-2 py-2"
										placeholder="Greetings"
										onFocus={goSignup}
										readOnly
									/>
									<button type="button" onClick={goSignup} className="rounded-full p-2 bg-foreground text-background hover:opacity-90">
										<ArrowUp className="h-4 w-4" />
									</button>
								</div>
								<div className="flex items-center justify-between px-4 pb-3 mt-2">
									<div className="flex items-center gap-3 text-sm">
										<button onClick={goSignup} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
											<span className="hidden sm:inline">Learn+</span>
											<ChevronDown className="h-4 w-4" />
										</button>
										<button onClick={goSignup} className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground">
											<AtSign className="h-4 w-4" />
											<span>Add Context</span>
										</button>
										<button onClick={goSignup} className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground">
											<Brain className="h-4 w-4 text-emerald-600" />
											<span>Search</span>
										</button>
									</div>
									<div className="flex items-center gap-2">
										<button onClick={goSignup} className="text-xs text-muted-foreground hover:text-foreground">Voice</button>
									</div>
								</div>
							</div>
						</div>

						{/* Explore Teaser */}
				<section>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-semibold">Explore public knowledge</h2>
						<Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground">View all</Link>
					</div>
					{loadingExplore ? (
						<div className="text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">Loading…</div>
					) : exploreDocs.length === 0 ? (
						<div className="text-sm text-muted-foreground border border-border rounded-xl p-6 text-center">No public documents yet.</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{exploreDocs.map(d => (
								<div key={d.id} onClick={goSignup} className="group bg-card border border-border rounded-2xl overflow-hidden hover:border-blue-500 transition-colors cursor-pointer relative">
									<div className="relative h-32 bg-muted flex items-center justify-center">
										{renderDocPreview(d)}
										<span className="absolute left-3 bottom-3 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 bg-background/80 border border-border">{d.type}</span>
									</div>
									<div className="p-4">
										<p className="font-medium text-card-foreground truncate" title={d.title}>{d.title || 'Untitled'}</p>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Benefits pills */}
				<div className="flex flex-wrap gap-2 mt-10 text-xs">
					<span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Reasoning chat</span>
					<span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Adaptive tests</span>
					<span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Mind maps</span>
					<span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Spaces</span>
					<span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">Flashcards</span>
				</div>

								{/* (Spaces preview removed per request) */}

				<div className="mt-12">
					<Link href="/signup" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-6 py-3 rounded-full shadow transition">
						Create your free account
						<ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			</div>
		</div>
	)
}

