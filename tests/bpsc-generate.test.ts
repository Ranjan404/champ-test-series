import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GenerationError, generateBpscQuestions } from "@/lib/bpsc-generate";

const KEY = "test-secret-key-123";
const req = { topic: "full", count: 10, language: "hi" } as const;

const hindiQuestions = (n: number) => ({
  questions: Array.from({ length: n }, (_, i) => ({
    question: `बिहार प्रश्न संख्या ${i + 1} क्या है?`,
    options: ["गंगा", "कोसी", "गंडक", "सोन"],
    correctIndex: 1,
    explanation: "कोसी को बिहार का शोक कहा जाता है।",
    subTopic: "कोसी नदी",
  })),
});

const ok = (payload: unknown = hindiQuestions(10)) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: "STOP" }] }), {
    status: 200,
  });
const fail = (status: number, message = "This model is currently experiencing high demand.", headers?: HeadersInit) =>
  new Response(JSON.stringify({ error: { code: status, message, status: "UNAVAILABLE" } }), { status, headers });

let fetchMock: ReturnType<typeof vi.fn>;
const sleep = vi.fn(async (_ms: number) => {});
const models = () => fetchMock.mock.calls.map(([url]) => String(url).match(/models\/([^:]+):/)![1]);
const run = (opts = {}) => generateBpscQuestions(req, { sleep, random: () => 0.5, deadline: Date.now() + 105_000, ...opts });
const caught = (p: Promise<unknown>) => p.then(() => null, (e) => e as GenerationError);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("GEMINI_API_KEY", KEY);
  vi.stubEnv("GEMINI_MODEL", "");
  vi.stubEnv("GEMINI_FALLBACK_MODEL", "");
  sleep.mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("generateBpscQuestions", () => {
  it("returns exactly `count` validated Hindi questions from one call", async () => {
    fetchMock.mockResolvedValueOnce(ok(hindiQuestions(12)));
    const qs = await run();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(models()).toEqual(["gemini-3.8-flash"]);
    expect(qs).toHaveLength(10);
    expect(qs.map((q) => q.id)).toEqual(Array.from({ length: 10 }, (_, i) => `q${i + 1}`));
    qs.forEach((q) => {
      expect(q.options).toHaveLength(4);
      expect(q.options[q.correctIndex]).toBe("कोसी");
      expect(q.explanation).toMatch(/[ऀ-ॿ]/);
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.generationConfig).toMatchObject({ responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "low" } });
    expect(body.contents[0].parts[0].text).toContain("Hindi (Devanagari script)");
    expect(body.contents[0].parts[0].text).toContain("exactly 10 questions");
  });

  it("retries a temporary 503 with jittered exponential backoff, then succeeds", async () => {
    fetchMock.mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok());
    const qs = await run();
    expect(qs).toHaveLength(10);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Equal jitter with random() = 0.5: 3/4 of 2 s, then of 4 s.
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1500, 3000]);
  });

  it("gives up after two retries with a 503 and Retry-After when no fallback is configured", async () => {
    fetchMock.mockImplementation(async () => fail(503));
    const err = await caught(run());
    expect(err).toBeInstanceOf(GenerationError);
    expect(err).toMatchObject({ status: 503, code: "upstream", retryAfter: 30 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls back to GEMINI_FALLBACK_MODEL once the primary keeps failing", async () => {
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-3.6-flash");
    fetchMock.mockImplementation(async (url: string) => (url.includes("gemini-3.6-flash") ? ok() : fail(503)));
    const qs = await run();
    expect(qs).toHaveLength(10);
    expect(models()).toEqual(["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.6-flash"]);
  });

  it("stops after two retries of each model when both stay overloaded", async () => {
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-3.6-flash");
    fetchMock.mockImplementation(async () => fail(503));
    expect(await caught(run())).toMatchObject({ status: 503, code: "upstream" });
    expect(models()).toEqual([...Array(3).fill("gemini-3.8-flash"), ...Array(3).fill("gemini-3.6-flash")]);
    expect(sleep).toHaveBeenCalledTimes(4);
  });

  it("reports the primary outage, not a 404, when the fallback model is unavailable", async () => {
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash");
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("gemini-2.5-flash") ? fail(404, "This model is no longer available to new users.") : fail(503),
    );
    const err = await caught(run());
    expect(err).toMatchObject({ status: 503, code: "upstream" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("moves to the fallback after a timeout instead of retrying the slow model", async () => {
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-3.6-flash");
    fetchMock
      .mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"))
      .mockResolvedValueOnce(ok());
    expect(await run()).toHaveLength(10);
    expect(models()).toEqual(["gemini-3.8-flash", "gemini-3.6-flash"]);
  });

  it("rejects invalid AI output without retrying or returning a partial test", async () => {
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-3.6-flash");
    const short = hindiQuestions(9);
    short.questions.push({ ...short.questions[0], question: "नया प्रश्न?", options: ["क", "क", "ख", "ग"] });
    fetchMock.mockResolvedValueOnce(ok(short));
    const err = await caught(run());
    expect(err).toMatchObject({ status: 502, code: "invalid_output" });
    expect(err!.message).toContain("Only 9 of 10");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects output that is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Sorry, I cannot" }] } }] }), { status: 200 }),
    );
    expect(await caught(run())).toMatchObject({ code: "invalid_output" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never waits or calls past the deadline", async () => {
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-3.6-flash");
    fetchMock.mockImplementation(async () => fail(503));
    // 16 s left: room for one attempt, not for a backoff plus another 15 s attempt.
    const err = await caught(run({ deadline: Date.now() + 16_000 }));
    expect(err).toMatchObject({ status: 503 });
    expect(sleep).not.toHaveBeenCalled();
    expect(models()).toEqual(["gemini-3.8-flash", "gemini-3.6-flash"]);
  });

  it("skips a retry whose provider Retry-After does not fit the budget", async () => {
    fetchMock.mockResolvedValueOnce(fail(429, "Quota exceeded", { "Retry-After": "120" }));
    const err = await caught(run());
    expect(err).toMatchObject({ status: 429, code: "rate_limited", retryAfter: 120 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("does not retry or fall back when the API key is rejected", async () => {
    vi.stubEnv("GEMINI_FALLBACK_MODEL", "gemini-3.6-flash");
    fetchMock.mockResolvedValueOnce(fail(403, "Permission denied"));
    expect(await caught(run())).toMatchObject({ status: 500, code: "config" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logs model, attempt, elapsed time, status and category without the API key", async () => {
    fetchMock.mockResolvedValueOnce(fail(503)).mockResolvedValueOnce(ok());
    await run();
    const lines = [...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.info).mock.calls].map(([l]) => String(l));
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({ model: "gemini-3.8-flash", attempt: 1, status: 503, category: "overloaded", outcome: "retry" });
    expect(JSON.parse(lines[1])).toMatchObject({ attempt: 2, status: 200, outcome: "success", elapsedMs: expect.any(Number) });
    lines.forEach((l) => expect(l).not.toContain(KEY));
  });
});
