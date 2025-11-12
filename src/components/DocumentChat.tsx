"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Brain, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { db, functions } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, addDoc, serverTimestamp, doc, setDoc, type Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

interface FirestoreChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Timestamp | null;
  streaming?: boolean;
}

interface DocumentChatProps {
  documentId?: string;
  documentTitle?: string;
  ownerId?: string; // owner of the document (for shared docs)
}

export default function DocumentChat({ documentId, documentTitle, ownerId }: DocumentChatProps) {
  const { user } = useAuth();
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FirestoreChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Speech to text (same UX as original component)
  const { supported: speechSupported, listening, interimTranscript, start: startSpeech, stop: stopSpeech, reset: resetSpeech } = useSpeechToText({
    lang: 'en-US',
    fallbackLangs: ['en-US'],
    continuous: false,
    interimResults: true,
    onSegment: (seg) => {
      setInputValue((prev) => (prev ? prev + ' ' : '') + seg);
    }
  });

  // Restore existing chatId for this doc (persist locally)
  useEffect(() => {
    if (!user?.uid || !documentId) return;
    const key = `doc_chat_${user.uid}_${documentId}`;
    const stored = localStorage.getItem(key);
    if (stored) setChatId(stored);
  }, [user?.uid, documentId]);

  // Subscribe to Firestore messages when chatId available
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    
    // Use document-based path if documentId is provided, otherwise use standalone path
    const col = documentId 
      ? collection(db, "documents", ownerId || user.uid, "userDocuments", documentId, "chats", chatId, "messages")
      : collection(db, "chats", chatId, "messages");
    
    const qy = query(col, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const msgs: FirestoreChatMessage[] = snap.docs.map(d => {
        const data = d.data() as Omit<FirestoreChatMessage, 'id'>;
        return {
          id: d.id,
          role: data.role,
          content: data.content,
          createdAt: data.createdAt,
          streaming: data.streaming,
        };
      });
      setMessages(msgs);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
    });
    return () => unsub();
  }, [chatId, user?.uid, documentId, ownerId]);

  // Initial local greeting if no chat yet
  const showLocalGreeting = !chatId && messages.length === 0;
  useEffect(() => {
    if (showLocalGreeting && documentId) {
      setMessages([
        {
          id: "local-greeting",
          role: "assistant",
          content: `Hello! Ask anything about \"${documentTitle}\" and I'll ground answers in its indexed content when available.`,
        },
      ]);
    } else if (showLocalGreeting && !documentId) {
      setMessages([
        {
          id: "local-greeting",
          role: "assistant",
          content: "Hello! Ask about your documents and I'll cite their content when indexed.",
        },
      ]);
    }
  }, [showLocalGreeting, documentId, documentTitle]);

  const send = async () => {
    const text = inputValue.trim();
    if (!text || !user?.uid) return;
    if (!chatId) {
      // First message: create Firestore user message optimistically after cloud function call
      setSending(true);
      try {
        const call = httpsCallable(functions, "sendChatMessage");
        const result = await call({
          userId: user.uid,
          prompt: text,
          language: 'en',
          docIds: documentId ? [documentId] : [],
          docOwnerId: ownerId || user.uid,
        });
        const data = result.data as { success: boolean; data?: { chatId: string }; error?: string };
        if (!data.success || !data.data?.chatId) throw new Error(data.error || 'chat creation failed');
        setChatId(data.data.chatId);
        localStorage.setItem(`doc_chat_${user.uid}_${documentId}`, data.data.chatId);
        setInputValue("");
        resetSpeech();
      } catch (e) {
        console.error("sendChatMessage initial failed", e);
        alert("Failed to start chat");
      } finally {
        setSending(false);
      }
      return;
    }
    // Existing chat: add user message & invoke sendChatMessage (which will stream assistant reply)
    setSending(true);
    try {
      // Use document-based path if documentId is provided, otherwise use standalone path
      if (documentId) {
        await addDoc(collection(db, "documents", ownerId || user.uid, "userDocuments", documentId, "chats", chatId, "messages"), {
          role: "user",
          content: text,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "documents", ownerId || user.uid, "userDocuments", documentId, "chats", chatId), { updatedAt: serverTimestamp() }, { merge: true });
      } else {
        await addDoc(collection(db, "chats", chatId, "messages"), {
          role: "user",
          content: text,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, "chats", chatId), { updatedAt: serverTimestamp() }, { merge: true });
      }
      
      const call = httpsCallable(functions, "sendChatMessage");
      void call({
        userId: user.uid,
        prompt: text,
        chatId,
        language: 'en',
        docIds: documentId ? [documentId] : [],
        docOwnerId: ownerId || user.uid,
      });
      setInputValue("");
      resetSpeech();
    } catch (e) {
      console.error("sendChatMessage failed", e);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-card-foreground">
            {documentId ? `Chat with ${documentTitle}` : 'Chat with Your Documents'}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Context-grounded AI answers based on indexed document content.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' ? (
              <div className="bg-muted/40 rounded-lg px-0 py-0 max-w-[80%]">
                <div className="p-3 text-sm leading-relaxed">
                  <MarkdownMessage content={m.content} />
                  {m.streaming ? <span className="animate-pulse ml-1">█</span> : null}
                </div>
              </div>
            ) : (
              <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-[80%] text-sm whitespace-pre-wrap">
                {m.content}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-muted text-card-foreground rounded-lg px-4 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={documentId ? `Ask about ${documentTitle}…` : 'Ask a question…'}
              className="w-full min-h-[40px] max-h-[120px] p-3 bg-background border border-border rounded-lg resize-none text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 pr-10"
              disabled={sending}
            />
            {speechSupported && (
              <button
                type="button"
                onClick={() => {
                  if (sending) return;
                  if (listening) { stopSpeech(); } else { resetSpeech(); startSpeech(); }
                }}
                title={listening ? 'Stop voice input' : 'Start voice input'}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                className={`absolute right-2 bottom-2 p-2 rounded-md transition-colors ${listening ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                disabled={sending}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={() => void send()}
            disabled={!inputValue.trim() || sending}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Enter to send, Shift+Enter for newline</span>
          {speechSupported && (
            <span className="truncate max-w-[60%]" aria-live="polite">{listening ? (interimTranscript || 'Listening…') : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}
