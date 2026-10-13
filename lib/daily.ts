import type { DailyAttempt, DailyHistoryEntry, DailyProgress, OptionKey, Progress, PublicQuestion, QuestionSet } from "./types";
import { DAILY_DURATION_SECONDS } from "./types";
import { evaluate, netScore } from "./scoring";
import { ProgressError } from "./progress";
import { toPublic } from "./questions";

// Daily Question: every IST day maps to one daily set (rotating through all of them), the test runs for
// 25 minutes on the server clock, and it can be attempted any number of times while that day lasts.

/** Daily set 1 is the set of the day on this date; the rotation steps one set per day from here. */
export const DAILY_START_DATE = "2026-10-13";
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
/** A submit that arrives this long after the deadline (slow network at auto-submit) still counts its answers. */
export const SUBMIT_GRACE_MS = 30_000;

const istFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today's date in India as YYYY-MM-DD. */
export function istDateKey(now = new Date()) {
  return istFormat.format(now);
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

/** The daily set shown on an IST date: 1..total, cycling. */
export function dailySetFor(dateKey: string, total: number) {
  if (total < 1) return null;
  const days = dayNumber(dateKey) - dayNumber(DAILY_START_DATE);
  return (((days % total) + total) % total) + 1;
}

/** When the next daily set appears (midnight IST), as epoch ms. */
export function nextResetAt(now = new Date()) {
  return (dayNumber(istDateKey(now)) + 1) * DAY_MS - IST_OFFSET_MS;
}

export const attemptDeadline = (a: Pick<DailyAttempt, "startedAt">) => Date.parse(a.startedAt) + DAILY_DURATION_SECONDS * 1000;

export function dailyOf(p: Progress): DailyProgress {
  return (p.daily ??= { attempt: null, history: [] });
}

/** Keeps only answers to questions in the set; "not answered" is simply absent. */
function cleanAnswers(set: QuestionSet, raw: Record<string, OptionKey>) {
  const ids = new Set(set.questions.map((q) => q.id));
  return Object.fromEntries(Object.entries(raw).filter(([id]) => ids.has(id))) as Record<string, OptionKey>;
}

export function scoreDaily(set: QuestionSet, answers: Record<string, OptionKey>) {
  let correct = 0;
  let incorrect = 0;
  for (const q of set.questions) {
    const a = answers[q.id];
    if (!a) continue;
    const { result } = evaluate(q, [a]);
    if (result === "correct") correct++;
    else if (result === "incorrect") incorrect++;
  }
  return { correct, incorrect, notAttempted: set.questions.length - correct - incorrect, score: netScore(correct, incorrect) };
}

/** Closes the current attempt and records it in history. Mutates `p`. */
function finish(p: Progress, set: QuestionSet, submittedAt: number, timedOut: boolean): DailyHistoryEntry {
  const daily = dailyOf(p);
  const a = daily.attempt;
  if (!a) throw new ProgressError("No daily test in progress.", 409);
  const answers = cleanAnswers(set, a.answers);
  const entry: DailyHistoryEntry = {
    date: a.date,
    setId: a.setId,
    attemptNo: a.attemptNo,
    ...scoreDaily(set, answers),
    answers,
    startedAt: a.startedAt,
    submittedAt: new Date(submittedAt).toISOString(),
    timedOut,
  };
  daily.history.push(entry);
  daily.attempt = null;
  return entry;
}

/**
 * If the running attempt's 25 minutes (plus `graceMs`) are over, submits it with the answers saved so far.
 * `set` must be the attempt's set. Returns the history entry, or null when nothing expired.
 */
export function finalizeIfExpired(p: Progress, set: QuestionSet, now = Date.now(), graceMs = SUBMIT_GRACE_MS) {
  const a = dailyOf(p).attempt;
  if (!a || now < attemptDeadline(a) + graceMs) return null;
  return finish(p, set, attemptDeadline(a), true);
}

/** Starts a new attempt at today's set, or resumes the one already running (call finalizeIfExpired first). Mutates `p`. */
export function startDaily(p: Progress, set: QuestionSet, date: string, now = Date.now()): DailyAttempt {
  const daily = dailyOf(p);
  if (daily.attempt) {
    if (now < attemptDeadline(daily.attempt)) return daily.attempt;
    throw new ProgressError("The previous attempt has not been closed yet. Reload and try again.", 409);
  }
  daily.attempt = {
    date,
    setId: set.setId,
    attemptNo: daily.history.filter((h) => h.date === date && h.setId === set.setId).length + 1,
    answers: {},
    marked: [],
    current: 0,
    startedAt: new Date(now).toISOString(),
  };
  return daily.attempt;
}

function runningAttempt(p: Progress, set: QuestionSet) {
  const a = dailyOf(p).attempt;
  if (!a || a.setId !== set.setId) throw new ProgressError("No daily test in progress. Start it again from the Daily Question page.", 409);
  return a;
}

/** Save & Next / Previous: stores the answers so far. Rejected once time is up. Mutates `p`. */
export function saveDaily(
  p: Progress,
  set: QuestionSet,
  body: { answers: Record<string, OptionKey>; marked: string[]; current: number },
  now = Date.now(),
) {
  const a = runningAttempt(p, set);
  if (now >= attemptDeadline(a) + SUBMIT_GRACE_MS) throw new ProgressError("Time is up. Your saved answers have been submitted.", 409);
  a.answers = cleanAnswers(set, body.answers);
  a.marked = body.marked.filter((id) => set.questions.some((q) => q.id === id));
  a.current = Math.min(Math.max(0, body.current), set.questions.length - 1);
  return a;
}

/** Submit: scores the attempt and moves it to history. Late submits (past the grace) keep only what was saved. Mutates `p`. */
export function submitDaily(p: Progress, set: QuestionSet, answers: Record<string, OptionKey>, now = Date.now()) {
  const a = runningAttempt(p, set);
  const deadline = attemptDeadline(a);
  if (now < deadline + SUBMIT_GRACE_MS) a.answers = cleanAnswers(set, answers);
  return finish(p, set, Math.min(now, deadline), now >= deadline);
}

export interface DailyAttemptState {
  setId: number;
  title: string;
  attemptNo: number;
  date: string;
  startedAt: string;
  deadline: number;
  answers: Record<string, OptionKey>;
  marked: string[];
  current: number;
  questions: PublicQuestion[];
}

export type DailySummary = Pick<
  DailyHistoryEntry,
  "date" | "setId" | "attemptNo" | "score" | "correct" | "incorrect" | "notAttempted" | "startedAt" | "submittedAt" | "timedOut"
>;

export interface DailyState {
  date: string;
  /** Null when no daily sets are installed. */
  setId: number | null;
  title: string | null;
  total: number;
  durationSeconds: number;
  nextResetAt: number;
  /** Server clock, so the browser timer can correct for a skewed device clock. */
  serverNow: number;
  attempt: DailyAttemptState | null;
  /** Today's submitted attempts at today's set, newest first. */
  today: DailySummary[];
}

export const summarise = ({ answers: _answers, ...rest }: DailyHistoryEntry): DailySummary => rest;

/** `attemptSet` is the set of the running attempt (may be yesterday's set if it was started just before midnight). */
export function buildDailyState(p: Progress, todaySet: QuestionSet | null, attemptSet: QuestionSet | null, now = Date.now()): DailyState {
  const date = istDateKey(new Date(now));
  const daily = p.daily ?? { attempt: null, history: [] };
  const a = daily.attempt;
  return {
    date,
    setId: todaySet?.setId ?? null,
    title: todaySet?.title ?? null,
    total: todaySet?.questions.length ?? 0,
    durationSeconds: DAILY_DURATION_SECONDS,
    nextResetAt: nextResetAt(new Date(now)),
    serverNow: now,
    attempt:
      a && attemptSet && a.setId === attemptSet.setId
        ? {
            setId: a.setId,
            title: attemptSet.title,
            attemptNo: a.attemptNo,
            date: a.date,
            startedAt: a.startedAt,
            deadline: attemptDeadline(a),
            answers: a.answers,
            marked: a.marked,
            current: a.current,
            questions: attemptSet.questions.map(toPublic),
          }
        : null,
    today: daily.history
      .filter((h) => h.date === date && h.setId === todaySet?.setId)
      .map(summarise)
      .reverse(),
  };
}
