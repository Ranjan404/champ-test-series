import { describe, expect, it } from "vitest";
import { evaluate, netScore, normaliseAnswer } from "@/lib/scoring";
import { applyAnswer, applyReset, isUnlocked, ProgressError } from "@/lib/progress";
import { emptyProgress } from "@/lib/store";
import { buildSetReport } from "@/lib/report";
import type { Question, QuestionSet } from "@/lib/types";

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
  const finish = (p = emptyProgress(), set = set1, ans: (i: number) => ("A" | "B" | "E")[] = () => ["B"]) => {
    set.questions.forEach((x, i) => applyAnswer(p, set, x.id, x.type === "multiple" ? ["A", "C"] : ans(i)));
    return p;
  };

  it("only Set 1 is open at first and locked sets refuse answers", () => {
    const p = emptyProgress();
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(false);
    const set2 = makeSet(2);
    expect(() => applyAnswer(p, set2, set2.questions[0].id, ["B"])).toThrow(ProgressError);
  });

  it("refuses skipping ahead or re-answering", () => {
    const p = emptyProgress();
    expect(() => applyAnswer(p, set1, set1.questions[3].id, ["B"])).toThrow(/current question/);
    applyAnswer(p, set1, set1.questions[0].id, ["B"]);
    expect(() => applyAnswer(p, set1, set1.questions[0].id, ["A"])).toThrow(/current question/);
  });

  it("answering all 25 (E counts) completes the set and unlocks the next", () => {
    const p = finish(emptyProgress(), set1, (i) => (i < 5 ? ["E"] : ["B"]));
    expect(p.sets[1].status).toBe("completed");
    expect(p.sets[1].notAttempted).toBe(5);
    expect(p.unlockedUpTo).toBe(2);
    expect(p.history).toHaveLength(1);
  });

  it("reset clears the attempt but keeps the unlock and the history", () => {
    const p = finish();
    applyReset(p, 1);
    expect(p.sets[1]).toBeUndefined();
    expect(p.unlockedUpTo).toBe(2);
    expect(p.history).toHaveLength(1);
    // second attempt
    finish(p, set1, () => ["A"]);
    expect(p.sets[1].attemptNo).toBe(2);
    expect(p.unlockedUpTo).toBe(2);
  });

  it("report shows improvement and repeated weaknesses", () => {
    const p = finish(emptyProgress(), set1, () => ["A"]);
    applyReset(p, 1);
    finish(p, set1, (i) => (i < 20 ? ["B"] : ["A"]));
    const r = buildSetReport(set1, p, [set1]);
    expect(r.summary.correct).toBe(20);
    expect(r.previousScore).not.toBeNull();
    expect(r.summary.score).toBeGreaterThan(r.previousScore!);
    expect(r.revisionPlan.some((x) => x.repeated)).toBe(true);
    expect(r.mistakes[0].type).toBe("Conceptual");
  });
});
