import { describe, expect, it } from "vitest";
import {
  attemptDeadline,
  buildDailyState,
  dailySetFor,
  DAILY_START_DATE,
  finalizeIfExpired,
  istDateKey,
  nextResetAt,
  saveDaily,
  startDaily,
  submitDaily,
  SUBMIT_GRACE_MS,
} from "@/lib/daily";
import { ProgressError } from "@/lib/progress";
import { emptyProgress } from "@/lib/store";
import { DAILY_DURATION_SECONDS, type Question, type QuestionSet } from "@/lib/types";

const set = (setId: number): QuestionSet => ({
  setId,
  title: `Daily Set ${setId}`,
  questions: Array.from({ length: 25 }, (_, i): Question => ({
    id: `D${String(setId).padStart(2, "0")}-Q${String(i + 1).padStart(2, "0")}`,
    type: "single",
    difficulty: "Medium",
    topic: "Computer Networks",
    subtopic: "Sub",
    concept: `Concept ${i}`,
    source: "Generated",
    sourceRef: "STET_NOTES#p1",
    question: `Question ${i}?`,
    options: { A: "a", B: "b", C: "c", D: "d", E: "Not Attempted" },
    correct: ["B"],
    explanation: "Because.",
    distractorMistakeType: { A: "Conceptual", C: "Conceptual", D: "Conceptual" },
  })),
});

const T0 = Date.parse("2026-10-13T10:00:00+05:30");
const MIN = 60_000;

describe("daily rotation", () => {
  it("uses the India date, not UTC", () => {
    expect(istDateKey(new Date("2026-10-13T18:29:00Z"))).toBe("2026-10-13");
    expect(istDateKey(new Date("2026-10-13T18:31:00Z"))).toBe("2026-10-14");
  });
  it("starts at set 1 and cycles through every set", () => {
    expect(dailySetFor(DAILY_START_DATE, 40)).toBe(1);
    expect(dailySetFor("2026-10-14", 40)).toBe(2);
    expect(dailySetFor("2026-11-21", 40)).toBe(40);
    expect(dailySetFor("2026-11-22", 40)).toBe(1);
    expect(dailySetFor("2026-10-12", 40)).toBe(40);
    expect(dailySetFor("2026-10-13", 0)).toBeNull();
  });
  it("resets at midnight IST", () => {
    expect(new Date(nextResetAt(new Date(T0))).toISOString()).toBe("2026-10-13T18:30:00.000Z");
  });
});

describe("daily attempts", () => {
  it("resumes the running attempt instead of starting a new one", () => {
    const p = emptyProgress();
    const a = startDaily(p, set(1), "2026-10-13", T0);
    expect(a.attemptNo).toBe(1);
    expect(startDaily(p, set(1), "2026-10-13", T0 + 5 * MIN)).toBe(a);
  });

  it("saves answers, ignores unknown ids, and scores +1 / -1/3 / 0 on submit", () => {
    const p = emptyProgress();
    const s = set(1);
    startDaily(p, s, "2026-10-13", T0);
    saveDaily(p, s, { answers: { "D01-Q01": "B", "D01-Q02": "A", "D99-Q01": "B" }, marked: ["D01-Q03"], current: 2 }, T0 + MIN);
    expect(p.daily!.attempt!.answers).toEqual({ "D01-Q01": "B", "D01-Q02": "A" });
    expect(p.daily!.attempt!.current).toBe(2);

    const e = submitDaily(p, s, { "D01-Q01": "B", "D01-Q02": "B", "D01-Q03": "C", "D01-Q04": "E" }, T0 + 10 * MIN);
    expect(e).toMatchObject({ correct: 2, incorrect: 1, notAttempted: 22, score: 1.67, timedOut: false, attemptNo: 1 });
    expect(p.daily!.attempt).toBeNull();
  });

  it("allows unlimited attempts on the same day, numbered in order", () => {
    const p = emptyProgress();
    const s = set(1);
    for (let n = 1; n <= 3; n++) {
      expect(startDaily(p, s, "2026-10-13", T0 + n * 30 * MIN).attemptNo).toBe(n);
      submitDaily(p, s, {}, T0 + n * 30 * MIN + MIN);
    }
    expect(p.daily!.history).toHaveLength(3);
    // A new day restarts the count at that day's set.
    expect(startDaily(p, set(2), "2026-10-14", T0 + DAILY_DURATION_SECONDS * 1000 * 100).attemptNo).toBe(1);
  });

  it("enforces the 25-minute limit on the server", () => {
    const p = emptyProgress();
    const s = set(1);
    const a = startDaily(p, s, "2026-10-13", T0);
    expect(attemptDeadline(a) - T0).toBe(25 * MIN);
    saveDaily(p, s, { answers: { "D01-Q01": "B" }, marked: [], current: 0 }, T0 + 24 * MIN);
    expect(() => saveDaily(p, s, { answers: { "D01-Q01": "A" }, marked: [], current: 0 }, T0 + 25 * MIN + SUBMIT_GRACE_MS)).toThrow(ProgressError);
    // Within the grace window, an auto-submit still counts the answers it carries.
    expect(finalizeIfExpired(p, s, T0 + 25 * MIN + 1000)).toBeNull();
    const e = finalizeIfExpired(p, s, T0 + 25 * MIN + SUBMIT_GRACE_MS)!;
    expect(e).toMatchObject({ correct: 1, timedOut: true });
    expect(e.submittedAt).toBe(new Date(T0 + 25 * MIN).toISOString());
  });

  it("ignores answers sent with a submit that arrives after the grace window", () => {
    const p = emptyProgress();
    const s = set(1);
    startDaily(p, s, "2026-10-13", T0);
    saveDaily(p, s, { answers: { "D01-Q01": "B" }, marked: [], current: 0 }, T0 + MIN);
    const e = submitDaily(p, s, { "D01-Q01": "B", "D01-Q02": "B" }, T0 + 40 * MIN);
    expect(e).toMatchObject({ correct: 1, timedOut: true });
  });

  it("never sends correct answers in the state", () => {
    const p = emptyProgress();
    const s = set(1);
    startDaily(p, s, "2026-10-13", T0);
    const state = buildDailyState(p, s, s, T0);
    expect(state.attempt!.questions).toHaveLength(25);
    expect(JSON.stringify(state)).not.toMatch(/"correct"|explanation|distractor/);
  });
});
