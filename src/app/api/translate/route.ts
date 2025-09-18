import { NextRequest, NextResponse } from "next/server";

// Reproduce logic from Cloud Function translateText with Assamese vs Hindi heuristics.
// Simple in-memory LRU-ish cache (reset on server restart). Not for large scale.
interface CachedTranslateResponse {
  at: number;
  resp: {
    success: true;
    data: {
      detectedLang: string;
      translatedText: string;
      sourceText: string;
      targetLang: string | null;
      changed: boolean;
      secondAttempt: boolean;
      cached: boolean;
    };
  };
}
const cache = new Map<string, CachedTranslateResponse>();
const CACHE_TTL_MS = 60_000; // 1 minute

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text, targetLang, force } =
      body || ({} as { text?: string; targetLang?: string; force?: boolean });
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing text" },
        { status: 400 }
      );
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const hasBengaliAssameseChars = /[\u0980-\u09FF]/.test(text);
    const hasDevanagariChars = /[\u0900-\u097F]/.test(text);

    const key = `${targetLang || "none"}::${text}`;
    const now = Date.now();
    const cached = !force ? cache.get(key) : undefined;
    if (cached && now - cached.at < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.resp,
        data: { ...cached.resp.data, cached: true },
      });
    }

    const sys = `You detect language and optionally translate. CRITICAL: Distinguish Assamese (code 'as') from Hindi (code 'hi'). Rules:\n- If the text uses Bengali/Assamese script (Unicode U+0980–U+09FF) and contains vocabulary typical of Assamese (e.g., 'আমি', 'আজি', 'নহয়', 'কেনে', 'আৰু'), treat as Assamese ('as') even if similar to Bengali.\n- Only return 'hi' if Devanagari script OR unmistakably Hindi lexicon in Latin transliteration.\nReturn strict JSON: {"detectedLang":"<code>","translated":"<translated or original>","changed":true|false}. If target language provided AND different from detectedLang, translate into that target using correct script.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const completionRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          temperature: 0,
          messages: [
            { role: "system", content: sys },
            {
              role: "user",
              content: `Text: ${text}\nTarget: ${targetLang || "none"}`,
            },
          ],
          response_format: { type: "json_object" },
          max_tokens: 300,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!completionRes.ok) {
      const errTxt = await completionRes.text();
      return NextResponse.json(
        { success: false, error: `OpenAI error: ${errTxt}` },
        { status: 502 }
      );
    }
    const completion = await completionRes.json();

    let detectedLang = "und";
    let translated = text;
    let changed = false;
    let secondAttempt = false;
    try {
      const raw = completion.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);
      if (parsed.detectedLang)
        detectedLang = String(parsed.detectedLang).slice(0, 8);
      if (parsed.translated) translated = String(parsed.translated);
      if (typeof parsed.changed === "boolean") changed = parsed.changed;
    } catch {}

    if (
      detectedLang === "hi" &&
      hasBengaliAssameseChars &&
      !hasDevanagariChars
    ) {
      detectedLang = "as";
    }

    const needsScriptFix =
      targetLang === "as" &&
      /[\u0900-\u097F]/.test(translated) &&
      !/[\u0980-\u09FF]/.test(translated);
    if (needsScriptFix) {
      secondAttempt = true;
      try {
        const fixSys = `You strictly translate to Assamese (code 'as') using Eastern Nagari script (Unicode U+0980–U+09FF). Do not use Devanagari. Respond JSON {"translated":"..."}.`;
        const fixController = new AbortController();
        const fixTimeout = setTimeout(() => fixController.abort(), 6000);
        const fixRes = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4.1",
              temperature: 0,
              messages: [
                { role: "system", content: fixSys },
                { role: "user", content: translated },
              ],
              response_format: { type: "json_object" },
              max_tokens: 250,
            }),
            signal: fixController.signal,
          }
        );
        clearTimeout(fixTimeout);
        if (!fixRes.ok) throw new Error("fix request failed");
        const fix = await fixRes.json();
        try {
          const raw2 = fix.choices?.[0]?.message?.content || "{}";
          const parsed2 = JSON.parse(raw2);
          if (
            parsed2.translated &&
            /[\u0980-\u09FF]/.test(parsed2.translated)
          ) {
            translated = String(parsed2.translated);
            changed = true;
          }
        } catch {}
      } catch {}
    }
    // Typed to satisfy CachedTranslateResponse expectation (success literal true)
    const responsePayload: CachedTranslateResponse["resp"] = {
      success: true,
      data: {
        detectedLang,
        translatedText: translated,
        sourceText: text,
        targetLang: targetLang || null,
        changed,
        secondAttempt,
        cached: false,
      },
    };
    cache.set(key, { at: now, resp: responsePayload });
    // Simple prune (keep size <= 200)
    if (cache.size > 200) {
      const oldestKey = [...cache.entries()].sort(
        (a, b) => a[1].at - b[1].at
      )[0]?.[0];
      if (oldestKey) cache.delete(oldestKey);
    }
    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
