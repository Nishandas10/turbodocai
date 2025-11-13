"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { collection, onSnapshot, orderBy, query, limit, type Timestamp } from "firebase/firestore"
import { Brain } from "lucide-react"

interface ChatThumbnailProps {
  chatId: string
  className?: string
}

interface ChatMsg {
  id?: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt?: Timestamp | Date | null
  streaming?: boolean
}

// Shows last few chat messages (user/assistant) as a miniature stacked preview.
export default function ChatThumbnail({ chatId, className }: ChatThumbnailProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chatId) return
    setError(null)
    // Subscribe to last 4 messages (descending) then reverse for chronological display
    const col = collection(db, 'chats', chatId, 'messages')
    const qy = query(col, orderBy('createdAt', 'desc'), limit(4))
    const unsub = onSnapshot(qy, snap => {
      const raw = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChatMsg,'id'>) })) as ChatMsg[]
      const ordered = raw.slice().reverse()
      setMessages(ordered)
    }, err => { setError(err?.message || 'Failed to load'); })
    return () => unsub()
  }, [chatId])

  if (error) {
    return (
      <div className={"absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground px-3 text-center " + (className||'')}>
        <span>Error</span>
      </div>
    )
  }

  if (!messages.length) {
    return (
      <div className={"absolute inset-0 flex flex-col items-center justify-center gap-2 " + (className||'')}>
        <Brain className="h-8 w-8 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Chat</span>
      </div>
    )
  }

  return (
    <div className={"absolute inset-0 p-3 overflow-hidden " + (className||'')}>
      <div className="space-y-1 text-[10px] leading-4">
        {messages.map(m => (
          <div
            key={m.id}
            className={`truncate max-w-full px-2 py-1 rounded-md ${m.role === 'user' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'bg-muted/70 text-foreground/80'}`}
            title={m.content}
          >
            {m.content.slice(0,100)}{m.content.length>100?'…':''}
          </div>
        ))}
      </div>
    </div>
  )
}
