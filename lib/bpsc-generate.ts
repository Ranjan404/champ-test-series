import { z } from "zod";
import {
  generatedQuestionSchema,
  shuffleOptions,
  topicLabel,
  type BpscQuestion,
  type GenerateRequest,
} from "./bpsc";

// Gemini REST call for BPSC TRE 4.0 question generation. Server-only: reads GEMINI_API_KEY,
// GEMINI_MODEL (primary, optional) and GEMINI_FALLBACK_MODEL (used after the primary keeps failing, optional).

/** Older Flash models are closed to new Google accounts; override with GEMINI_MODEL if needed. */
const DEFAULT_MODEL = "gemini-3.8-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** Cap for one Gemini call: 36 s for 10 questions up to 60 s for 25 (a 25-question Hindi set normally takes 20-40 s).
 * Under heavy load Gemini can hang instead of answering 503, so a call must not be allowed to eat the whole budget. */
const attemptTimeoutMs = (count: number) => 20_000 + count * 1_600;
/** No attempt (or backoff before one) starts unless at least this much of the budget is left. */
const MIN_ATTEMPT_MS = 15_000;
/** Retries per model after its first attempt, on temporary errors only and only while the budget allows. */
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 8_000;
/** Used when the caller passes no deadline. */
const DEFAULT_BUDGET_MS = 50_000;

export class GenerationError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: "config" | "rate_limited" | "timeout" | "upstream" | "blocked" | "invalid_output" | "cancelled",
    /** Seconds the client should wait before retrying, sent as Retry-After. */
    public retryAfter?: number,
  ) {
    super(message);
  }
}

const TOPIC_BRIEF: Record<GenerateRequest["topic"], string> = {
  history:
    "Bihar history: Magadh, Mauryas, Guptas, Pala dynasty, Nalanda/Vikramshila, Sher Shah Suri, medieval and colonial Bihar, " +
    "1857 (Kunwar Singh), Champaran Satyagraha, Quit India in Bihar, freedom fighters, separation of Bihar (1912) and Jharkhand (2000).",
  geography:
    "Bihar geography: physiographic divisions, rivers (Ganga, Kosi, Gandak, Son, Bagmati, Punpun, Falgu etc.) and their origins, " +
    "floods, soils, climate, forests and wildlife sanctuaries (Valmiki Tiger Reserve), minerals, agriculture, districts and divisions.",
  economy:
    "Bihar Budget and Bihar Economic Survey: GSDP growth, sectoral share, per-capita income, major schemes " +
    "(Saat Nischay, Jal-Jeevan-Hariyali, Jeevika, Kushal Yuva etc.), budget size and allocations, Census 2011 data " +
    "(population, density, sex ratio, literacy). Always name the fiscal year a figure belongs to.",
  current:
    "Current affairs relevant to BPSC TRE: Bihar government schemes and decisions, appointments, awards, sports, " +
    "infrastructure projects, plus important national and international events. Only use events you are certain about.",
  full:
    "A balanced full mock covering Bihar history and freedom struggle, geography and rivers, polity and administration, " +
    "art and culture (Madhubani, festivals, folk dances), economy, budget, Census 2011 facts, and current affairs.",
};

function systemPrompt() {
  return [
    "You are a senior question-paper setter for the Bihar Public Service Commission (BPSC) Teacher Recruitment Examination (TRE 4.0),",
    "General Knowledge / General Studies paper with a Bihar-special focus.",
    "Write exam-standard multiple-choice questions that match the style and difficulty of previous BPSC TRE papers.",
    "Rules:",
    "- Every question has exactly 4 options. Never add a 5th option.",
    "- Exactly one option is correct; correctIndex is its 0-based position (0 to 3).",
    "- Options must be distinct and plausible. Never use 'All of the above', 'None of the above' or their Hindi equivalents.",
    "- Only ask about facts that are verifiable from standard sources (NCERT, Bihar govt publications, Census 2011,",
    "  Bihar Economic Survey, Bihar Budget documents). If you are not sure of a fact, do not use it.",
    "- The explanation states why the correct answer is right with a supporting fact (date, figure, source) in 2-4 sentences.",
    "- subTopic is a short tag such as 'Maurya Empire', 'Kosi River', 'Census 2011', 'State Budget 2025-26'.",
    "- Mix difficulty roughly 30% easy, 50% medium, 20% hard. Do not repeat a concept within a set.",
    "- Mix question styles: direct facts, match-the-following, chronology, statement-based.",
  ].join("\n");
}

