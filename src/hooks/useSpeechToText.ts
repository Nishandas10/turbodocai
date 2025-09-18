"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechToTextOptions {
  lang?: string; // requested locale
  fallbackLangs?: string[]; // optional ordered fallback locales
  continuous?: boolean; // keep listening after final results
  interimResults?: boolean; // whether to provide interim transcripts
  onSegment?: (text: string) => void; // fires for each new final segment
  onPartial?: (text: string) => void; // fires rapidly with interim text
}

interface UseSpeechToTextReturn {
  supported: boolean;
  listening: boolean;
  transcript: string; // accumulated final transcript
  interimTranscript: string; // most recent interim text (not yet final)
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Lightweight Web Speech API wrapper (Chrome / Edge). Falls back gracefully if unsupported.
 */
export function useSpeechToText(
  options: UseSpeechToTextOptions = {}
): UseSpeechToTextReturn {
  const {
    lang = "en-US",
    fallbackLangs = [],
    continuous = false,
    interimResults = true,
    onSegment,
    onPartial,
  } = options;

  type RecognitionConstructor = new () => SpeechRecognitionLike;
  interface SpeechRecognitionResultAlternativeLike {
    transcript: string;
    confidence: number;
  }
  interface SpeechRecognitionResultLike {
    isFinal: boolean;
    0: SpeechRecognitionResultAlternativeLike;
    [index: number]: SpeechRecognitionResultAlternativeLike;
  }
  interface SpeechRecognitionEventLike {
    resultIndex: number;
    results: SpeechRecognitionResultLike[] & {
      length: number;
      [index: number]: SpeechRecognitionResultLike;
    };
  }
  interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult:
      | ((this: SpeechRecognitionLike, ev: SpeechRecognitionEventLike) => void)
      | null;
    onerror:
      | ((this: SpeechRecognitionLike, ev: { error?: string }) => void)
      | null;
    onend: ((this: SpeechRecognitionLike, ev: unknown) => void) | null;
    start: () => void;
    stop: () => void;
  }
  // Grab browser implementation if present
  const globalAny: Record<string, unknown> | undefined =
    typeof window !== "undefined"
      ? (window as unknown as Record<string, unknown>)
      : undefined;
  const RecognitionClass: RecognitionConstructor | null =
    (globalAny &&
      ((globalAny["SpeechRecognition"] as RecognitionConstructor | undefined) ||
        (globalAny["webkitSpeechRecognition"] as
          | RecognitionConstructor
          | undefined))) ||
    null;
  const supported = !!RecognitionClass;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const deliveredSegmentsRef = useRef<string[]>([]);

  const triedFallbackRef = useRef(false);

  const start = useCallback(() => {
    if (!supported) return;
    setError(null);
    if (!recognitionRef.current) {
      const rec = new RecognitionClass();
      // Assign primary lang; some browsers may throw for unsupported locale
      try {
        rec.lang = lang;
      } catch {
        // ignore
      }
      rec.continuous = continuous;
      rec.interimResults = interimResults;

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0].transcript.trim();
          if (res.isFinal) {
            if (!deliveredSegmentsRef.current.includes(text)) {
              deliveredSegmentsRef.current.push(text);
              setTranscript((prev) => (prev ? prev + " " : "") + text);
              onSegment?.(text);
            }
          } else {
            interim += text + " ";
          }
        }
        setInterimTranscript(interim.trim());
        if (interim && onPartial) onPartial(interim.trim());
      };

      rec.onerror = (e: { error?: string }) => {
        const code = e?.error || "speech_error";
        setError(code);
        // Attempt one-time fallback locale if provided
        if (!triedFallbackRef.current && fallbackLangs.length) {
          triedFallbackRef.current = true;
          try {
            rec.stop();
          } catch {}
          const fb = fallbackLangs[0];
          try {
            (rec as unknown as SpeechRecognitionLike).lang = fb;
          } catch {}
          try {
            rec.start();
            setListening(true);
            return;
          } catch {
            /* ignore */
          }
        }
      };

      rec.onend = () => {
        setListening(false);
        setInterimTranscript("");
        if (continuous && recognitionRef.current) {
          // Auto-restart if continuous
          try {
            recognitionRef.current.start();
            setListening(true);
          } catch {}
        }
      };

      recognitionRef.current = rec;
    }
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // already started
    }
  }, [
    supported,
    lang,
    continuous,
    interimResults,
    onSegment,
    onPartial,
    fallbackLangs,
    RecognitionClass,
  ]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    deliveredSegmentsRef.current = [];
  }, []);

  // Stop when component unmounts
  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    },
    []
  );

  // If language changes mid-session, restart
  useEffect(() => {
    if (listening) {
      stop();
      setTimeout(() => start(), 50);
    }
  }, [lang, listening, start, stop]);

  return {
    supported,
    listening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}

export default useSpeechToText;
