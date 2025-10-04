"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { createMindMap } from "@/lib/firestore"
import { useRouter } from "next/navigation"
import DashboardSidebar from "@/components/DashboardSidebar"
import ProtectedRoute from "@/components/ProtectedRoute"

type InputMode = { key: string; label: string; tooltip?: string }

const INPUT_MODES: InputMode[] = [
	{ key: "prompt", label: "Simple Prompt" },
	{ key: "doc", label: "PDF / Doc", tooltip: "Upload a document (coming soon)" },
	{ key: "long", label: "Long Text" },
	{ key: "website", label: "Website" },
	{ key: "youtube", label: "YouTube" },
	{ key: "image", label: "Image" },
]

const LANGUAGES = ["English", "Español", "Deutsch", "Français", "हिंदी", "中文"]

const EXAMPLE_PROMPTS = [
	{
		title: "Social Software Marketing Strategy",
		prompt:
			"Create a mind map for a social software marketing strategy including target audience, channels, content types, KPIs, and growth experiments.",
	},
	{
		title: "5-Day thailand travel itinerary",
		prompt:
			"Generate a mind map for a 5-day Thailand travel itinerary covering Bangkok, Ayutthaya, Chiang Mai, and an island visit.",
	},
	{
		title: "AI Startup Roadmap",
		prompt:
			"Outline a mind map for launching an AI SaaS startup: idea validation, data strategy, model development, GTM, pricing, compliance.",
	},
]

