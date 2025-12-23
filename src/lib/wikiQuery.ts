export type WikiQuerySentiment = "playful" | "neutral" | "serious" | "academic";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "by",
  "from",
  "at",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "into",
  "over",
  "under",
  "between",
  "about",
  "your",
  "you",
  "we",
  "they",
  "i",
]);

const SENTIMENT_HINTS: Record<WikiQuerySentiment, string[]> = {
  playful: ["illustration", "poster", "cartoon"],
  neutral: ["photo", "diagram"],
  serious: ["diagram", "technical"],
  academic: ["diagram", "schematic", "historical"],
};

// Words that pollute search queries in our course content.
const NOISY_WORDS = new Set([
  "chapter",
  "module",
  "lesson",
  "dawn",
  "overview",
  "introduction",
  "learning",
  "objectives",
  "objective",
  "summary",
  "explanation",
  "read",
  "podcast",
  "wikimedia",
  "commons",
  "section",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`*_>#\[\]().,;:!?"']/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3)
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => !NOISY_WORDS.has(t));
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function guessSentiment(userPrompt?: string): WikiQuerySentiment {
  const s = (userPrompt ?? "").toLowerCase();
  if (!s) return "neutral";

  // very light heuristic; avoids bringing in heavy NLP deps.
  if (/(phd|thesis|research|academic|rigorous|formal)/.test(s))
    return "academic";
  if (/(serious|professional|strict|no fluff)/.test(s)) return "serious";
  if (/(fun|playful|cool|awesome|lol|meme)/.test(s)) return "playful";
  return "neutral";
}

function normalizeQueryTerm(term: string): string {
  return term
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickCompactQueryFromTokens(tokens: string[]): string {
  const t = tokens.filter(Boolean);
  if (t.length === 0) return "";
  // Return a 2-token phrase if possible, else 1 token.
  // Wikimedia search usually performs better with short noun phrases.
  return t.slice(0, Math.min(2, t.length)).join(" ");
}

export function buildWikiImageQuery(args: {
  userPrompt?: string;
  sectionTitle?: string;
  sectionImageSearchQuery?: string;
  sectionExplanation?: string;
}): string {
  const {
    userPrompt,
    sectionTitle,
    sectionImageSearchQuery,
    sectionExplanation,
  } = args;

  // Goal: keep Wikimedia search term SHORT (1–2 tokens/phrase max).
  // Long queries often fail to match Commons file titles.

  // 1) Prefer the AI-provided query if present, but sanitize/shorten it.
  const seed = normalizeQueryTerm(sectionImageSearchQuery ?? "");
  if (seed) {
    const seedTokens = tokenize(seed);

    // Try to preserve common compact phrases like "fifth generation".
    // If both "fifth" and "generation" exist, keep them together.
    if (seedTokens.includes("fifth") && seedTokens.includes("generation")) {
      return "fifth generation";
    }

    const compact = pickCompactQueryFromTokens(seedTokens);
    if (compact) return compact;
  }

  // 2) Fall back to section title keywords.
  const titleTokens = tokenize(sectionTitle ?? "");
  const compactTitle = pickCompactQueryFromTokens(titleTokens);
  if (compactTitle) return compactTitle;

  // 3) Last resort: pull first keywords from explanation.
  const explTokens = tokenize(sectionExplanation ?? "").slice(0, 60);
  const compactExpl = pickCompactQueryFromTokens(unique(explTokens));
  if (compactExpl) return compactExpl;

  // 4) If we have a user prompt sentiment, add a single hint as a final fallback.
  // (Still keep it short.)
  const sentiment = guessSentiment(userPrompt);
  const hint = SENTIMENT_HINTS[sentiment]?.[0];
  return hint ?? "";
}

export function buildWikiImageQueryCandidates(args: {
  userPrompt?: string;
  sectionTitle?: string;
  sectionImageSearchQuery?: string;
  sectionExplanation?: string;
  maxCandidates?: number;
}): string[] {
  const {
    userPrompt,
    sectionTitle,
    sectionImageSearchQuery,
    sectionExplanation,
    maxCandidates = 6,
  } = args;

  const candidates: string[] = [];
  const add = (q: string | undefined) => {
    const normalized = normalizeQueryTerm(q ?? "");
    if (!normalized) return;
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };

  // 1) Primary: the (sanitized) AI-provided seed -> keep to 1–2 tokens.
  const seed = normalizeQueryTerm(sectionImageSearchQuery ?? "");
  if (seed) {
    const seedTokens = tokenize(seed);
    if (seedTokens.includes("fifth") && seedTokens.includes("generation"))
      add("fifth generation");
    add(pickCompactQueryFromTokens(seedTokens));
    // Sometimes 1 token works better than 2.
    add(seedTokens[0]);
  }

  // 2) Section title variants.
  const titleTokens = tokenize(sectionTitle ?? "");
  add(pickCompactQueryFromTokens(titleTokens));
  add(titleTokens[0]);

  // 3) Explanation keyword variants.
  const explTokens = unique(tokenize(sectionExplanation ?? "")).slice(0, 20);
  add(pickCompactQueryFromTokens(explTokens));
  add(explTokens[0]);

  // 4) Last resort sentiment hint.
  const sentiment = guessSentiment(userPrompt);
  add(SENTIMENT_HINTS[sentiment]?.[0]);

  return candidates.filter(Boolean).slice(0, maxCandidates);
}
