import type { OptionKey, PracticeTrack, QuestionSet, SetProgress, SetStatus } from "./types";
import { PRACTICE_DURATION_SECONDS, TOTAL_SETS } from "./types";
import { evaluate, netScore, normaliseAnswer } from "./scoring";

export class ProgressError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** A submit that arrives this long after the deadline (slow network at auto-submit) still counts its answers. */
export const PRACTICE_SUBMIT_GRACE_MS = 30_000;

/**
 * The functions below work on one track of sets: `p` is the whole progress for practice sets, or `p.pyq` for PYQ sets
 * (see pyqTrack). `total` is the number of sets in that track.
 */
export function isUnlocked(p: PracticeTrack, setId: number, total = TOTAL_SETS) {
  return setId >= 1 && setId <= Math.min(p.unlockedUpTo, total);
}

export function setStatus(p: PracticeTrack, setId: number): SetStatus {
  return p.sets[setId]?.status ?? "not_started";
}

export const practiceDeadline = (sp: Pick<SetProgress, "startedAt">) => Date.parse(sp.startedAt) + PRACTICE_DURATION_SECONDS * 1000;

/** Keeps only valid answers to questions in the set; "not answered" is simply absent. */
function cleanAnswers(set: QuestionSet, raw: Record<string, OptionKey[]>) {
  const out: Record<string, OptionKey[]> = {};
  set.questions.forEach((q, i) => {
    const a = raw[q.id];
    if (!a?.length) return;
    const check = normaliseAnswer(q, a);
    if (!check.ok) throw new ProgressError(`Question ${i + 1}: ${check.error}`, 400);
    out[q.id] = check.answer;
  });
  return out;
}

/**
 * Starts a new attempt at the set, or resumes the one in progress (call finalizeIfExpired first).
 * Returns the completed attempt untouched if the set is already done. Mutates `p`.
 */
export function startPractice(p: PracticeTrack, set: QuestionSet, now = Date.now(), total = TOTAL_SETS): SetProgress {
  const setId = set.setId;
  if (!isUnlocked(p, setId, total)) throw new ProgressError("This set is locked.", 403);
  const sp = p.sets[setId];
  if (sp) {
    // Attempts from before practice sets were timed: keep their answers and start the clock now.
    if (sp.status === "in_progress" && !sp.marked) {
      sp.marked = [];
      sp.startedAt = new Date(now).toISOString();
      sp.currentIndex = Math.min(sp.currentIndex, set.questions.length - 1);
    }
    return sp;
  }
  const last = p.history.filter((h) => h.setId === setId).at(-1);
  return (p.sets[setId] = {
    status: "in_progress",
    answers: {},
    marked: [],
    currentIndex: 0,
    correct: 0,
    incorrect: 0,
    notAttempted: 0,
    startedAt: new Date(now).toISOString(),
    attemptNo: (last?.attemptNo ?? 0) + 1,
  });
}

function runningAttempt(p: PracticeTrack, set: QuestionSet) {
  const sp = p.sets[set.setId];
  if (sp?.status === "completed") throw new ProgressError("This set is already submitted. Retake it to try again.", 409);
  if (!sp) throw new ProgressError("This set has not been started. Reload to start it.", 409);
  return sp;
}

/**
 * Scores the attempt, records it in history and unlocks the next set. A retake replaces the set's
 * earlier result: its older history entries are dropped. Mutates `p`.
 */
function finish(p: PracticeTrack, set: QuestionSet, submittedAt: number, timedOut: boolean, total: number) {
  const setId = set.setId;
  const sp = runningAttempt(p, set);
  let correct = 0;
  let incorrect = 0;
  const wrong: string[] = [];
  for (const q of set.questions) {
    const a = sp.answers[q.id];
    if (!a) continue;
    const { result } = evaluate(q, a);
    if (result === "correct") correct++;
    else if (result === "incorrect") {
      incorrect++;
      wrong.push(q.id);
    }
  }
  const score = netScore(correct, incorrect);
  const completedAt = new Date(submittedAt).toISOString();

  sp.status = "completed";
  sp.correct = correct;
  sp.incorrect = incorrect;
  sp.notAttempted = set.questions.length - correct - incorrect;
  sp.completedAt = completedAt;
  sp.timedOut = timedOut;
  const previous = p.history.filter((h) => h.setId === setId).at(-1);
  if (previous) sp.previousScore = previous.score;

  p.history = p.history.filter((h) => h.setId !== setId);
  p.history.push({ setId, attemptNo: sp.attemptNo, score, correct, incorrect, notAttempted: sp.notAttempted, wrong, date: completedAt });

  // Unlock only ever moves forward.
  let nextUnlocked: number | null = null;
  if (setId < total && p.unlockedUpTo < setId + 1) {
    p.unlockedUpTo = setId + 1;
    nextUnlocked = setId + 1;
  }
  return { setId, attemptNo: sp.attemptNo, score, timedOut, nextUnlocked };
}

/**
 * If the attempt's time (plus `graceMs`) is over, submits it with the answers saved so far.
 * Returns the outcome, or null when nothing expired. Mutates `p`.
 */
export function finalizeIfExpired(p: PracticeTrack, set: QuestionSet, now = Date.now(), graceMs = PRACTICE_SUBMIT_GRACE_MS, total = TOTAL_SETS) {
  const sp = p.sets[set.setId];
  if (sp?.status !== "in_progress" || !sp.marked || now < practiceDeadline(sp) + graceMs) return null;
  return finish(p, set, practiceDeadline(sp), true, total);
}

/** Save & Next / Previous / palette jump: stores the answers so far. Rejected once time is up. Mutates `p`. */
export function savePractice(
  p: PracticeTrack,
  set: QuestionSet,
  body: { answers: Record<string, OptionKey[]>; marked: string[]; current: number },
  now = Date.now(),
) {
  const sp = runningAttempt(p, set);
  if (now >= practiceDeadline(sp) + PRACTICE_SUBMIT_GRACE_MS) throw new ProgressError("Time is up. Your saved answers have been submitted.", 409);
  sp.answers = cleanAnswers(set, body.answers);
  sp.marked = body.marked.filter((id) => set.questions.some((q) => q.id === id));
  sp.currentIndex = Math.min(Math.max(0, body.current), set.questions.length - 1);
  return sp;
}

/** Submit: scores the attempt. Late submits (past the grace) keep only what was saved. Mutates `p`. */
export function submitPractice(p: PracticeTrack, set: QuestionSet, answers: Record<string, OptionKey[]>, now = Date.now(), total = TOTAL_SETS) {
  const sp = runningAttempt(p, set);
  const deadline = practiceDeadline(sp);
  if (now < deadline + PRACTICE_SUBMIT_GRACE_MS) sp.answers = cleanAnswers(set, answers);
  return finish(p, set, Math.min(now, deadline), now >= deadline, total);
}

/** Clears a set's current attempt so it can be retaken. Its result is replaced when the retake is submitted; unlocks are untouched. */
export function applyReset(p: PracticeTrack, setId: number, total = TOTAL_SETS) {
  if (!isUnlocked(p, setId, total)) throw new ProgressError("This set is locked.", 403);
  delete p.sets[setId];
}
