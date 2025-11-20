import { useState, useCallback } from 'react'
import { createFeedback } from '@/lib/firestore'
import { useAuth } from '@/contexts/AuthContext'
import SummaryRating from './SummaryRating'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
}

export default function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { user } = useAuth()
  const [rating, setRating] = useState<number | undefined>(undefined)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  // Allow submitting with just a rating; message optional
  const canSubmit = !!user?.uid && !!rating && !submitting

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !user?.uid) return
    setSubmitting(true)
    try {
      const id = await createFeedback(user.uid, user.email || '', rating!, message.trim())
      setSubmittedId(id)
      // Reset local state
      setMessage('')
      setRating(undefined)
      // Auto-close modal after successful submission
      onClose()
    } catch (e) {
      console.error('Feedback submit failed', e)
      alert('Failed to submit feedback. Please try again in a moment.')
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, user?.uid, user?.email, rating, message, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground text-sm px-2 py-1"
          aria-label="Close feedback modal"
        >✕</button>
        <h2 className="text-xl font-semibold mb-4">Share Feedback</h2>
        {!user?.uid && (
          <div className="mb-4 text-sm text-muted-foreground">Please sign in to submit feedback.</div>
        )}
        {submittedId && (
          <div className="mb-4 text-sm text-green-600">Thank you! Your feedback was submitted.</div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">How is your experience with BlumeNote?</label>
            <SummaryRating
              value={rating}
              onChange={(v) => setRating(v)}
              disabled={!user?.uid}
              loading={submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">How can we improve BlumeNote / Any feature request?</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Share ideas, pain points, or feature requests..."
              className="w-full resize-y bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              disabled={!user?.uid}
            />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
          >Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-4 py-2 rounded-md text-sm text-white ${canSubmit ? 'bg-blue-600 hover:bg-blue-700' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
          >{submitting ? 'Submitting...' : 'Submit Feedback'}</button>
        </div>
      </div>
    </div>
  )
}
