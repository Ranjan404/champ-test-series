import { z } from "zod";
import {
  generatedQuestionSchema,
  shuffleOptions,
  topicLabel,
  type BpscQuestion,
  type GenerateRequest,
} from "./bpsc";

// Gemini REST call for BPSC TRE 4.0 question generation. Server-only: reads GEMINI_API_KEY.

/** Older Flash models are closed to new Google accounts; override with GEMINI_MODEL if needed. */
const DEFAULT_MODEL = "gemini-3.8-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** Leaves headroom under the route's 60 s maxDuration to answer with a proper JSON error. */
const TIMEOUT_MS = 52_000;

export class GenerationError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: "config" | "rate_limited" | "timeout" | "upstream" | "blocked" | "invalid_output",
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
  error?: { message?: string; status?: string };
}

export async function generateBpscQuestions(req: GenerateRequest): Promise<BpscQuestion[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GenerationError("Question generation is not configured (GEMINI_API_KEY is missing).", 500, "config");
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: "user", parts: [{ text: userPrompt(req) }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new GenerationError("Generating the test took too long. Try fewer questions or try again.", 504, "timeout");
    }
    throw new GenerationError("Could not reach the question generator. Check your connection and try again.", 502, "upstream");
  }

  const body = (await res.json().catch(() => null)) as GeminiResponse | null;
  if (!res.ok) {
    console.error(`Gemini ${model} ${res.status}:`, body?.error?.message);
    if (res.status === 429) {
      throw new GenerationError("The AI question generator is busy (rate limit reached). Wait a minute and try again.", 429, "rate_limited");
    }
    if (res.status === 503 || res.status === 500) {
      throw new GenerationError("The AI question generator is temporarily unavailable. Try again shortly.", 503, "upstream");
    }
    if (res.status === 504) throw new GenerationError("Generating the test took too long. Try again.", 504, "timeout");
    throw new GenerationError("The question generator rejected the request. Contact support if this keeps happening.", 502, "upstream");
  }

  if (body?.promptFeedback?.blockReason) {
    throw new GenerationError("The generator declined this request. Try a different topic.", 502, "blocked");
  }
  const candidate = body?.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new GenerationError("The generator returned an empty response. Try again.", 502, "invalid_output");
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new GenerationError("The generated test was cut off. Try fewer questions.", 502, "invalid_output");
  }

  return parseQuestions(text, req.count);
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
