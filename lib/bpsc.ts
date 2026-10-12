import { z } from "zod";
import { netScore, round2 } from "./scoring";

// BPSC TRE 4.0 (Bihar Special GK/GS & Current Affairs): AI-generated practice tests.
// Client-safe: types, topic list, request/response validation and scoring. The Gemini call lives in bpsc-generate.ts.

export const BPSC_TOPICS = [
  { id: "history", label: "Bihar History & Freedom Struggle", hi: "बिहार का इतिहास एवं स्वतंत्रता संग्राम" },
  { id: "geography", label: "Bihar Geography & Rivers", hi: "बिहार का भूगोल एवं नदियाँ" },
  { id: "economy", label: "Bihar Budget & Economic Survey", hi: "बिहार बजट एवं आर्थिक सर्वेक्षण" },
  { id: "current", label: "Current Affairs", hi: "समसामयिकी" },
  { id: "full", label: "Full Mock", hi: "फुल मॉक टेस्ट" },
] as const;

export type BpscTopicId = (typeof BPSC_TOPICS)[number]["id"];
export const BPSC_COUNTS = [10, 15, 25] as const;
export type BpscCount = (typeof BPSC_COUNTS)[number];
export type BpscLanguage = "hi" | "en";

/** One minute per question. */
export const SECONDS_PER_QUESTION = 60;
/** Shown as -0.33; scored as exactly -1/3 like the rest of Champ Test Series. */
export const WRONG_MARK_LABEL = "-0.33";

/** Answer index of the fixed fifth option "E", shown under every question. Choosing it scores 0. */
export const OPT_OUT_INDEX = 4;
export const OPT_OUT_LABEL: Record<BpscLanguage, string> = {
  hi: "प्रश्न का उत्तर नहीं देना चाहते",
  en: "I do not wish to answer this question",
};

export const topicLabel = (id: BpscTopicId) => BPSC_TOPICS.find((t) => t.id === id)!.label;

export interface BpscQuestion {
  id: string;
  question: string;
  options: string[]; // exactly 4 items
  correctIndex: number; // 0 to 3
  explanation: string;
  subTopic: string;
}

export interface BpscTest {
  topic: BpscTopicId;
  language: BpscLanguage;
  generatedAt: string;
  questions: BpscQuestion[];
}

export const generateRequestSchema = z.object({
  topic: z.enum(BPSC_TOPICS.map((t) => t.id) as [BpscTopicId, ...BpscTopicId[]]),
  count: z.union([z.literal(10), z.literal(15), z.literal(25)]),
  language: z.enum(["hi", "en"]).default("hi"),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/** What the model must return per question (ids are assigned by the server). */
export const generatedQuestionSchema = z
  .object({
    question: z.string().trim().min(5),
    options: z.array(z.string().trim().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(5),
    subTopic: z.string().trim().min(2),
  })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === 4, "Options must be distinct.");
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

/** Selected option index per question (OPT_OUT_INDEX for option E), null when unattempted. */
export type BpscAnswers = (number | null)[];

export interface SubTopicStat {
  subTopic: string;
  total: number;
  correct: number;
  wrong: number;
  /** correct / total, in percent */
  accuracy: number;
}

export interface BpscResult {
  total: number;
  correct: number;
  wrong: number;
  /** Chose option E: neither right nor wrong, scores 0. */
  optedOut: number;
  unattempted: number;
  net: number;
  /** net / total, in percent (can be negative) */
  percentage: number;
  /** correct / attempted, in percent */
  accuracy: number;
  subTopics: SubTopicStat[];
  /** Sub-topics under 50% with at least one miss, weakest first. */
  weak: SubTopicStat[];
}

const pct = (n: number, d: number) => (d ? round2((n / d) * 100) : 0);

export function scoreBpscTest(questions: BpscQuestion[], answers: BpscAnswers): BpscResult {
  let correct = 0;
  let wrong = 0;
  let optedOut = 0;
  const bySub = new Map<string, SubTopicStat>();
  questions.forEach((q, i) => {
    const a = answers[i] ?? null;
    const s = bySub.get(q.subTopic) ?? { subTopic: q.subTopic, total: 0, correct: 0, wrong: 0, accuracy: 0 };
    s.total++;
    if (a === q.correctIndex) {
      correct++;
      s.correct++;
    } else if (a === OPT_OUT_INDEX) {
      optedOut++;
    } else if (a !== null) {
      wrong++;
      s.wrong++;
    }
    bySub.set(q.subTopic, s);
  });
  const subTopics = [...bySub.values()].map((s) => ({ ...s, accuracy: pct(s.correct, s.total) }));
  const weak = subTopics
    .filter((s) => s.accuracy < 50 && s.correct < s.total)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
  const net = netScore(correct, wrong);
  return {
    total: questions.length,
    correct,
    wrong,
    optedOut,
    unattempted: questions.length - correct - wrong - optedOut,
    net,
    percentage: pct(net, questions.length),
    accuracy: pct(correct, correct + wrong),
    subTopics: subTopics.sort((a, b) => b.total - a.total),
    weak,
  };
}

/** Fisher-Yates shuffle of the options, keeping correctIndex pointing at the same text. Models favour A/B otherwise. */
export function shuffleOptions<T extends { options: string[]; correctIndex: number }>(q: T, rand = Math.random): T {
  const order = [0, 1, 2, 3];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { ...q, options: order.map((i) => q.options[i]), correctIndex: order.indexOf(q.correctIndex) };
}

export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
