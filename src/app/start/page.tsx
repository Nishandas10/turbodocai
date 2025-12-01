"use client"
import { useState } from 'react'
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FileText, Mic, Play, Globe, Camera, ArrowRight, AtSign, Brain, ChevronDown, ArrowUp, Plus, Search, Clock, GitBranch, Menu, X } from "lucide-react"


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
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Brain className="h-4 w-4" /><span className="text-sm">Chat</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><FileText className="h-4 w-4" /><span className="text-sm">Flashcard</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><GitBranch className="h-4 w-4" /><span className="text-sm">Quiz</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Mic className="h-4 w-4" /><span className="text-sm">Podcast</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Search className="h-4 w-4" /><span className="text-sm">Search</span></button>
					<button onClick={onAction} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Clock className="h-4 w-4" /><span className="text-sm">History</span></button>
				</nav>
						<div className="px-2 py-2">
							<div className="text-xs uppercase tracking-wide text-sidebar-accent-foreground mb-2 select-none">Tests</div>
							<div className="space-y-1">
								<button onClick={onAction} className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Plus className="h-4 w-4" /><span className="text-sm">Create Test</span></button>
							</div>
						</div>
				<div className="px-4 pt-3 space-y-3">
					<div className="text-center text-xs text-sidebar-accent-foreground border rounded-md py-1.5">Free Preview</div>
					<p className="text-[14px] leading-relaxed text-sidebar-accent-foreground/90">
One App to Summarize, Learn, Revise & Practice Anything. Study 10x faster. <br/><br/>Upload any PDF, video, lecture or website — get instant notes, quizzes, flashcards and an AI tutor you can chat with.</p>
				</div>
			</div>
			<div className="px-4 py-4 border-t border-sidebar-border">
				<Link href="/signup" className="block w-full text-center bg-white text-black font-medium rounded-md py-2 hover:bg-gray-200 transition">Sign up</Link>
			</div>
		</aside>
	)
}

// Mobile drawer variant (visible on small screens when opened)
function MobileSidebar({ onAction, onClose }: { onAction: () => void; onClose: () => void }) {
	return (
		<div className="fixed inset-0 z-50 md:hidden">
			<div className="absolute inset-0 bg-black/40" onClick={onClose} />
			<aside className="relative w-64 h-full bg-sidebar border-r border-sidebar-border shadow-xl">
				<div className="px-5 pt-4 pb-3 flex items-center justify-between">
					<div className="text-sidebar-foreground font-semibold text-xl leading-none">BlumeNote AI</div>
					<button onClick={onClose} aria-label="Close sidebar" className="p-2 rounded-md hover:bg-sidebar-accent/50">
						<X className="h-5 w-5 text-sidebar-foreground" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto px-2 pb-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
					<nav className="space-y-1 mb-4">
						<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Plus className="h-4 w-4" /><span className="text-sm">Add content</span></button>
						<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><GitBranch className="h-4 w-4" /><span className="text-sm">Mind Maps</span></button>
						<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Brain className="h-4 w-4" /><span className="text-sm">Chat</span></button>
						<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><FileText className="h-4 w-4" /><span className="text-sm">Flashcard</span></button>
						<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><GitBranch className="h-4 w-4" /><span className="text-sm">Quiz</span></button>
						<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Mic className="h-4 w-4" /><span className="text-sm">Podcast</span></button>
						<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Search className="h-4 w-4" /><span className="text-sm">Search</span></button>
						<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Clock className="h-4 w-4" /><span className="text-sm">History</span></button>
					</nav>
					<div className="px-2 py-2">
						<div className="text-xs uppercase tracking-wide text-sidebar-accent-foreground mb-2 select-none">Tests</div>
						<div className="space-y-1">
							<button onClick={() => { onAction(); onClose(); }} className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"><Plus className="h-4 w-4" /><span className="text-sm">Create Test</span></button>
						</div>
					</div>
					<div className="px-4 pt-3 space-y-3">
						<div className="text-center text-xs text-sidebar-accent-foreground border rounded-md py-1.5">Free Preview</div>
						<p className="text-[14px] leading-relaxed text-sidebar-accent-foreground/90">One App to Summarize, Learn, Revise & Practice Anything. Study 10x faster. <br/><br/>Upload any PDF, video, lecture or website — get instant notes, quizzes, flashcards and an AI tutor you can chat with.</p>
					</div>
				</div>
				<div className="px-4 py-4 border-t border-sidebar-border">
					<Link href="/signup" className="block w-full text-center bg-white text-black font-medium rounded-md py-2 hover:bg-gray-200 transition">Sign up</Link>
				</div>
			</aside>
		</div>
	)
}

export default function StartPage() {
	const router = useRouter()
	const [mobileOpen, setMobileOpen] = useState(false)

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

		// Explore section removed

	return (
			<div className="h-screen bg-background flex overflow-hidden">
				{/* Mobile hamburger (small screens) */}
				<button aria-label="Open menu" onClick={() => setMobileOpen(true)} className="fixed top-4 left-4 z-50 md:hidden bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow">
					<Menu className="h-5 w-5" />
				</button>
				{mobileOpen && <MobileSidebar onAction={goSignup} onClose={() => setMobileOpen(false)} />}
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
										placeholder="Ask me anything..."
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

				{/* Explore teaser removed */}

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

