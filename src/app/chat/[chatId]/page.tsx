"use client"

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowUp, Loader2, ChevronDown, AtSign, Mic, X } from "lucide-react";
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
	const [language, setLanguage] = useState<'en' | 'as'>('en');
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
		if (p && user?.uid) {
			// Clear the prompt from URL to avoid re-sends on hot reloads
			const url = new URL(window.location.href);
			url.searchParams.delete("prompt");
			window.history.replaceState(null, "", url.toString());
			// Send without waiting for response; streaming will update UI
			void send(p);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [search, user?.uid]);

	const quickLangRef = useRef<'en' | 'as' | 'unknown'>('unknown');
	const lastPartialRef = useRef<string>('');
	const [translatedInterim, setTranslatedInterim] = useState<string>('');
	const interimTranslateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const currentInterimRef = useRef<string>('');
	const translationAbortRef = useRef<AbortController | null>(null);

	const isAssameseScript = (t: string) => /[\u0980-\u09FF]/.test(t);

	const translateInterimText = async (text: string, isLatest: boolean = true) => {
		if (!text.trim() || language !== 'as' || !isLatest) return;
		// If already Assamese script, keep as-is
		if (isAssameseScript(text)) {
			setTranslatedInterim(text);
			return;
		}
		// Abort prior
		if (translationAbortRef.current) translationAbortRef.current.abort();
		try {
			const controller = new AbortController();
			translationAbortRef.current = controller;
			const res = await fetch('/api/translate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text, targetLang: 'as', force: true }),
				signal: controller.signal
			});
			if (!res.ok || controller.signal.aborted) return;
			const json: { success?: boolean; data?: { translatedText?: string } } = await res.json();
			const translated = json?.data?.translatedText;
			if (!controller.signal.aborted && translated && currentInterimRef.current === text) {
				setTranslatedInterim(translated);
			}
		} catch (e) {
			if ((e as Error).name !== 'AbortError') {
				if (currentInterimRef.current === text) setTranslatedInterim(text);
			}
		}
	};

	const { supported: speechSupported, listening, interimTranscript, start, stop, reset } = useSpeechToText({
		lang: language === 'as' ? 'as-IN' : 'en-US',
		fallbackLangs: language === 'as' ? ['bn-IN','en-US'] : ['en-US'],
		continuous: false,
		interimResults: true,
		onPartial: (partial) => {
			lastPartialRef.current = partial;
			currentInterimRef.current = partial;
			// quick detection
			if (isAssameseScript(partial)) quickLangRef.current = 'as';
			else if (/[a-zA-Z]/.test(partial) && !isAssameseScript(partial) && quickLangRef.current === 'unknown') quickLangRef.current = 'en';
			// When Assamese target selected, always show partial immediately then translate if needed
			if (language === 'as' && partial.trim()) {
				if (interimTranslateTimerRef.current) clearTimeout(interimTranslateTimerRef.current);
				setTranslatedInterim(partial); // immediate echo
				interimTranslateTimerRef.current = setTimeout(() => {
					translateInterimText(partial, currentInterimRef.current === partial);
				}, 180); // slightly faster
			} else {
				setTranslatedInterim(partial);
			}
		},
		onSegment: (seg) => {
			setInput(prev => prev ? prev + ' ' + seg : seg);
			setTranslatedInterim(''); // clear interim on final segment
			currentInterimRef.current = '';
		}
	});

	// Cleanup on unmount or language change
	useEffect(() => {
		return () => {
			if (interimTranslateTimerRef.current) {
				clearTimeout(interimTranslateTimerRef.current);
			}
			if (translationAbortRef.current) {
				translationAbortRef.current.abort();
			}
		};
	}, []);

	// Clear interim translation when language changes
	useEffect(() => {
		setTranslatedInterim('');
		currentInterimRef.current = '';
		if (translationAbortRef.current) {
			translationAbortRef.current.abort();
		}
	}, [language]);

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
		setVoiceActive(true);
		start();
	};
	const handleStopVoice = () => {
		wantVoiceRef.current = false;
		stop();
		if (deactivateTimerRef.current) clearTimeout(deactivateTimerRef.current);
		// Immediately hide pill for snappy UX
		setVoiceActive(false);
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
		if (interimTranslateTimerRef.current) clearTimeout(interimTranslateTimerRef.current);
	}, []);

	// Debounced translation gating (refactored: react to input+language only)
	const lastTranslatedRef = useRef<string>("");
	const translateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		const current = input.trim();
		if (!current || current === lastTranslatedRef.current) return;
		// if user has selected Assamese but content appears already Assamese (script), skip
		if (language === 'as' && isAssameseScript(current)) {
			lastTranslatedRef.current = current;
			return;
		}
		// if English target and text clearly Latin only, skip
		if (language === 'en' && /[a-zA-Z]/.test(current) && !isAssameseScript(current)) {
			lastTranslatedRef.current = current;
			return;
		}
		if (translateTimerRef.current) clearTimeout(translateTimerRef.current);
		translateTimerRef.current = setTimeout(() => {
			(async () => {
				try {
					const targetLang = language === 'as' ? 'as' : 'en';
					const force = true; // always force since heuristic simplified
					const controller = new AbortController();
					const abortTimeout = setTimeout(()=>controller.abort(), 9000);
					const res = await fetch('/api/translate', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ text: current, targetLang, force }),
						signal: controller.signal
					});
					clearTimeout(abortTimeout);
					if (!res.ok) return;
					const json: { success?: boolean; data?: { translatedText?: string } } = await res.json();
					const translated = json?.data?.translatedText;
					if (translated && translated.trim() && translated.trim() !== current) {
						setInput(translated.trim());
						lastTranslatedRef.current = translated.trim();
					} else {
						lastTranslatedRef.current = current;
					}
				} catch {/* ignore */}
			})();
		}, 300);
		return () => { if (translateTimerRef.current) clearTimeout(translateTimerRef.current); };
	}, [input, language]);

	// Show interim transcript in input while listening
	useEffect(() => {
		if (listening && interimTranscript) {
			// Don't permanently set; overlay visually by merging
			// We'll just append interim to displayed value via computed variable below
		}
	}, [interimTranscript, listening]);

	const effectiveInputValue = (voiceActive && (translatedInterim || interimTranscript))
		? (input ? input + ' ' + (translatedInterim || interimTranscript) : (translatedInterim || interimTranscript))
		: input;

	const send = async (overrideText?: string) => {
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
			void call({ userId: user.uid, prompt: text, chatId, language, docIds: selectedDocIds });

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
									placeholder={language === 'en' ? 'Ask something...' : 'প্ৰশ্ন কৰক...'}
									value={effectiveInputValue}
									onChange={(e) => setInput(e.target.value)}
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
									<button className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
										<span className="hidden sm:inline">Assistant</span>
										<span className="sm:hidden">Model</span>
										<ChevronDown className="h-4 w-4" />
									</button>
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
									<div className="flex items-center gap-1 rounded-full bg-muted/40 p-1">
										<button
											className={`px-2 py-0.5 text-xs rounded-full ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
											onClick={() => setLanguage('en')}
										>EN</button>
										<button
											className={`px-2 py-0.5 text-xs rounded-full ${language === 'as' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
											onClick={() => setLanguage('as')}
										>AS</button>
									</div>
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
