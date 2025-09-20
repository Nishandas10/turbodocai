"use client"

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowUp, Loader2, ChevronDown, AtSign, Mic, X, Globe, Brain } from "lucide-react";
import useSpeechToText from "@/hooks/useSpeechToText";
import { useAuth } from "@/contexts/AuthContext";
import { functions, db } from "@/lib/firebase";
import { collection as fsCollection, orderBy as fsOrderBy, query as fsQuery, limit as fsLimit, getDocs } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
	collection,
	onSnapshot,
	orderBy,
	query,
	Timestamp,
	addDoc,
	serverTimestamp,
	doc,
	setDoc,
} from "firebase/firestore";
import DashboardSidebar from "@/components/DashboardSidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ChatMessage = {
	id?: string;
	role: "user" | "assistant" | "system";
	content: string;
	createdAt?: Timestamp | Date;
	streaming?: boolean;
};

export default function ChatPage() {
	const params = useParams();
	const chatId = (params?.chatId as string) || "";
	const { user } = useAuth();
	const search = useSearchParams();
	// hydration guard
	const [mounted, setMounted] = useState(false);
	useEffect(()=>{ setMounted(true); }, []);

	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [sending, setSending] = useState(false);
	// Prompt options
	const [webSearchEnabled, setWebSearchEnabled] = useState(false);
	const [thinkModeEnabled, setThinkModeEnabled] = useState(false);
	// Language selection removed; default English
	const [recentDocs, setRecentDocs] = useState<Array<{ id: string; title: string }>>([]);
	const [contextOpen, setContextOpen] = useState(false);
	const contextWrapperRef = useRef<HTMLDivElement | null>(null);
	const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
	const endRef = useRef<HTMLDivElement | null>(null);

	// Listen to messages
	useEffect(() => {
		if (!chatId) return;
		const col = collection(db, "chats", chatId, "messages");
		const qy = query(col, orderBy("createdAt", "asc"));
		const unsub = onSnapshot(qy, (snap) => {
			const msgs: ChatMessage[] = snap.docs.map((d) => {
				const data = d.data() as {
					role: ChatMessage["role"];
					content: string;
					createdAt?: Timestamp;
					streaming?: boolean;
				};
				return {
					id: d.id,
					role: data.role,
					content: data.content,
					createdAt: data.createdAt,
					streaming: data.streaming,
				};
			});
			setMessages(msgs);
			setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
		});
		return () => unsub();
	}, [chatId]);

	// Load recent docs for Add Context popover
	useEffect(() => {
		(async () => {
			if (!user?.uid) { setRecentDocs([]); return; }
			try {
				const userDocsCol = fsCollection(db, "documents", user.uid, "userDocuments");
				const qy = fsQuery(userDocsCol, fsOrderBy("createdAt", "desc"), fsLimit(20));
				const snap = await getDocs(qy);
				setRecentDocs(snap.docs.map(d => {
					const data = d.data() as { title?: string } | undefined;
					return { id: d.id, title: data?.title || 'Untitled' };
				}));
			} catch (e) { console.warn('recent docs fetch failed', e); }
		})();
	}, [user?.uid]);

		// If page loaded with an initial prompt in the URL, auto-send once.
	useEffect(() => {
			const p = search?.get("prompt");
			const ws = search?.get("webSearch");
			const tm = search?.get("thinkMode");
			const docsParam = search?.get('docs');
			if (p && user?.uid) {
			// Clear the prompt from URL to avoid re-sends on hot reloads
			const url = new URL(window.location.href);
			url.searchParams.delete("prompt");
				if (ws !== null) url.searchParams.delete("webSearch");
				if (tm !== null) url.searchParams.delete("thinkMode");
				if (docsParam !== null) url.searchParams.delete('docs');
			window.history.replaceState(null, "", url.toString());
				// Prepare overrides from URL for this initial send
				const wsOn = ws === '1';
				const tmOn = tm === '1';
				const initialDocIds = docsParam ? docsParam.split(',').filter(Boolean).slice(0,4) : [];
				// Reflect in UI state
				if (wsOn) setWebSearchEnabled(true);
				if (tmOn) setThinkModeEnabled(true);
				if (initialDocIds.length) setSelectedDocIds(initialDocIds);
				// Send without waiting for response; pass overrides to avoid state race
				void send(p, { webSearch: wsOn, thinkMode: tmOn, docIds: initialDocIds });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search, user?.uid]);

	// Translation removed; overlay uses interimTranscript only
	const userEditedRef = useRef<boolean>(false);

	const { supported: speechSupported, listening, interimTranscript, start, stop, reset } = useSpeechToText({
		lang: 'en-US',
		fallbackLangs: ['en-US'],
		continuous: false,
		interimResults: true,
		onPartial: () => { /* no-op: overlay from interimTranscript */ },
		onSegment: (seg) => {
			if (!userEditedRef.current) {
				setInput(prev => prev ? prev + ' ' + seg : seg);
			}
		}
	});

	// Cleanup
	useEffect(() => { return () => {}; }, []);

	// Graceful UI state for listening pill to avoid flicker when the underlying
	// speech API briefly stops/starts (permission prompts, fallback locale retry, etc.)
	const [voiceActive, setVoiceActive] = useState(false);
	const deactivateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wantVoiceRef = useRef(false); // tracks user intent to keep capturing

	const handleStartVoice = () => {
		if (!speechSupported) return;
		if (deactivateTimerRef.current) { clearTimeout(deactivateTimerRef.current); deactivateTimerRef.current = null; }
		wantVoiceRef.current = true;
		reset();
		userEditedRef.current = false;
		setVoiceActive(true);
		start();
	};
	const handleStopVoice = () => {
		wantVoiceRef.current = false;
		stop();
		if (deactivateTimerRef.current) clearTimeout(deactivateTimerRef.current);
		// Immediately hide pill for snappy UX
		setVoiceActive(false);
		userEditedRef.current = false;
	};

	useEffect(() => {
		if (listening) {
			if (wantVoiceRef.current && !voiceActive) setVoiceActive(true);
			if (deactivateTimerRef.current) { clearTimeout(deactivateTimerRef.current); deactivateTimerRef.current = null; }
		} else {
			if (wantVoiceRef.current) {
				// Only auto-restart if user still wants voice
				setTimeout(() => { if (wantVoiceRef.current) start(); }, 120);
			} else {
				// user intentionally stopped; ensure pill hidden
				if (voiceActive) setVoiceActive(false);
			}
		}
	}, [listening, voiceActive, start]);

	useEffect(() => () => { 
		if (deactivateTimerRef.current) clearTimeout(deactivateTimerRef.current);
	}, []);


	// Show interim transcript in input while listening
	useEffect(() => {
		if (listening && interimTranscript) {
			// Don't permanently set; overlay visually by merging
			// We'll just append interim to displayed value via computed variable below
		}
	}, [interimTranscript, listening]);

	const effectiveInputValue = (voiceActive && !userEditedRef.current && interimTranscript)
		? (input ? input + ' ' + interimTranscript : interimTranscript)
		: input;

	type SendOpts = { webSearch?: boolean; thinkMode?: boolean; docIds?: string[] };
	const send = async (overrideText?: string, opts?: SendOpts) => {
		const text = (overrideText ?? input).trim();
		if (!text || !user?.uid || !chatId) return;
		setSending(true);
		try {
			// Optimistically add user message immediately for snappy UX
			await addDoc(collection(db, "chats", chatId, "messages"), {
				role: "user",
				content: text,
				createdAt: serverTimestamp(),
			});
			// Touch chat updatedAt
			await setDoc(
				doc(db, "chats", chatId),
				{ updatedAt: serverTimestamp() },
				{ merge: true }
			);

			const call = httpsCallable(functions, "sendChatMessage");
			// Fire and forget; server will stream the assistant message into Firestore
						void call({
				userId: user.uid,
				prompt: text,
				chatId,
				language: 'en',
							docIds: (opts?.docIds && opts.docIds.length ? opts.docIds : selectedDocIds),
							webSearch: opts?.webSearch ?? webSearchEnabled,
							thinkMode: opts?.thinkMode ?? thinkModeEnabled,
			});

			setInput("");
			reset();
		} catch (e) {
			console.error("sendChatMessage failed", e);
			alert("Failed to send message");
		} finally {
			setSending(false);
		}
	};

	const toggleDoc = (id: string) => {
		setSelectedDocIds(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id].slice(0,4));
	};
	const removeDoc = (id: string) => setSelectedDocIds(prev => prev.filter(d => d !== id));

	// Close popover on outside click or Escape
	useEffect(() => {
		if (!contextOpen) return;
		const onDown = (e: MouseEvent) => {
			if (contextWrapperRef.current && !contextWrapperRef.current.contains(e.target as Node)) {
				setContextOpen(false);
			}
		};
		const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextOpen(false); };
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onKey);
		};
	}, [contextOpen]);

	return (
		<div className="h-screen bg-background flex overflow-hidden">
			{/* Left Sidebar */}
			<DashboardSidebar />
			{/* Chat Content */}
			<div className="flex-1 flex flex-col relative">{/* relative so we can absolutely position prompt bar within chat column */}
				<div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl w-full mx-auto pb-40">
					{messages.length === 0 ? (
						<div className="text-center text-muted-foreground mt-20">
							Start your conversation.
						</div>
					) : (
						<div className="space-y-6">
							{messages.map((m) => (
								<div key={m.id} className="flex">
									<div
										className={
											m.role === "user"
												? "ml-auto bg-primary text-primary-foreground px-4 py-2 rounded-2xl rounded-tr-sm max-w-[80%]"
											: "mr-auto bg-muted text-foreground px-4 py-2 rounded-2xl rounded-tl-sm max-w-[80%]"
										}
									>
										<div className="whitespace-pre-wrap">
											{m.content}
											{m.streaming ? <span className="animate-pulse">█</span> : null}
										</div>
									</div>
								</div>
							))}
							<div ref={endRef} />
						</div>
					)}
				</div>
				{/* Floating Prompt Bar centered to chat column (not full viewport) */}
				<div className="pointer-events-none absolute bottom-4 left-0 right-0 px-4 z-40">
					<div className="pointer-events-auto max-w-3xl mx-auto w-full">
						<div className="bg-card rounded-2xl shadow-lg relative">
							{/* Input row */}
							<div className="flex items-center gap-3 px-4 pt-3">
												<input
									className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground px-2 py-2"
				    placeholder={'Ask something...'}
													value={effectiveInputValue}
													onChange={(e) => {
														const v = e.target.value;
					    const interimShown = interimTranscript || '';
														let base = v;
														if (voiceActive && interimShown) {
															if (base.endsWith(' ' + interimShown)) base = base.slice(0, -(' '.length + interimShown.length));
															else if (base.endsWith(interimShown)) base = base.slice(0, -interimShown.length);
														}
														setInput(base);
														if (voiceActive) {
															userEditedRef.current = true;
														}
													}}
									onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
								/>
								<button
									type="button"
									onClick={() => send()}
									disabled={!input.trim() || sending}
									className="rounded-full p-2 bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
									title="Send"
									aria-label="Send"
								>
									{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
								</button>
							</div>
							{/* Options row */}
							<div className="flex items-center justify-between px-4 pb-3 mt-2 text-sm">
								<div className="flex items-center gap-3">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
												<span className="hidden sm:inline">{thinkModeEnabled ? 'Learn Pro' : 'Learn+'}</span>
												<ChevronDown className="h-4 w-4" />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="start" className="w-64">
											<DropdownMenuItem
												onSelect={(e) => { e.preventDefault(); setThinkModeEnabled(v => !v); }}
												className="flex items-center gap-3"
											>
												<Brain className="h-4 w-4 text-emerald-600" />
												<span className="flex-1">Learn Pro</span>
												<span
													role="switch"
													aria-checked={thinkModeEnabled}
													className={`relative shrink-0 w-16 h-7 rounded-full transition-colors duration-200 ${thinkModeEnabled ? 'bg-violet-600' : 'bg-muted'}`}
												>
													<span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${thinkModeEnabled ? 'text-white opacity-100' : 'opacity-0'}`}>ON</span>
													<span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${thinkModeEnabled ? 'opacity-0' : 'text-foreground/60 opacity-100'}`}>OFF</span>
													<span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${thinkModeEnabled ? 'translate-x-8' : ''}`} />
												</span>
											</DropdownMenuItem>
											<DropdownMenuItem
												onSelect={(e) => { e.preventDefault(); setWebSearchEnabled(v => !v); }}
												className="flex items-center gap-3"
											>
												<Globe className="h-4 w-4 text-blue-600" />
												<span className="flex-1">Search</span>
												<span
													role="switch"
													aria-checked={webSearchEnabled}
													className={`relative shrink-0 w-16 h-7 rounded-full transition-colors duration-200 ${webSearchEnabled ? 'bg-blue-600' : 'bg-muted'}`}
												>
													<span className={`absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${webSearchEnabled ? 'text-white opacity-100' : 'opacity-0'}`}>ON</span>
													<span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold transition-opacity ${webSearchEnabled ? 'opacity-0' : 'text-foreground/60 opacity-100'}`}>OFF</span>
													<span className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${webSearchEnabled ? 'translate-x-8' : ''}`} />
												</span>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
									<div className="relative" ref={contextWrapperRef}>
										<button type="button" onClick={() => setContextOpen(o=>!o)} className="flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1 text-muted-foreground hover:text-foreground hover:bg-muted/60">
											<AtSign className="h-4 w-4" />
											<span>Add Context{selectedDocIds.length ? ` (${selectedDocIds.length})` : ''}</span>
										</button>
										{contextOpen && (
											<div className="absolute left-0 bottom-full mb-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 p-3">
												<div className="text-xs font-semibold mb-2 text-muted-foreground flex items-center justify-between">
													<span>Recents</span>
													<button type="button" onClick={()=>setContextOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
												</div>
												<div className="space-y-1 max-h-64 overflow-y-auto pr-1">
													{recentDocs.slice(0,4).map(d => {
														const active = selectedDocIds.includes(d.id);
														return (
															<button key={d.id} type="button" onClick={() => toggleDoc(d.id)} className={`w-full text-left text-sm rounded-lg px-3 py-2 border ${active ? 'border-blue-500 bg-blue-500/10 text-foreground' : 'border-transparent hover:bg-muted/60 text-muted-foreground'} transition-colors`}>{d.title}</button>
														);
													})}
													{recentDocs.slice(0,4).length === 0 && <div className="text-xs text-muted-foreground px-1 py-4">No documents yet.</div>}
												</div>
											</div>
										)}
									</div>
									{/* Language toggle removed */}
											{webSearchEnabled && (
												<span className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-600 rounded-full pl-2 pr-1 py-0.5 border border-blue-500/30">
													<Globe className="h-3 w-3" />
													<span>@WebSearch</span>
													<button type="button" onClick={() => setWebSearchEnabled(false)} className="hover:text-destructive/80 ml-0.5">
														<X className="h-3 w-3" />
													</button>
												</span>
											)}
										</div>
									<div className="flex items-center gap-4 text-muted-foreground">
									{/* Voice input section - fixed height container to prevent layout shift */}
									<div className="h-9 flex items-center">
										{voiceActive ? (
											<div className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1 pr-3 transition-all duration-200 ease-in-out">
												<div className="flex items-center gap-1 mr-1" aria-label={listening ? 'Listening…' : 'Processing voice…'}>
													<span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite]" />
													<span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite_0.15s]" />
													<span className="h-4 w-1 rounded-full bg-red-500 animate-[pulse_0.9s_ease-in-out_infinite_0.3s]" />
												</div>
												<button
													type="button"
													onClick={handleStopVoice}
													className="p-1.5 rounded-full bg-red-500/90 text-white hover:bg-red-600 transition-colors"
													title="Stop voice input"
												>
													<X className="h-4 w-4" />
												</button>
											</div>
										) : (
											<button
												title={mounted ? (speechSupported ? 'Start voice input' : 'Speech not supported') : 'Start voice input'}
												onClick={handleStartVoice}
												className="hover:text-foreground p-2 transition-colors duration-200"
												type="button"
											>
												<Mic className="h-5 w-5" />
											</button>
										)}
									</div>
								</div>
							</div>
							{selectedDocIds.length > 0 && (
								<div className="flex flex-wrap gap-2 px-4 pb-3 -mt-1">
									{selectedDocIds.map(id => {
										const title = recentDocs.find(d=>d.id===id)?.title || 'Document';
										return (
											<span key={id} className="inline-flex items-center gap-1 text-xs bg-muted/60 rounded-full pl-2 pr-1 py-0.5">
												{title.length > 18 ? title.slice(0,18)+"…" : title}
												<button type="button" onClick={()=>removeDoc(id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
											</span>
										);
										})}
									</div>
								)}
							</div>
					</div>
				</div>
			</div>
		</div>
	);
}