function userPrompt({ topic, count, language }: GenerateRequest) {
  const lang =
    language === "hi"
      ? "Write the question, all options, the explanation and subTopic in Hindi (Devanagari script), as in the official Hindi paper."
      : "Write the question, all options, the explanation and subTopic in English.";
  return [
    `Generate exactly ${count} questions.`,
    `Section: ${topicLabel(topic)}.`,
    `Coverage: ${TOPIC_BRIEF[topic]}`,
    lang,
    `Today's date is ${new Date().toISOString().slice(0, 10)}.`,
  ].join("\n");
}

// Gemini's OpenAPI-subset schema for structured output.
const responseSchema = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" }, minItems: 4, maxItems: 4 },
          correctIndex: { type: "INTEGER", minimum: 0, maximum: 3 },
          explanation: { type: "STRING" },
          subTopic: { type: "STRING" },
        },
        required: ["question", "options", "correctIndex", "explanation", "subTopic"],
        propertyOrdering: ["question", "options", "correctIndex", "explanation", "subTopic"],
      },
    },
  },
  required: ["questions"],
};

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; details?: { "@type"?: string; retryDelay?: string }[] };
}

type FailureCategory =
  | "timeout"
  | "network"
  | "overloaded"
  | "rate_limited"
  | "server_error"
  | "model_unavailable"
  | "rejected"
  | "auth"
  | "blocked"
  | "invalid_output"
  | "cancelled";

/** Temporary provider trouble: worth another try on the same model after a backoff. */
const RETRY_SAME_MODEL = new Set<FailureCategory>(["overloaded", "rate_limited", "server_error", "network"]);
/** Model-specific trouble: the fallback model may still work. Timeouts skip straight here; a model that is too slow
 * under load rarely speeds up within seconds, and a second 60 s wait would use up the request. */
const TRY_FALLBACK = new Set<FailureCategory>([...RETRY_SAME_MODEL, "timeout", "model_unavailable", "rejected"]);

class AttemptFailure extends Error {
  constructor(
    public category: FailureCategory,
    public status: number | null,
    /** Provider-suggested wait (Retry-After header or RetryInfo), in ms. */
    public retryAfterMs?: number,
    /** Set for failures that already have their user-facing error (blocked, invalid output). */
    public final?: GenerationError,
  ) {
    super(category);
  }
}

export interface GenerateOptions {
  /** Epoch ms by which generation must have finished, so the route can still answer before the platform cuts it off. */
  deadline?: number;
  /** Aborts in-flight calls and skips further attempts, e.g. when the client disconnects. */
  signal?: AbortSignal;
  /** Injected in tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

function categorize(status: number, message = ""): FailureCategory {
  if (status === 429) return "rate_limited";
  if (status === 503) return "overloaded";
  if (status === 500 || status === 502 || status === 504) return "server_error";
  if (status === 404) return "model_unavailable";
  if (status === 401 || status === 403 || (status === 400 && /api key/i.test(message))) return "auth";
  return "rejected";
}

function retryAfterMs(res: Response, body: GeminiResponse | null) {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  const delay = body?.error?.details?.find((d) => d["@type"]?.endsWith("RetryInfo"))?.retryDelay;
  const secs = delay ? parseFloat(delay) : NaN;
  return Number.isFinite(secs) && secs > 0 ? secs * 1000 : undefined;
}

/** Exponential backoff with equal jitter (half fixed, half random), never shorter than the provider asks for. */
function backoffMs(retry: number, random: () => number, providerMs = 0) {
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (retry - 1));
  return Math.max(providerMs, Math.round(exp / 2 + (random() * exp) / 2));
}

