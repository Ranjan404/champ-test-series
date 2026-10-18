import crypto from "node:crypto";
import { z } from "zod";
import { cached, type Cached } from "./cache";
import { cleanText, fetchJson, SourceError } from "./http";
import { QUIZ_CATEGORIES, type GkQuestion, type QuizCategoryId, type SourceInfo } from "./types";

// Open Trivia Database (https://opentdb.com): free, no key, CC BY-SA 4.0, English only, general/world trivia
// (not India-specific exam questions). Documented limit: one request per IP every 5 seconds.
// We fetch a pool of 50 questions per category, keep it in memory for 30 minutes and hand out random samples,
// so clicking "new quiz" does not call OpenTDB again.

export const OPENTDB_SOURCE: SourceInfo = {
  name: "Open Trivia Database",
  url: "https://opentdb.com",
  license: "CC BY-SA 4.0",
};

const POOL_SIZE = 50;
const POOL_TTL_MS = 30 * 60_000;
const POOL_MAX_STALE_MS = 24 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;
/** OpenTDB allows one request per IP per 5 s; keep a margin. */
const MIN_GAP_MS = 5_500;
/** Never keep a visitor waiting in the queue longer than this; answer "busy" instead. */
const MAX_QUEUE_WAIT_MS = 12_000;

const resultSchema = z.object({
  type: z.string(),
  difficulty: z.string(),
  category: z.string(),
  question: z.string(),
  correct_answer: z.string(),
  incorrect_answers: z.array(z.string()),
});
const responseSchema = z.object({ response_code: z.number().int(), results: z.array(z.unknown()) });

// Each OpenTDB call reserves the next free slot, MIN_GAP_MS apart (per server process). OpenTDB appears to count the
// gap from the end of the previous request, so the next slot is pushed back again when a call finishes.
let nextSlot = 0;
async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  if (slot - now > MAX_QUEUE_WAIT_MS) {
    throw new SourceError("rate_limited", "Open Trivia Database is busy. Try again in a few seconds.", Math.ceil((slot - now) / 1000));
  }
  nextSlot = slot + MIN_GAP_MS;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
  try {
    return await fn();
  } finally {
    nextSlot = Math.max(nextSlot, Date.now() + MIN_GAP_MS);
  }
}

/** Tests only. */
export function resetOpenTdbThrottle() {
  nextSlot = 0;
}

const decode = (s: string) => {
  try {
    return cleanText(decodeURIComponent(s));
  } catch {
    return null;
  }
};

const questionId = (text: string) => "otdb-" + crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);

export type PoolQuestion = Omit<GkQuestion, "options" | "correctIndex"> & { correct: string; incorrect: string[] };

/**
 * Validates and normalises an OpenTDB response body (fetched with encode=url3986).
 * Drops any question whose answer data is missing, undecodable or ambiguous (duplicate options).
 */
export function normalizeOpenTdb(body: unknown): PoolQuestion[] {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new SourceError("invalid", "Open Trivia Database returned an unexpected response.");
  const { response_code: code, results } = parsed.data;
  if (code === 5) throw new SourceError("rate_limited", "Open Trivia Database is rate limiting requests.", 6);
  if (code === 1) throw new SourceError("empty", "Open Trivia Database has no questions for this category right now.");
  if (code !== 0) throw new SourceError("invalid", `Open Trivia Database rejected the request (code ${code}).`);

  const out: PoolQuestion[] = [];
  const seen = new Set<string>();
  for (const raw of results) {
    const r = resultSchema.safeParse(raw);
    if (!r.success || decode(r.data.type) !== "multiple") continue;
    const question = decode(r.data.question);
    const correct = decode(r.data.correct_answer);
    const incorrect = r.data.incorrect_answers.map(decode);
    if (!question || question.length < 5 || !correct || incorrect.length !== 3 || incorrect.some((o) => !o)) continue;
    const all = [correct, ...(incorrect as string[])];
    if (new Set(all.map((o) => o.toLowerCase())).size !== 4) continue;
    if (seen.has(question.toLowerCase())) continue;
    seen.add(question.toLowerCase());
    const difficulty = decode(r.data.difficulty);
    out.push({
      id: questionId(question),
      question,
      correct,
      incorrect: incorrect as string[],
      explanation: null,
      category: decode(r.data.category) ?? "General Knowledge",
      difficulty: difficulty === "easy" || difficulty === "medium" || difficulty === "hard" ? difficulty : null,
      lang: "en",
    });
  }
  if (!out.length) throw new SourceError("empty", "Open Trivia Database returned no usable questions.");
  return out;
}

/** Shuffles the four options (OpenTDB lists the correct answer separately, so any order is valid). */
export function toQuizQuestion(q: PoolQuestion, rand = Math.random): GkQuestion {
  const options = [q.correct, ...q.incorrect];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const { correct, incorrect: _incorrect, ...rest } = q;
  return { ...rest, options, correctIndex: options.indexOf(correct) };
}

export function sample<T>(items: T[], n: number, rand = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

async function fetchPool(category: QuizCategoryId): Promise<PoolQuestion[]> {
  const otdb = QUIZ_CATEGORIES.find((c) => c.id === category)!.otdb;
  const url = `https://opentdb.com/api.php?amount=${POOL_SIZE}&category=${otdb}&type=multiple&encode=url3986`;
  const once = () => throttled(async () => normalizeOpenTdb(await fetchJson(url, { timeoutMs: REQUEST_TIMEOUT_MS })));
  try {
    return await once();
  } catch (e) {
    // Another visitor's request (or another server on the same IP) may have used the slot: wait one gap and retry once.
    if (e instanceof SourceError && e.kind === "rate_limited") return once();
    throw e;
  }
}

export async function getOpenTdbQuestions(category: QuizCategoryId, amount: number): Promise<Cached<GkQuestion[]>> {
  const pool = await cached(`otdb:${category}`, { ttlMs: POOL_TTL_MS, maxStaleMs: POOL_MAX_STALE_MS, failureCooldownMs: 15_000 }, () =>
    fetchPool(category),
  );
  return { ...pool, value: sample(pool.value, amount).map((q) => toQuizQuestion(q)) };
}
