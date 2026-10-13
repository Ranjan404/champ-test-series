import type { OptionKey, PublicQuestion, QuestionSet, SetProgress } from "./types";
import { PRACTICE_DURATION_SECONDS } from "./types";
import { practiceDeadline } from "./progress";
import { toPublic } from "./questions";

/** What the practice test runner gets: no answers, topics or difficulty until the set is submitted. */
export interface PracticeAttemptState {
  setId: number;
  title: string;
  attemptNo: number;
  startedAt: string;
  deadline: number;
  durationSeconds: number;
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
      deadline: practiceDeadline(sp),
      durationSeconds: PRACTICE_DURATION_SECONDS,
      answers: sp.answers,
      marked: sp.marked ?? [],
      current: sp.currentIndex,
      questions: set.questions.map(toPublic),
    },
  };
}
