import type { OptionKey, PublicQuestion, QuestionSet, SetProgress } from "./types";
import { PRACTICE_DURATION_SECONDS } from "./types";
import { practiceDeadline, timeUsedMs } from "./progress";
import { toPublic } from "./questions";

/** What the practice test runner gets: no answers, topics or difficulty until the set is submitted. */
export interface PracticeAttemptState {
  setId: number;
  title: string;
  attemptNo: number;
  startedAt: string;
  /** Server time when the time runs out, counting from when this state was built. */
  deadline: number;
  durationSeconds: number;
  /** The timer pauses when the test is closed (Full Length Tests). */
  pausable: boolean;
  /** Full Length Tests: the paper's parts, for the section tabs. */
  sections: { name: string; from: number; to: number }[];
  answers: Record<string, OptionKey[]>;
  marked: string[];
  current: number;
  questions: PublicQuestion[];
}

export type PracticeStart =
  | { status: "completed"; setId: number }
  | {
      status: "in_progress";
      /** Server clock, so the browser timer can correct for a skewed device clock. */
      serverNow: number;
      attempt: PracticeAttemptState;
    };

export function buildPracticeStart(set: QuestionSet, sp: SetProgress, now = Date.now()): PracticeStart {
  if (sp.status === "completed") return { status: "completed", setId: set.setId };
  return {
    status: "in_progress",
    serverNow: now,
    attempt: {
      setId: set.setId,
      title: set.title,
      attemptNo: sp.attemptNo,
      startedAt: sp.startedAt,
      // A paused timer has no deadline; the state is built right after resuming, so count from `now`.
      deadline: sp.timer ? now + sp.timer.durationSeconds * 1000 - timeUsedMs(sp, now) : practiceDeadline(sp),
      durationSeconds: sp.timer?.durationSeconds ?? PRACTICE_DURATION_SECONDS,
      pausable: !!sp.timer,
      sections: set.sections?.map(({ name, from, to }) => ({ name, from, to })) ?? [],
      answers: sp.answers,
      marked: sp.marked ?? [],
      current: sp.currentIndex,
      questions: set.questions.map(toPublic),
    },
  };
}