function log(fields: Record<string, unknown>) {
  const line = JSON.stringify({ event: "bpsc_generate", ...fields });
  if (fields.outcome === "success") console.info(line);
  else console.warn(line);
}

function generationConfigFor(model: string) {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema,
    temperature: 0.8,
    maxOutputTokens: 32_768,
  };
  // 2.5 Flash "thinks" by default, which can push a 25-question set past the time limit.
  if (/^gemini-2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  // Gemini 3 Flash models take a level instead of a budget; "low" is the lowest 3.8 Flash accepts.
  else if (/^gemini-3(\.\d+)?-flash/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: "low" };
  return generationConfig;
}

/** One Gemini call. Resolves with validated questions or throws an AttemptFailure. */
async function attemptGeneration(
  model: string,
  key: string,
  req: GenerateRequest,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<BpscQuestion[]> {
  let res: Response;
  let body: GeminiResponse | null;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: "user", parts: [{ text: userPrompt(req) }] }],
        generationConfig: generationConfigFor(model),
      }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    // Read the body under the same signal: a stalled stream must time out too.
    const raw = await res.text();
    try {
      body = JSON.parse(raw) as GeminiResponse;
    } catch {
      body = null;
    }
  } catch (e) {
    if (signal?.aborted) throw new AttemptFailure("cancelled", null);
    const name = (e as Error)?.name;
    throw new AttemptFailure(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network", null);
  }

  if (!res.ok) throw new AttemptFailure(categorize(res.status, body?.error?.message), res.status, retryAfterMs(res, body));

  const invalid = (err: GenerationError, category: FailureCategory = "invalid_output") =>
    new AttemptFailure(category, res.status, undefined, err);
  if (body?.promptFeedback?.blockReason) {
    throw invalid(new GenerationError("The generator declined this request. Try a different topic.", 502, "blocked"), "blocked");
  }
  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw invalid(new GenerationError("The generator returned an empty response. Try again.", 502, "invalid_output"));
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw invalid(new GenerationError("The generated test was cut off. Try fewer questions.", 502, "invalid_output"));
  }
  try {
    return parseQuestions(text, req.count);
  } catch (e) {
    if (e instanceof GenerationError) throw invalid(e);
    throw e;
  }
}

/** The user-facing error for the failure that ended generation. */
function toGenerationError(f: AttemptFailure | undefined): GenerationError {
  if (f?.final) return f.final;
  const retryAfter = f?.retryAfterMs ? Math.ceil(f.retryAfterMs / 1000) : undefined;
  switch (f?.category) {
    case "overloaded":
    case "server_error":
    case "network":
      return new GenerationError("The AI question generator is overloaded right now. Please try again in a minute.", 503, "upstream", retryAfter ?? 30);
    case "rate_limited":
      return new GenerationError("The AI question generator is busy (rate limit reached). Wait a minute and try again.", 429, "rate_limited", retryAfter ?? 60);
    case "model_unavailable":
    case "rejected":
      return new GenerationError("The question generator rejected the request. Contact support if this keeps happening.", 502, "upstream");
    case "auth":
      return new GenerationError("Question generation is not configured correctly (the Gemini API key was rejected).", 500, "config");
    case "cancelled":
      return new GenerationError("Generation was cancelled.", 499, "cancelled");
    default:
      // Timed out, or the budget ran out before an attempt could start.
      return new GenerationError("Generating the test took too long. Try fewer questions or try again.", 504, "timeout");
  }
}

/**
 * Generates and validates `req.count` questions. Each model gets up to MAX_RETRIES retries on temporary errors
 * (503, 429, other 5xx, network) with jittered exponential backoff; if it still fails, GEMINI_FALLBACK_MODEL is tried
 * under the same policy. Every call and wait fits inside `deadline`, so the caller always gets a result or a
 * GenerationError in time.
 */
