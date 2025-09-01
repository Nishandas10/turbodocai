"use client"

import { useParams } from 'next/navigation'
import DocumentChat from '@/components/DocumentChat'

export default function ChatPage() {
  const params = useParams()
  const noteId = params.noteId as string

  return (
    <div className="h-full">
      <DocumentChat 
        documentId={noteId}
        documentTitle="Your Document"
      />
    </div>
  )
} 