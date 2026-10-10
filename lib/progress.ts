import type { AnswerFeedback, OptionKey, Progress, QuestionSet, SetStatus } from "./types";
import { TOTAL_SETS } from "./types";
import { evaluate, netScore, normaliseAnswer } from "./scoring";

export class ProgressError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function isUnlocked(p: Progress, setId: number) {
  return setId >= 1 && setId <= Math.min(p.unlockedUpTo, TOTAL_SETS);
}

export function setStatus(p: Progress, setId: number): SetStatus {
  return p.sets[setId]?.status ?? "not_started";
}

/**
 * Records the answer to the set's current question. Mutates `p`.
 * The answer must be for the current question: no skipping ahead and no changing a submitted answer.
 */
export function applyAnswer(
  p: Progress,
  set: QuestionSet,
  questionId: string,
  raw: OptionKey[],
  now = new Date().toISOString(),
): AnswerFeedback {
  const setId = set.setId;
  if (!isUnlocked(p, setId)) throw new ProgressError("This set is locked.", 403);
  const existing = p.sets[setId];
  if (existing?.status === "completed") throw new ProgressError("This set is already completed. Reset it to retry.", 409);

  const index = existing?.currentIndex ?? 0;
  const q = set.questions[index];
  if (!q || q.id !== questionId) throw new ProgressError("That is not the current question. Reload to continue.", 409);

  const check = normaliseAnswer(q, raw);
  if (!check.ok) throw new ProgressError(check.error, 400);
  const { result, marks } = evaluate(q, check.answer);

  const sp =
    existing ??
    (p.sets[setId] = {
      status: "in_progress",
      answers: {},
      currentIndex: 0,
      correct: 0,
      incorrect: 0,
      notAttempted: 0,
      startedAt: now,
      attemptNo: p.history.filter((h) => h.setId === setId).length + 1,
    });

  sp.answers[q.id] = check.answer;
  if (result === "correct") sp.correct++;
  else if (result === "incorrect") sp.incorrect++;
  else sp.notAttempted++;
  sp.currentIndex = index + 1;

  let nextUnlocked: number | null = null;
  const completed = sp.currentIndex >= set.questions.length;
  if (completed) {
    sp.status = "completed";
    sp.completedAt = now;
    const score = netScore(sp.correct, sp.incorrect);
    p.history.push({
      setId,
      attemptNo: sp.attemptNo,
      score,
      correct: sp.correct,
      incorrect: sp.incorrect,
      notAttempted: sp.notAttempted,
      wrong: set.questions.filter((x) => evaluate(x, sp.answers[x.id] ?? ["E"]).result === "incorrect").map((x) => x.id),
      date: now,
    });
    // Unlock only ever moves forward.
    if (setId < TOTAL_SETS && p.unlockedUpTo < setId + 1) {
      p.unlockedUpTo = setId + 1;
      nextUnlocked = setId + 1;
    }
  }

  return {
    result,
    yourAnswer: check.answer,
    correct: q.correct,
    marks,
    explanation: q.explanation,
    score: netScore(sp.correct, sp.incorrect),
    answered: sp.currentIndex,
    total: set.questions.length,
    completed,
    nextUnlocked,
  };
}

/** Clears a set's current attempt. Completed attempts already live on in `history`; unlocks are untouched. */
export function applyReset(p: Progress, setId: number) {
  if (!isUnlocked(p, setId)) throw new ProgressError("This set is locked.", 403);
  delete p.sets[setId];
}
