import { describe, expect, it } from "vitest";
import { evaluate, netScore, normaliseAnswer } from "@/lib/scoring";
import { applyReset, finalizeIfExpired, isUnlocked, ProgressError, savePractice, startPractice, submitPractice } from "@/lib/progress";
import { emptyProgress } from "@/lib/store";
import { buildSetReport } from "@/lib/report";
import type { OptionKey, Question, QuestionSet } from "@/lib/types";
import { PRACTICE_DURATION_SECONDS } from "@/lib/types";

function q(i: number, setId: number, extra: Partial<Question> = {}): Question {
  const id = `S${String(setId).padStart(2, "0")}-Q${String(i + 1).padStart(2, "0")}`;
  return {
    id,
    type: "single",
    difficulty: "Medium",
    topic: `Topic ${i % 7}`,
    subtopic: "Sub",
    concept: `Concept ${i}`,
    source: "Generated",
    sourceRef: "01_PDF_01_TO_05.md",
    question: `Question ${i}?`,
    options: { A: "a", B: "b", C: "c", D: "d", E: "Not Attempted" },
    correct: ["B"],
    explanation: "Because.",
    distractorMistakeType: { A: "Conceptual", C: "Memory/Fact", D: "Careless Error" },
    ...extra,
  };
}
const makeSet = (setId: number): QuestionSet => ({
  setId,
  title: `Set ${setId}`,
  questions: Array.from({ length: 25 }, (_, i) =>
    i === 12 ? q(i, setId, { type: "multiple", correct: ["A", "C"], distractorMistakeType: { B: "Conceptual", D: "Conceptual" } }) : q(i, setId),
  ),
});

describe("scoring", () => {
  it("scores +1 / -1/3 / 0", () => {
    expect(evaluate({ correct: ["B"] }, ["B"])).toEqual({ result: "correct", marks: 1 });
    expect(evaluate({ correct: ["B"] }, ["A"]).marks).toBeCloseTo(-1 / 3);
    expect(evaluate({ correct: ["B"] }, ["E"])).toEqual({ result: "not_attempted", marks: 0 });
  });
  it("multiple-select needs an exact match, no partial marks", () => {
    expect(evaluate({ correct: ["A", "C"] }, ["A", "C"]).result).toBe("correct");
    expect(evaluate({ correct: ["A", "C"] }, ["A"]).result).toBe("incorrect");
    expect(evaluate({ correct: ["A", "C"] }, ["A", "B", "C"]).result).toBe("incorrect");
  });
  it("net score uses thirds exactly", () => {
    expect(netScore(18, 4)).toBe(16.67);
    expect(netScore(0, 3)).toBe(-1);
  });
  it("rejects answers that don't fit the question type", () => {
    expect(normaliseAnswer({ type: "single" }, ["A", "B"]).ok).toBe(false);
    expect(normaliseAnswer({ type: "multiple" }, ["A", "E"]).ok).toBe(false);
    expect(normaliseAnswer({ type: "multiple" }, ["C", "A"])).toEqual({ ok: true, answer: ["A", "C"] });
    expect(normaliseAnswer({ type: "single" }, ["E"]).ok).toBe(true);
  });
});

