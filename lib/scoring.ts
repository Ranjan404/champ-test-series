import type { AnswerResult, Letter, OptionKey, Question } from "./types";
import { LETTERS } from "./types";

export const MARK_CORRECT = 1;
export const MARK_WRONG = -1 / 3;

export type AnswerCheck = { ok: true; answer: OptionKey[] } | { ok: false; error: string };

/**
 * Normalises and checks an answer against the question type.
 * Single: exactly one letter (A-E). Multiple: one or more of A-D, or just E.
 */
export function normaliseAnswer(q: Pick<Question, "type">, raw: OptionKey[]): AnswerCheck {
  const unique = [...new Set(raw)].sort() as OptionKey[];
  if (unique.length !== raw.length) return { ok: false, error: "Duplicate options in answer." };
  if (unique.length === 0) return { ok: false, error: "Choose an option." };
  if (unique.includes("E") && unique.length > 1) {
    return { ok: false, error: "Not Attempted cannot be combined with other options." };
  }
  if (q.type === "single" && unique.length !== 1) {
    return { ok: false, error: "This question accepts exactly one option." };
  }
  return { ok: true, answer: unique };
}

export function evaluate(q: Pick<Question, "correct">, answer: OptionKey[]): { result: AnswerResult; marks: number } {
  if (answer.length === 1 && answer[0] === "E") return { result: "not_attempted", marks: 0 };
  const picked = [...answer].sort().join(",");
  const right = [...q.correct].sort().join(",");
  return picked === right ? { result: "correct", marks: MARK_CORRECT } : { result: "incorrect", marks: MARK_WRONG };
}

/** Net score from counts; computed from integers so thirds never drift. */
export function netScore(correct: number, incorrect: number) {
  return round2(correct - incorrect / 3);
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Display a mark as +1, -1/3, 0. */
export function formatMarks(m: number) {
  if (m === 0) return "0";
  if (m > 0) return "+1";
  return "-1/3";
}

export function formatScore(n: number) {
  const r = round2(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
}

export function wrongLetters(q: Pick<Question, "correct">, answer: OptionKey[]): Letter[] {
  return answer.filter((a): a is Letter => (LETTERS as readonly string[]).includes(a) && !q.correct.includes(a as Letter));
}
