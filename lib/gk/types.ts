// Client-safe types and constants for the GK/GS section. The server modules normalise every source into these shapes.

export type GkLang = "en" | "hi";
export const GK_LANGS: readonly GkLang[] = ["en", "hi"];

export interface SourceInfo {
  name: string;
  url: string;
  /** Licence or reuse terms, shown next to the content. */
  license: string;
}

/** A multiple-choice question with a verified answer key from its source. */
export interface GkQuestion {
  id: string;
  question: string;
  /** Shuffled once on the server; correctIndex always points at the source's correct answer. */
  options: string[];
  correctIndex: number;
  /** Only when the source supplies one. OpenTDB never does, so this is null for its questions. */
  explanation: string | null;
  category: string;
  difficulty: "easy" | "medium" | "hard" | null;
  /** Language the question text is actually written in. */
  lang: GkLang;
}

export const QUIZ_CATEGORIES = [
  { id: "general", otdb: 9, en: "General Knowledge", hi: "सामान्य ज्ञान" },
  { id: "history", otdb: 23, en: "History", hi: "इतिहास" },
  { id: "geography", otdb: 22, en: "Geography", hi: "भूगोल" },
  { id: "science", otdb: 17, en: "Science & Nature", hi: "विज्ञान एवं प्रकृति" },
  { id: "politics", otdb: 24, en: "Politics", hi: "राजनीति" },
] as const;
export type QuizCategoryId = (typeof QUIZ_CATEGORIES)[number]["id"];
export const QUIZ_AMOUNTS = [5, 10, 15] as const;

export interface QuestionsResponse {
  questions: GkQuestion[];
  category: QuizCategoryId;
  source: SourceInfo;
  fetchedAt: string;
  stale: boolean;
}

export type NewsRegion = "india" | "bihar";

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  /** ISO date-time from the source, or null when the source did not give one. */
  publishedAt: string | null;
  summary: string | null;
  /** Issuing ministry/department as printed by the source; null when it could not be read reliably. */
  category: string | null;
  sourceName: string;
  lang: GkLang;
}

export interface NewsResponse {
  region: NewsRegion;
  lang: GkLang;
  items: NewsItem[];
  source: SourceInfo;
  fetchedAt: string;
  stale: boolean;
  /** Publication date of the newest dated item, to warn when a feed has gone quiet. */
  newestAt: string | null;
}

export type NotesSection = "india" | "bihar";

export interface StudyNote {
  /** English Wikipedia title, used as the stable key. */
  key: string;
  group: string;
  /** "ok": extract in the requested language; "no-article": no article in that language (link to English instead). */
  status: "ok" | "no-article" | "missing";
  title: string;
  extract: string | null;
  url: string;
  /** Present for "no-article": the English article to read instead. */
  englishUrl?: string;
  lang: GkLang;
}

export interface NotesResponse {
  section: NotesSection;
  lang: GkLang;
  notes: StudyNote[];
  source: SourceInfo;
  fetchedAt: string;
  stale: boolean;
}

/** Error body of every GK/GS API route. */
export interface GkApiError {
  error: string;
  code: "bad_request" | "timeout" | "network" | "http" | "rate_limited" | "invalid" | "empty";
}
