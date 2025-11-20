"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { RotateCcw, ChevronLeft, ChevronRight, BookOpen, Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { generateFlashcards, Flashcard, checkProcessingStatus } from '@/lib/ragService';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import SummaryRating from '@/components/SummaryRating';
import { createFeedback } from '@/lib/firestore';

// Tailwind helper color tokens rely on your dark theme.
// This version provides a study-centric UI similar to the provided screenshot:
//  - Large centered card with the current question
//  - Navigation + index below card
//  - Bottom panel showing question & answer (answer hidden until revealed)
//  - Count of flashcards in header
//  - Regenerate + processing status feedback
//  - Defaults to generating 20 flashcards
export default function FlashcardsPage() {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const noteId = params?.noteId as string | undefined;
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false); // answer visibility
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('pending');
  const [processingProgress, setProcessingProgress] = useState<number | undefined>(undefined);
  const [flashcardRating, setFlashcardRating] = useState<number | undefined>();
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  // Effective owner resolution for shared docs (anyone with link)
  const ownerId = search?.get('owner') || undefined;
  const [effOwner, setEffOwner] = useState<string | undefined>(ownerId);
  // generationAttemptedRef: final generation after processing complete
  const generationAttemptedRef = useRef(false);
  // earlyGeneratedRef: we generated once while still processing
  const earlyGeneratedRef = useRef(false);
  const lastGenerationTsRef = useRef<number>(0);
  const DEFAULT_FLASHCARD_COUNT = 20;

  // Persist and recover owner query param like the main note page
  useEffect(() => {
    try {
      if (noteId && ownerId) {
        localStorage.setItem(`doc_owner_${noteId}`, ownerId);
        setEffOwner(ownerId);
      } else if (noteId && !ownerId) {
        const stored = localStorage.getItem(`doc_owner_${noteId}`) || undefined;
        if (stored) {
          setEffOwner(stored);
          // Keep URL consistent for downstream pages
          try { router.replace(`/notes/${noteId}/flashcards?owner=${stored}`); } catch { /* noop */ }
        }
      }
    } catch { /* ignore localStorage errors */ }
  }, [noteId, ownerId, router]);

  interface FetchOpts { force?: boolean; final?: boolean }
  const fetchFlashcards = useCallback(async (opts: FetchOpts = {}) => {
    if (!noteId) return;
    const targetOwner = effOwner || user?.uid;
    if (!targetOwner) return;
    
    // Strict generation control
    if (!opts.force) {
      // Don't generate if already loading
      if (loading) return;
      
      // Don't generate if we already have cards unless explicitly final
      if (flashcards.length > 0 && !opts.final) return;
      
      // Don't generate again if we already did while processing
      if (processingStatus === 'processing' && earlyGeneratedRef.current) return;
      
      // Don't generate if we already did final generation
      if ((processingStatus === 'completed' || processingStatus === 'ready') && generationAttemptedRef.current) return;
      
      // Enforce minimum time between generations
      if (Date.now() - lastGenerationTsRef.current < 5000) return;
    }
    
    // Set loading state atomically to prevent race conditions
    const wasLoading = loading;
    if (wasLoading) return;
    setLoading(true);
    setError(null);
    try {
      // Ensure document processed (using effective owner). If status lookup fails (permission), proceed anyway.
      let readyEnough = true;
      try {
        console.log('Checking processing status for noteId:', noteId, 'owner:', targetOwner);
        const statusInfo = await checkProcessingStatus(noteId, targetOwner);
        console.log('Processing status:', statusInfo);
        setProcessingStatus(statusInfo.status);
        setProcessingProgress(statusInfo.progress);
        readyEnough = (
          statusInfo.status === 'completed' ||
          statusInfo.status === 'ready' ||
          statusInfo.status === 'processing' ||
          statusInfo.status === 'failed' // If processing failed, still attempt flashcards via server fallback
        );
      } catch (statusErr) {
        // Likely permission/not-found for non-owner; don't surface "failed" UI—just proceed with generation.
        console.warn('Status check failed (continuing to generate):', statusErr);
        setProcessingStatus('ready');
        readyEnough = true;
      }
      if (!readyEnough) {
        setLoading(false);
        return;
      }
      console.log('Generating flashcards for noteId:', noteId, 'owner:', targetOwner);
      const cards = await generateFlashcards({ 
        documentId: noteId, 
        userId: targetOwner, 
        count: DEFAULT_FLASHCARD_COUNT,
        // When user clicks Regenerate, bypass cache and ask backend for a fresh set
        forceNew: opts.force === true,
      });
      console.log('Generated flashcards:', cards);
      setFlashcards(cards.map((c) => ({ ...c })));
      setCurrentCardIndex(0);
      setShowAnswer(false);
      // Mark generation state
      try {
        const statusInfo = await checkProcessingStatus(noteId, targetOwner);
        if (statusInfo.status === 'processing' && !opts.final) {
          earlyGeneratedRef.current = true;
        }
        if (statusInfo.status === 'completed' || statusInfo.status === 'ready' || opts.final) {
          generationAttemptedRef.current = true;
        }
      } catch { /* ignore post-gen status check errors */ }
      lastGenerationTsRef.current = Date.now();
  // reset any future scoring metrics here
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate flashcards';
      console.error('Error generating flashcards:', e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [noteId, user?.uid, effOwner, processingStatus, loading, flashcards.length]);

  // Single initial fetch ref
  const initialFetchRef = useRef(false);
  
  // Single initial fetch attempt
  useEffect(() => {
    if (!initialFetchRef.current && 
        !loading && 
        flashcards.length === 0 && 
        !generationAttemptedRef.current &&
        !earlyGeneratedRef.current) {
      initialFetchRef.current = true;
      fetchFlashcards();
    }
  }, [fetchFlashcards, flashcards.length, loading]);

  // Real-time listener for processing status -> auto generate once completed
  useEffect(() => {
    if (!noteId) return;
    const targetOwner = effOwner || user?.uid;
    if (!targetOwner) return;
    const documentRef = doc(db, 'documents', targetOwner, 'userDocuments', noteId);
    const unsub = onSnapshot(
      documentRef,
      (snap) => {
        if (!snap.exists()) return;
        interface LiveDocData { processingStatus?: string; status?: string; processingProgress?: number }
        const data = snap.data() as LiveDocData;
        const status = data.processingStatus || data.status || 'pending';
        const progress = data.processingProgress;
        
        // Only update UI if status actually changed
        if (status !== processingStatus) {
          setProcessingStatus(status);
          setProcessingProgress(progress);
          
          // Only auto-generate if:
          // 1. Status just became completed/ready/failed
          // 2. We haven't done final generation yet
          // 3. We're not currently loading
          if ((status === 'completed' || status === 'ready' || status === 'failed') && 
              !generationAttemptedRef.current && 
              !loading) {
            fetchFlashcards({ final: true });
          }
        } else if (progress !== processingProgress) {
          // Just update progress if only that changed
          setProcessingProgress(progress);
        }
      },
      (err) => {
        console.warn('Live status listener error (treat as ready):', err);
        setProcessingStatus('ready');
        // Try a final generation once if we haven't yet
        if (!generationAttemptedRef.current && !loading) {
          fetchFlashcards({ final: true });
        }
      }
    );
    return () => unsub();
  }, [noteId, user?.uid, effOwner, fetchFlashcards, processingStatus, processingProgress, loading]);

  // Polling fallback every 8s if still processing (in case listener misses update)
  useEffect(() => {
    // Clear polling if completed or already have cards
    if (processingStatus === 'completed' || 
        processingStatus === 'ready' || 
        flashcards.length > 0 || 
        generationAttemptedRef.current) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    if (!noteId) return;
    const targetOwner = effOwner || user?.uid;
    if (!targetOwner) return;
    if (!pollingRef.current) {
      pollingRef.current = setInterval(() => {
        // Only poll if:
        // 1. We haven't generated any cards yet
        // 2. We're not currently loading
        // 3. We haven't done early generation
        if (flashcards.length === 0 && !loading && !earlyGeneratedRef.current) {
          fetchFlashcards();
        }
      }, 8000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [processingStatus, noteId, user?.uid, effOwner, fetchFlashcards, flashcards.length, loading]);

  const handleNext = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
    }
  };

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setShowAnswer(false);
    }
  };

  const toggleAnswer = () => setShowAnswer((v) => !v);

  const handleFlashcardRating = useCallback(async (rating: number) => {
    if (!user?.uid || !noteId) return;
    setFlashcardRating(rating);
    setRatingSubmitting(true);
    try {
      await createFeedback(user.uid, user.email || '', 'flashcard', rating, '');
    } catch (e) {
      console.warn('Failed to save flashcard rating', e);
    } finally {
      setRatingSubmitting(false);
    }
  }, [user?.uid, user?.email, noteId]);

  const resetProgress = () => {
    setCurrentCardIndex(0);
    setShowAnswer(false);
  // reset scoring metrics if added later
  };

  const resetDocumentStatus = async () => {
    if (!noteId || !user?.uid) return;
    try {
      const response = await fetch('/api/debug-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          documentId: noteId, 
          userId: user.uid, 
          action: 'reset' 
        }),
      });
      const result = await response.json();
      console.log('Reset result:', result);
      // Trigger a re-fetch after reset
      setTimeout(() => fetchFlashcards(), 1000);
    } catch (error) {
      console.error('Reset failed:', error);
    }
  };

  // const currentCard = flashcards[currentCardIndex];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <BookOpen className="h-7 w-7 text-blue-500" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Flashcards</h1>
              <p className="text-xs text-muted-foreground mt-1">Study AI‑generated cards from your uploaded PDF.</p>
            </div>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {flashcards.length > 0 && `${flashcards.length} flashcards to study`}
            {flashcards.length === 0 && processingStatus !== 'completed' && processingStatus !== 'ready' && 'Preparing document…'}
            {flashcards.length === 0 && (processingStatus === 'completed' || processingStatus === 'ready') && !loading && 'No flashcards yet — regenerate?'}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <SummaryRating
            value={flashcardRating}
            onChange={handleFlashcardRating}
            disabled={!user?.uid || !noteId}
            loading={ratingSubmitting}
            label="Rate flashcards:"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchFlashcards({ force: true })}
              disabled={loading || !noteId || !user}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? 'Generating' : 'Regenerate'}
            </button>
            <button
              onClick={resetProgress}
              className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            {(processingStatus === 'processing' && !processingProgress) && (
              <button
                onClick={resetDocumentStatus}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/20"
                title="Reset stuck processing status"
              >
                🔧 Fix Status
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-6 pt-8 pb-10 overflow-y-auto">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-8">
          {error && (
            <div className="w-full rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {processingStatus !== 'completed' && processingStatus !== 'ready' && flashcards.length === 0 && (
            <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Document {processingStatus}…
                {typeof processingProgress === 'number' && (
                  <span>{processingProgress}%</span>
                )}
              </div>
              {typeof processingProgress === 'number' && (
                <div className="h-1 w-40 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                    style={{ width: `${Math.min(processingProgress, 99)}%` }}
                  />
                </div>
              )}
            </div>
          )}

            {/* Central Card */}
          <div className="w-full flex justify-center">
            <div
              className={`relative w-full max-w-2xl rounded-2xl border border-border/60 bg-[#14161b] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_12px_-2px_rgba(0,0,0,0.5),0_12px_32px_-4px_rgba(0,0,0,0.4)] transition-colors duration-300 ${!flashcards[currentCardIndex] ? 'opacity-40' : ''}`}
              onClick={() => flashcards[currentCardIndex] && toggleAnswer()}
            >
              {flashcards[currentCardIndex] ? (
                <div className="flex h-full flex-col justify-center text-center select-none">
                  <div className="absolute left-4 top-4">
                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-blue-300">
                      {flashcards[currentCardIndex].category || 'Concept'}
                    </span>
                  </div>
                  <h2 className="mx-auto max-w-xl text-balance text-lg font-medium leading-relaxed text-white">
                    {flashcards[currentCardIndex].front}
                  </h2>
                  <div className="mt-6 text-[10px] text-muted-foreground">Click card to {showAnswer ? 'hide' : 'reveal'} answer</div>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  {loading ? 'Generating flashcards…' : 'No flashcards'}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleAnswer(); }}
                className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] font-medium text-white/80 hover:bg-white/10"
              >
                {showAnswer ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showAnswer ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex w-full max-w-2xl items-center justify-center gap-6 text-sm">
            <button
              onClick={handlePrevious}
              disabled={currentCardIndex === 0}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted/30 text-foreground hover:bg-muted/50 disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-xs tracking-wide text-muted-foreground">
              {flashcards.length ? `${currentCardIndex + 1} / ${flashcards.length}` : '—'}
            </div>
            <button
              onClick={handleNext}
              disabled={currentCardIndex === flashcards.length - 1 || flashcards.length === 0}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted/30 text-foreground hover:bg-muted/50 disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Q/A Panel */}
          {flashcards[currentCardIndex] && (
            <div className="w-full max-w-5xl rounded-xl border border-border/60 bg-[#101215] p-6 shadow-inner">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Question</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{flashcards[currentCardIndex].front}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Answer
                    {!showAnswer && (
                      <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-300">Hidden</span>
                    )}
                  </h3>
                  {showAnswer ? (
                    <p className="text-sm leading-relaxed whitespace-pre-line text-blue-50/90">{flashcards[currentCardIndex].back}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground/70">Click the card or Show button to reveal the answer.</p>
                  )}
                </div>
              </div>
              {/* Simple progress bar */}
              <div className="mt-6 h-1 w-full rounded-full bg-white/5">
                <div
                  className="h-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                  style={{ width: `${flashcards.length ? ((currentCardIndex + 1) / flashcards.length) * 100 : 0}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Progress</span>
                <span>{flashcards.length ? Math.round(((currentCardIndex + 1) / flashcards.length) * 100) : 0}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}