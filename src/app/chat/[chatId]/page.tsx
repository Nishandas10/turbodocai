"use client"

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { functions, db } from "@/lib/firebase";
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

	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [sending, setSending] = useState(false);
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
			void call({ userId: user.uid, prompt: text, chatId });

			setInput("");
		} catch (e) {
			console.error("sendChatMessage failed", e);
			alert("Failed to send message");
		} finally {
			setSending(false);
		}
	};

	const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") send();
	};

	return (
		<div className="h-screen bg-background flex overflow-hidden">
			{/* Left Sidebar */}
			<DashboardSidebar />

			{/* Chat Content */}
			<div className="flex-1 flex flex-col">
				<div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl w-full mx-auto">
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

				<div className="border-t border-border">
					<div className="max-w-3xl w-full mx-auto p-4">
						<div className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-2">
							<input
								className="flex-1 bg-transparent outline-none text-foreground placeholder-muted-foreground py-2"
								placeholder="Send a message"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={onKey}
							/>
							<button
								type="button"
								onClick={() => send()}
								disabled={!input.trim() || sending}
								className="rounded-full p-2 bg-foreground text-background hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
								title="Send"
								aria-label="Send"
							>
								{sending ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<ArrowUp className="h-4 w-4" />
								)}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