export default function MindmapsPage() {
	const [mode, setMode] = useState<string>(INPUT_MODES[0].key)
	const [language, setLanguage] = useState<string>(LANGUAGES[0])
	const [prompt, setPrompt] = useState<string>("")
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
		const { user } = useAuth()
	const router = useRouter()
			const [searchModalOpen, setSearchModalOpen] = useState(false)
			const [searchQuery, setSearchQuery] = useState("")

// Mind map listener removed; history not displayed in shared sidebar version.

	function handleExample(p: string) {
		setPrompt(p)
	}

	async function handleGenerate() {
		setError(null)
		if (!prompt.trim()) {
			setError("Please enter a prompt first.")
			return
		}
		try {
			setLoading(true)
			if (!user?.uid) throw new Error("You must be signed in")
			const title = prompt.split(" ").slice(0, 6).join(" ") || "Untitled Mind Map"
			const mindMapId = await createMindMap(user.uid, {
				title,
				prompt,
				language,
				mode,
			})
			// Navigate to the mind map detail page where real-time generation will appear
			router.push(`/mindmaps/${mindMapId}`)
		} catch (e: unknown) {
			if (e && typeof e === "object" && "message" in e) {
				setError(String((e as { message?: unknown }).message))
			} else {
				setError("Something went wrong")
			}
		} finally {
			setLoading(false)
		}
	}

	return (
		<ProtectedRoute>
		<div className="h-screen bg-background flex overflow-hidden">
			{/* Reused Dashboard Sidebar */}
			<DashboardSidebar 
				onSearchClick={() => setSearchModalOpen(true)} 
				onAddContentClick={() => router.push('/dashboard')} 
			/>

			{/* Main area */}
			<div className="flex-1 flex flex-col items-center px-4 pb-24 pt-10 md:pt-14 overflow-y-auto">
				<div className="w-full max-w-5xl mx-auto">
					<div className="text-center space-y-5 mb-8">
						<h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
							<span className="text-primary">AI Mind Map Maker</span>
							<br />
							<span className="text-foreground">Visualize Anything</span>
						</h1>
						<p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
							Generate ideas into clear, engaging mind maps in seconds. Start with a
							simple prompt or paste long content, documents, videos, or webpages – we
							structure it for you.
						</p>
					</div>

					<div className="flex flex-wrap gap-2 justify-center mb-6">
						{INPUT_MODES.map((m) => {
							const active = m.key === mode
							return (
								<button
									key={m.key}
									onClick={() => setMode(m.key)}
									className={cn(
										"rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
										active
											? "bg-gradient-to-r from-fuchsia-500 to-indigo-500 text-white border-transparent shadow"
											: "bg-background hover:bg-accent text-foreground"
									)}
									title={m.tooltip}
								>
									{m.label}
								</button>
							)
						})}
					</div>

					<div className="relative bg-background border rounded-xl shadow-sm overflow-hidden mb-10">
						<textarea
							className="w-full resize-none bg-transparent outline-none p-5 pb-14 text-sm md:text-base min-h-[220px] leading-relaxed placeholder:text-muted-foreground/60"
							placeholder="Describe what you want to generate."
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
						/>

						<div className="absolute left-0 right-0 bottom-0 flex items-center justify-between px-4 py-3 bg-gradient-to-t from-background via-background/95 to-background/40 backdrop-blur-sm border-t">
							<div className="flex items-center gap-2">
								<select
									value={language}
									onChange={(e) => setLanguage(e.target.value)}
									className="bg-secondary/70 dark:bg-secondary/30 border border-input rounded-md px-2.5 py-1 text-xs md:text-sm outline-none focus:ring-2 focus:ring-ring"
								>
									{LANGUAGES.map((l) => (
										<option key={l}>{l}</option>
									))}
								</select>
								<div className="hidden md:block text-xs text-muted-foreground">
									Mode: <span className="font-medium capitalize">{mode}</span>
								</div>
							</div>
							<Button
								onClick={handleGenerate}
								disabled={loading}
								className="relative font-semibold text-sm md:text-base h-10 md:h-11 px-6 md:px-8 border-0 focus-visible:ring-offset-0"
								style={{
									background:
										"linear-gradient(90deg,var(--tw-gradient-from,#8b5cf6),#7c3aed,#6366f1,#4f46e5,#7c3aed)",
								}}
							>
								{loading ? "Generating..." : "Start Generate"}
							</Button>
						</div>
					</div>

					{error && (
						<div className="mb-8 text-sm text-destructive bg-destructive/10 border border-destructive/30 px-4 py-2 rounded-md">
							{error}
						</div>
					)}

					<div className="space-y-4">
						<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground/80">
							Example prompts
						</h2>
						<div className="grid gap-4 md:grid-cols-3">
							{EXAMPLE_PROMPTS.map((ex) => (
								<button
									key={ex.title}
									onClick={() => handleExample(ex.prompt)}
									className="group text-left rounded-lg border bg-card/60 hover:bg-accent transition-colors p-4 flex flex-col gap-2 shadow-sm"
								>
									<div className="flex items-center gap-2">
										<span className="size-5 rounded-md bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold">
											AI
										</span>
										<span className="font-medium text-sm line-clamp-2 group-hover:text-foreground">
											{ex.title}
										</span>
									</div>
									<p className="text-xs text-muted-foreground line-clamp-3">
										{ex.prompt}
									</p>
									<span className="text-xs font-medium text-primary/80 group-hover:text-primary inline-flex items-center gap-1">
										Use prompt <span aria-hidden>→</span>
									</span>
								</button>
							))}
						</div>
						<p className="text-xs text-muted-foreground/70 pt-2">
							More input types & mind map editor coming soon. This page currently
							demonstrates the UI – connect it to your generation API to enable
							full functionality.
						</p>
					</div>
				</div>
			</div>
			{searchModalOpen && (
				<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-32" onClick={() => setSearchModalOpen(false)}>
					<div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-lg font-semibold mb-4">Search Mind Maps</h2>
						<input
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search (coming soon)"
							className="w-full mb-4 px-3 py-2 rounded-md bg-muted border border-border outline-none focus:ring-2 focus:ring-ring"
						/>
						<p className="text-xs text-muted-foreground">Search functionality will be implemented later.</p>
						<div className="mt-6 flex justify-end">
							<Button variant="outline" size="sm" onClick={() => setSearchModalOpen(false)}>Close</Button>
						</div>
					</div>
				</div>
			)}
		</div>
		</ProtectedRoute>
	)
}

