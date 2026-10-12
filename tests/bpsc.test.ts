import { describe, expect, it } from "vitest";
import { generateRequestSchema, OPT_OUT_INDEX, scoreBpscTest, shuffleOptions, type BpscQuestion } from "@/lib/bpsc";
import { GenerationError, parseQuestions } from "@/lib/bpsc-generate";

const mk = (i: number, subTopic = "Kosi River", correctIndex = 1): BpscQuestion => ({
  id: `q${i + 1}`,
  question: `प्रश्न ${i}?`,
  options: ["क", "ख", "ग", "घ"],
  correctIndex,
  explanation: "क्योंकि.",
  subTopic,
});

describe("BPSC scoring", () => {
  it("scores +1 / -1/3 / 0 and reports accuracy and percentage", () => {
    const qs = [mk(0), mk(1), mk(2), mk(3), mk(4)];
    const r = scoreBpscTest(qs, [1, 1, 1, 0, null]);
    expect(r).toMatchObject({ correct: 3, wrong: 1, unattempted: 1, net: 2.67, accuracy: 75, percentage: 53.4 });
  });

  it("scores option E as 0, neither right nor wrong", () => {
    const r = scoreBpscTest([mk(0), mk(1), mk(2)], [1, OPT_OUT_INDEX, null]);
    expect(r).toMatchObject({ correct: 1, wrong: 0, optedOut: 1, unattempted: 1, net: 1, accuracy: 100 });
  });

  it("allows a negative net score", () => {
    const r = scoreBpscTest([mk(0), mk(1)], [0, 2]);
    expect(r.net).toBe(-0.67);
    expect(r.accuracy).toBe(0);
  });

  it("lists weak sub-topics weakest first and ignores fully correct ones", () => {
    const qs = [mk(0, "Maurya"), mk(1, "Maurya"), mk(2, "Census 2011"), mk(3, "Census 2011"), mk(4, "Kosi")];
    const r = scoreBpscTest(qs, [1, 0, null, null, 1]);
    expect(r.weak.map((w) => w.subTopic)).toEqual(["Census 2011"]);
    expect(r.subTopics.find((s) => s.subTopic === "Maurya")!.accuracy).toBe(50);
  });
});

describe("shuffleOptions", () => {
  it("keeps correctIndex on the same option text", () => {
    for (let seed = 0; seed < 20; seed++) {
      let x = seed + 1;
      const rand = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
      const q = shuffleOptions({ options: ["a", "b", "c", "d"], correctIndex: 2 }, rand);
      expect(q.options[q.correctIndex]).toBe("c");
      expect([...q.options].sort()).toEqual(["a", "b", "c", "d"]);
    }
  });
});

describe("parseQuestions", () => {
  const good = (n: number) => ({ question: `Question number ${n}?`, options: ["w", "x", "y", "z"], correctIndex: 0, explanation: "Because so.", subTopic: "Topic" });

  it("assigns ids, drops malformed or duplicate items and trims to count", () => {
    const text = JSON.stringify({
      questions: [good(1), { ...good(2), options: ["a", "b", "c", "d", "e"] }, { ...good(3), correctIndex: 4 }, good(1), good(4), good(5)],
    });
    const qs = parseQuestions(text, 2);
    expect(qs.map((q) => q.id)).toEqual(["q1", "q2"]);
    expect(qs.map((q) => q.question)).toEqual(["Question number 1?", "Question number 4?"]);
    qs.forEach((q) => expect(q.options[q.correctIndex]).toBe("w"));
  });

  it("accepts a stray markdown fence", () => {
    expect(parseQuestions("```json\n" + JSON.stringify({ questions: [good(1)] }) + "\n```", 1)).toHaveLength(1);
  });

  it("fails when too few questions are valid", () => {
    expect(() => parseQuestions(JSON.stringify({ questions: [good(1)] }), 2)).toThrow(GenerationError);
    expect(() => parseQuestions("not json", 1)).toThrow(GenerationError);
  });

  it("rejects options that repeat", () => {
    expect(() => parseQuestions(JSON.stringify({ questions: [{ ...good(1), options: ["a", "A", "b", "c"] }] }), 1)).toThrow(GenerationError);
  });
});

describe("generate request", () => {
  it("only allows 10, 15 or 25 questions and defaults to Hindi", () => {
    expect(generateRequestSchema.safeParse({ topic: "full", count: 12 }).success).toBe(false);
    expect(generateRequestSchema.parse({ topic: "history", count: 15 }).language).toBe("hi");
  });
});
