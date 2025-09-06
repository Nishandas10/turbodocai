"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, FileText, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { queryDocuments, QueryResult } from "@/lib/ragService";

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
}

export default function DocumentChat({ documentId, documentTitle }: DocumentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

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

  // Initial greeting message
  useEffect(() => {
    const greeting: ChatMessage = {
      id: "greeting",
      type: "assistant",
      content: documentId 
        ? `Hello! I'm here to help you with questions about "${documentTitle}". What would you like to know?`
        : "Hello! I'm here to help you with questions about your uploaded documents. What would you like to know?",
      timestamp: new Date(),
    };
    setMessages([greeting]);
  }, [documentId, documentTitle]);

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

      const result = await queryDocuments({
        question: inputValue.trim(),
        userId: user.uid,
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
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.type === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-muted text-card-foreground"
              }`}
            >
              <div className="text-sm">{message.content}</div>
              
              {/* Sources for assistant messages */}
              {message.type === "assistant" && message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-300/20">
                  <div className="text-xs text-gray-300 mb-2">
                    Sources (Confidence: {message.confidence?.toFixed(1)}%):
                  </div>
                  {message.sources.map((source, index) => (
                    <div key={index} className="text-xs bg-black/20 rounded p-2 mb-1">
                      <div className="flex items-center gap-1 mb-1">
                        <FileText className="h-3 w-3" />
                        <span className="font-medium">{source.title}</span>
                        <span className="text-gray-400">({source.score.toFixed(2)})</span>
                      </div>
                      <div className="text-gray-300">{source.chunk}</div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="text-xs opacity-70 mt-1">
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
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your documents..."
            className="flex-1 min-h-[40px] max-h-[120px] p-3 bg-background border border-border rounded-lg resize-none text-card-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
