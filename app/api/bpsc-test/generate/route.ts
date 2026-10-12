import { authed, json } from "@/lib/api";
import { generateRequestSchema, type BpscTest } from "@/lib/bpsc";
import { generateBpscQuestions, GenerationError } from "@/lib/bpsc-generate";

// Generation of a 25-question Hindi set can take 20-40 s; Vercel's default would cut it off.
export const maxDuration = 300;

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 6;
// Per server instance; good enough to stop one user burning the Gemini quota by mashing the button.
const recent = new Map<string, number[]>();

function rateLimited(userId: string) {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(userId, hits);
    return Math.ceil((hits[0] + WINDOW_MS - now) / 1000);
  }
  hits.push(now);
  recent.set(userId, hits);
  return 0;
}

const error = (
  message: string,
  code: string,
  status: number,
  headers?: HeadersInit,
) => {
  const res = json({ error: message, code }, status);
  if (headers) new Headers(headers).forEach((v, k) => res.headers.set(k, v));
  return res;
};

export const POST = authed(async (req, user) => {
  const parsed = generateRequestSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return error(
      "Choose a topic, a question count of 10, 15 or 25, and a language.",
      "bad_request",
      400,
    );

  const retryAfter = rateLimited(user.id);
  if (retryAfter) {
    return error(
      `You have generated ${MAX_PER_WINDOW} tests in the last 10 minutes. Try again in ${Math.ceil(retryAfter / 60)} min.`,
      "rate_limited",
      429,
      {
        "Retry-After": String(retryAfter),
      },
    );
  }

  try {
    const questions = await generateBpscQuestions(parsed.data);
    const test: BpscTest = {
      topic: parsed.data.topic,
      language: parsed.data.language,
      generatedAt: new Date().toISOString(),
      questions,
    };
    return json(test);
  } catch (e) {
    if (e instanceof GenerationError) return error(e.message, e.code, e.status);
    throw e;
  }
});
