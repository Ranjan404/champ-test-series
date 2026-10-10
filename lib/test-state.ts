import type { Progress, PublicQuestion, QuestionSet, SetStatus } from "./types";
import { netScore } from "./scoring";
import { toPublic } from "./questions";

export interface TestState {
  setId: number;
  title: string;
  total: number;
  status: SetStatus;
  currentIndex: number;
  score: number;
  counts: { correct: number; incorrect: number; notAttempted: number };
  /** The question to answer now, without answer/topic/difficulty. Null once the set is completed. */
  question: PublicQuestion | null;
}

export function buildTestState(set: QuestionSet, progress: Progress): TestState {
  const sp = progress.sets[set.setId];
  const currentIndex = sp?.currentIndex ?? 0;
  const done = sp?.status === "completed";
  return {
    setId: set.setId,
    title: set.title,
    total: set.questions.length,
    status: sp?.status ?? "not_started",
    currentIndex,
    score: sp ? netScore(sp.correct, sp.incorrect) : 0,
    counts: { correct: sp?.correct ?? 0, incorrect: sp?.incorrect ?? 0, notAttempted: sp?.notAttempted ?? 0 },
    question: done ? null : toPublic(set.questions[currentIndex]),
  };
}