describe("progress, unlock and reset", () => {
  const set1 = makeSet(1);
  const T0 = Date.parse("2026-10-13T10:00:00Z");
  const answersFor = (set: QuestionSet, ans: (i: number) => OptionKey[]) =>
    Object.fromEntries(set.questions.map((x, i) => [x.id, x.type === "multiple" ? (["A", "C"] as OptionKey[]) : ans(i)]));
  const finish = (p = emptyProgress(), set = set1, ans: (i: number) => OptionKey[] = () => ["B"], now = T0) => {
    startPractice(p, set, now);
    submitPractice(p, set, answersFor(set, ans), now + 60_000);
    return p;
  };

  it("only Set 1 is open at first and locked sets refuse to start", () => {
    const p = emptyProgress();
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(false);
    expect(() => startPractice(p, makeSet(2))).toThrow(ProgressError);
  });

  it("saves answers in any order, can change them, and resumes the same attempt", () => {
    const p = emptyProgress();
    startPractice(p, set1, T0);
    const [q1, , q3] = set1.questions;
    savePractice(p, set1, { answers: { [q3.id]: ["A"] }, marked: [q3.id], current: 2 }, T0 + 1000);
    savePractice(p, set1, { answers: { [q3.id]: ["B"], [q1.id]: ["E"] }, marked: [], current: 0 }, T0 + 2000);
    expect(p.sets[1].answers).toEqual({ [q1.id]: ["E"], [q3.id]: ["B"] });
    expect(p.sets[1].status).toBe("in_progress");
    expect(startPractice(p, set1, T0 + 3000).startedAt).toBe(new Date(T0).toISOString());
    expect(() => savePractice(p, set1, { answers: { [q1.id]: ["A", "B"] }, marked: [], current: 0 }, T0)).toThrow(/exactly one/);
  });

  it("submit scores the set (unanswered = not attempted) and unlocks the next", () => {
    const p = emptyProgress();
    startPractice(p, set1, T0);
    const answers = answersFor(set1, () => ["B"]);
    delete answers[set1.questions[0].id];
    answers[set1.questions[1].id] = ["E"];
    answers[set1.questions[2].id] = ["A"];
    const out = submitPractice(p, set1, answers, T0 + 1000);
    expect(p.sets[1].status).toBe("completed");
    expect(p.sets[1]).toMatchObject({ correct: 22, incorrect: 1, notAttempted: 2, timedOut: false });
    expect(out.nextUnlocked).toBe(2);
    expect(p.unlockedUpTo).toBe(2);
    expect(p.history).toHaveLength(1);
    expect(() => submitPractice(p, set1, answers, T0 + 2000)).toThrow(/already submitted/);
  });

  it("time up submits the saved answers only", () => {
    const p = emptyProgress();
    startPractice(p, set1, T0);
    savePractice(p, set1, { answers: { [set1.questions[0].id]: ["B"] }, marked: [], current: 0 }, T0 + 1000);
    const end = T0 + PRACTICE_DURATION_SECONDS * 1000;
    expect(finalizeIfExpired(p, set1, end - 1)).toBeNull();
    expect(finalizeIfExpired(p, set1, end + 60_000)?.timedOut).toBe(true);
    expect(p.sets[1]).toMatchObject({ status: "completed", correct: 1, notAttempted: 24, completedAt: new Date(end).toISOString() });
  });

  it("retake replaces the previous result but keeps the unlock", () => {
    const p = finish(emptyProgress(), set1, () => ["A"]);
    applyReset(p, 1);
    expect(p.sets[1]).toBeUndefined();
    expect(p.unlockedUpTo).toBe(2);
    finish(p, set1, () => ["B"], T0 + 3_600_000);
    expect(p.sets[1].attemptNo).toBe(2);
    expect(p.history).toHaveLength(1);
    expect(p.history[0]).toMatchObject({ attemptNo: 2, correct: 25 });
    expect(p.unlockedUpTo).toBe(2);
  });

  it("report shows improvement over the replaced attempt and repeated weaknesses from other sets", () => {
    const set2 = makeSet(2);
    const p = finish(emptyProgress(), set1, () => ["A"]);
    finish(p, set2, () => ["A"]);
    applyReset(p, 2);
    finish(p, set2, (i) => (i < 20 ? ["B"] : ["A"]));
    const r = buildSetReport(set2, p, [set1, set2]);
    expect(r.summary.correct).toBe(20);
    expect(r.attemptNo).toBe(2);
    expect(r.previousScore).not.toBeNull();
    expect(r.summary.score).toBeGreaterThan(r.previousScore!);
    expect(r.timeTaken).toBe(60);
    expect(r.revisionPlan.some((x) => x.repeated)).toBe(true);
    expect(r.mistakes[0].type).toBe("Conceptual");
  });
});
