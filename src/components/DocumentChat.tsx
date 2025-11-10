"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Brain, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { queryDocuments, QueryResult } from "@/lib/ragService";
import MarkdownMessage from "@/components/MarkdownMessage";
import { useSpeechToText } from "@/hooks/useSpeechToText";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: QueryResult["sources"];
  confidence?: number;
}

interface DocumentChatProps {
  documentId?: string;
  documentTitle?: string;
  ownerId?: string; // owner of the document (for shared docs)
}

export default function DocumentChat({ documentId, documentTitle, ownerId }: DocumentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { supported: speechSupported, listening, interimTranscript, start: startSpeech, stop: stopSpeech, reset: resetSpeech } = useSpeechToText({
    lang: 'en-US',
    fallbackLangs: ['en-US'],
    continuous: false,
    interimResults: true,
    onSegment: (seg) => {
      setInputValue((prev) => (prev ? prev + ' ' : '') + seg);
    }
  });

  // Dynamic follow-up detection (length/semantic-light heuristics) and context-aware expansion
  const STOPWORDS = new Set([
    "a","an","the","and","or","but","if","then","so","than","that","this","those","these",
    "is","am","are","was","were","be","been","being","do","does","did","doing",
    "to","of","in","on","for","with","as","by","at","from","about","into","over","after","before",
    "it","its","it's","i","you","he","she","we","they","me","him","her","us","them","my","your","our","their",
    "can","could","should","would","may","might","will","shall","please","kindly","just",
    "more","details","detail","detailed","in","detail","elaborate","continue","examples","example","why","how","steps",
  ]);

  const tokenize = (text: string): string[] =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

  const informativeTokenCount = (text: string): number =>
    tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length > 2).length;

  const isLikelyFollowUp = (text: string): boolean => {
    const trimmed = text.trim();
    const tokens = tokenize(trimmed);
    const info = informativeTokenCount(trimmed);
    // Heuristics: short text with few informative tokens is a follow-up
    return trimmed.length < 48 || tokens.length <= 6 || info <= 2;
  };

  const buildEffectiveQuestion = (current: string): string => {
    if (!isLikelyFollowUp(current)) return current;

    // Use recent context: find last meaningful user message and last assistant reply
    const reversed = [...messages].reverse();
    const lastAssistant = reversed.find((m) => m.type === "assistant");
    const lastUserMeaningful = reversed.find(
      (m) => m.type === "user" && !isLikelyFollowUp(m.content)
    );

    // Also gather a brief context window of recent turns
    const recentWindow = reversed
      .slice(0, 6)
      .map((m) => `${m.type === "user" ? "User" : "Assistant"}: ${m.content}`)
      .reverse()
      .join("\n");

    const topic =
      lastUserMeaningful?.content || lastAssistant?.content?.slice(0, 240) || "previous topic";

    // Build a dynamic prompt that includes the user's follow-up phrase verbatim
    return [
      "Follow-up to previous conversation:",
      `Last topic: "${topic}"`,
      "\nRecent context:",
      recentWindow,
      "\nUser's follow-up request (interpret and fulfill):",
      `"${current}"`,
      "\nPlease continue the explanation focusing on the same topic. Expand with depth if the follow-up is vague. If the follow-up implies a format (e.g., examples, steps, comparison), adapt accordingly. Use clear headings, bullets, and include equations/code where helpful. Keep sources out of the message.",
    ].join("\n");
  };

  // Helper functions for localStorage persistence  
  const saveChatMessages = useCallback((msgs: ChatMessage[]) => {
    try {
      const key = `chat_${user?.uid}_${ownerId || user?.uid}_${documentId || 'global'}`;
      localStorage.setItem(key, JSON.stringify(msgs.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }))));
    } catch (error) {
      console.warn('Failed to save chat messages:', error);
    }
  }, [user?.uid, ownerId, documentId]);
  
  const loadChatMessages = useCallback((): ChatMessage[] => {
    try {
      const key = `chat_${user?.uid}_${ownerId || user?.uid}_${documentId || 'global'}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: ChatMessage & { timestamp: string }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load chat messages:', error);
    }
    return [];
  }, [user?.uid, ownerId, documentId]);

  // Simple client-side streaming helper
  const streamText = async (
    full: string,
    onChunk: (partial: string) => void,
    opts?: { step?: number; delayMs?: number }
  ) => {
    const step = Math.max(1, opts?.step ?? 2);
    const delay = Math.max(6, opts?.delayMs ?? 16);
    let i = 0;
    while (i < full.length) {
      i += step;
      onChunk(full.slice(0, i));
      // Scroll as we stream
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      await new Promise((r) => setTimeout(r, delay));
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Save messages to localStorage whenever they change (except initial load)
  useEffect(() => {
    if (messages.length > 0 && user?.uid) {
      saveChatMessages(messages);
    }
  }, [messages, saveChatMessages, user?.uid]);

  // Load existing messages or create initial greeting
  useEffect(() => {
    if (!user?.uid) return;
    
    const existingMessages = loadChatMessages();
    if (existingMessages.length > 0) {
      setMessages(existingMessages);
    } else {
      const greeting: ChatMessage = {
        id: "greeting",
        type: "assistant",
        content: documentId 
          ? `Hello! I'm here to help you with questions about "${documentTitle}". What would you like to know?`
          : "Hello! I'm here to help you with questions about your uploaded documents. What would you like to know?",
        timestamp: new Date(),
      };
      setMessages([greeting]);
    }
  }, [documentId, documentTitle, user?.uid, loadChatMessages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !user?.uid || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // Create placeholder assistant message that we'll stream into
      const assistantId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          type: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      const effectiveQuestion = buildEffectiveQuestion(inputValue.trim());
      const result = await queryDocuments({
        question: effectiveQuestion,
        // IMPORTANT: pass the document owner's userId so the backend queries the correct vector index
        userId: ownerId || user.uid,
        documentId: documentId,
        topK: 5,
      });

      // Stop spinner and stream the answer text into the placeholder message
      setIsLoading(false);
      await streamText(result.answer || "", (partial) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: partial } : m))
        );
      });

      // Attach sources and confidence once streaming is done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: result.answer,
                sources: result.sources,
                confidence: result.confidence,
              }
            : m
        )
      );
    } catch (error) {
      console.error("Error querying documents:", error);
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "I'm sorry, I encountered an error while trying to answer your question. Please try again or make sure your documents have been processed.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      // If we already turned it off for streaming, this is a no-op
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-card-foreground">
            {documentId ? `Chat with ${documentTitle}` : "Chat with Your Documents"}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Ask questions about your uploaded documents and get AI-powered answers.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg ${
                message.type === "user"
                  ? "bg-blue-500 text-white px-4 py-2"
                  : "bg-muted/40 px-0 py-0"
              }`}
            >
              {message.type === "assistant" ? (
                <div className="p-3">
                  <MarkdownMessage content={message.content} />
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap px-4 py-2">{message.content}</div>
              )}

              <div className="text-xs opacity-70 mt-1 px-3 pb-2">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted text-card-foreground rounded-lg px-4 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2 items-stretch">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your documents..."
              className="w-full min-h-[40px] max-h-[120px] p-3 bg-background border border-border rounded-lg resize-none text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 pr-10"
              disabled={isLoading}
            />
            {speechSupported && (
              <button
                type="button"
                onClick={() => {
                  if (isLoading) return;
                  if (listening) {
                    stopSpeech();
                  } else {
                    resetSpeech();
                    startSpeech();
                  }
                }}
                title={listening ? 'Stop voice input' : 'Start voice input'}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                className={`absolute right-2 bottom-2 p-2 rounded-md transition-colors ${listening ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                disabled={isLoading}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>Press Enter to send, Shift+Enter for new line</span>
          {speechSupported && (
            <span className="truncate max-w-[60%]" aria-live="polite">
              {listening ? (interimTranscript || 'Listening…') : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