export async function generateBpscQuestions(req: GenerateRequest, opts: GenerateOptions = {}): Promise<BpscQuestion[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GenerationError("Question generation is not configured (GEMINI_API_KEY is missing).", 500, "config");
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL?.trim();
  const models = fallback && fallback !== primary ? [primary, fallback] : [primary];

  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;
  const started = Date.now();
  const deadline = opts.deadline ?? started + DEFAULT_BUDGET_MS;
  const failures: AttemptFailure[] = [];
  let attempt = 0;

  for (const [i, model] of models.entries()) {
    for (let n = 1; n <= 1 + MAX_RETRIES; n++) {
      const prev = failures.at(-1);
      if (n > 1 && prev) {
        const wait = backoffMs(n - 1, random, prev.retryAfterMs);
        if (deadline - Date.now() - wait < MIN_ATTEMPT_MS) {
          log({ model, attempt: attempt + 1, elapsedMs: Date.now() - started, status: null, category: "budget_exhausted", outcome: "skipped" });
          break;
        }
        await sleep(wait);
      }
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) {
        log({ model, attempt: attempt + 1, elapsedMs: Date.now() - started, status: null, category: "budget_exhausted", outcome: "skipped" });
        break;
      }
      if (opts.signal?.aborted) throw toGenerationError(new AttemptFailure("cancelled", null));

      attempt++;
      const t0 = Date.now();
      try {
        const questions = await attemptGeneration(model, key, req, Math.min(attemptTimeoutMs(req.count), remaining), opts.signal);
        log({ model, attempt, elapsedMs: Date.now() - started, durationMs: Date.now() - t0, status: 200, category: null, outcome: "success" });
        return questions;
      } catch (e) {
        if (!(e instanceof AttemptFailure)) throw e;
        failures.push(e);
        const retry = n <= MAX_RETRIES && RETRY_SAME_MODEL.has(e.category);
        const next = retry ? "retry" : i < models.length - 1 && TRY_FALLBACK.has(e.category) ? "fallback" : "give_up";
        log({ model, attempt, elapsedMs: Date.now() - started, durationMs: Date.now() - t0, status: e.status, category: e.category, outcome: next });
        if (next !== "retry") break;
      }
    }
    const last = failures.at(-1);
    if (last && !TRY_FALLBACK.has(last.category)) break;
  }

  // Report the provider trouble rather than "fallback model unavailable" when the fallback could not even be used.
  const last = failures.at(-1);
  const cause =
    last && (last.category === "model_unavailable" || last.category === "rejected") && failures.length > 1
      ? failures.findLast((f) => f.category !== "model_unavailable" && f.category !== "rejected") ?? last
      : last;
  throw toGenerationError(cause);
}

/** Parses and validates model output; drops malformed questions and fails if fewer than `count` remain. */
export function parseQuestions(text: string, count: number): BpscQuestion[] {
  let raw: unknown;
  try {
    // JSON mode returns bare JSON, but strip a stray ```json fence just in case.
    raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new GenerationError("The generator returned malformed data. Try again.", 502, "invalid_output");
  }
  const list = z.object({ questions: z.array(z.unknown()) }).safeParse(raw);
  if (!list.success) throw new GenerationError("The generator returned malformed data. Try again.", 502, "invalid_output");

  const seen = new Set<string>();
  const valid: BpscQuestion[] = [];
  for (const item of list.data.questions) {
    const q = generatedQuestionSchema.safeParse(item);
    if (!q.success) continue;
    const key = q.data.question.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ id: `q${valid.length + 1}`, ...shuffleOptions(q.data) });
    if (valid.length === count) break;
  }
  if (valid.length < count) {
    throw new GenerationError(`Only ${valid.length} of ${count} generated questions passed validation. Try again.`, 502, "invalid_output");
  }
  return valid;
}
