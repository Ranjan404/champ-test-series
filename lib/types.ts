export const LETTERS = ["A", "B", "C", "D"] as const;
export const ALL_OPTIONS = ["A", "B", "C", "D", "E"] as const;
export type Letter = (typeof LETTERS)[number];
export type OptionKey = (typeof ALL_OPTIONS)[number];

export const TOTAL_SETS = 50;
export const QUESTIONS_PER_SET = 25;
/** Practice sets are timed like the Daily Question: 25 minutes for 25 questions. */
export const PRACTICE_DURATION_SECONDS = 25 * 60;
/** Full Length Tests: 150 questions in 150 minutes. The timer pauses while the candidate is away from the test. */
export const FULL_LENGTH_DURATION_SECONDS = 150 * 60;

export type Difficulty = "Easy" | "Medium" | "Hard";
export type QuestionType = "single" | "multiple";

export type MistakeType =
  | "Conceptual"
  | "Calculation"
  | "Confusion Between Concepts"
  | "Careless Error"
  | "Question Misread"
  | "Memory/Fact";

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  topic: string;
  subtopic: string;
  concept: string;
  source: "Generated" | "PYQ" | "Full Length Test";
  sourceRef: string;
  question: string;
  options: Record<OptionKey, string>;
  correct: Letter[];
  explanation: string;
  distractorMistakeType: Partial<Record<Letter, MistakeType>>;
}

export interface QuestionSection {
  name: string;
  /** 1-based question numbers, inclusive. */
  from: number;
  to: number;
}

export interface QuestionSet {
  setId: number;
  title: string;
  /** Full Length Tests only: the paper's parts (Language, GK & GS, Computer Science). */
  sections?: QuestionSection[];
  questions: Question[];
}

/** What the browser is allowed to see before answering: no answer, no topic. */
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: Record<OptionKey, string>;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export type SetStatus = "not_started" | "in_progress" | "completed";

/** A practice attempt. Answers are saved on Save & Next / Previous / palette jumps and scored on Submit. */
export interface SetProgress {
  status: Exclude<SetStatus, "not_started">;
  answers: Record<string, OptionKey[]>;
  /** Marked for review. Missing on attempts started before practice sets were timed. */
  marked?: string[];
  /** The question on screen while in progress. */
  currentIndex: number;
  /** Filled in on submit. */
  correct: number;
  incorrect: number;
  notAttempted: number;
  /** Also the timer start: the attempt ends PRACTICE_DURATION_SECONDS later. */
  startedAt: string;
  completedAt?: string;
  attemptNo: number;
  /** Submitted by the timer rather than the candidate. */
  timedOut?: boolean;
  /** Score of the attempt this one replaced, if any. */
  previousScore?: number;
  /** Full Length Tests only: a timer that pauses. Without it the attempt ends PRACTICE_DURATION_SECONDS after startedAt. */
  timer?: PausableTimer;
}

/** A timer that only runs while the test is open on screen. */
export interface PausableTimer {
  durationSeconds: number;
  /** Time used by the runs that have ended (each run is one stretch between resume and pause). */
  usedMs: number;
  /** Start of the current run, or null while paused. */
  runningSince: string | null;
  /** Last time the open test reported in. A run without news for a while is treated as paused from then on. */
  lastSeenAt: string | null;
}

export interface HistoryEntry {
  setId: number;
  attemptNo: number;
  score: number;
  correct: number;
  incorrect: number;
  notAttempted: number;
  /** ids of questions answered wrong, used to spot repeated weak concepts */
  wrong: string[];
  date: string;
}

/** One sequence of unlockable timed sets: the practice sets, or the PYQ sets. */
export interface PracticeTrack {
  unlockedUpTo: number;
  sets: Record<string, SetProgress>;
  history: HistoryEntry[];
}

export interface Progress extends PracticeTrack {
  /** Daily Question tests. Missing in progress saved before the feature existed. */
  daily?: DailyProgress;
  /** PYQ sets (same rules as practice sets). Missing in progress saved before the feature existed. */
  pyq?: PracticeTrack;
  /** Full Length Tests (practice-set rules, but 150 questions and a pausable 150-minute timer). */
  fullLength?: PracticeTrack;
}

/** Daily Question: one set per day (IST), 25 questions, 25 minutes, unlimited attempts. */
export const DAILY_QUESTIONS_PER_SET = 25;
export const DAILY_DURATION_SECONDS = 25 * 60;

/** The daily attempt being written. Answers are saved on Save & Next / Previous / palette jumps. */
export interface DailyAttempt {
  /** IST date (YYYY-MM-DD) the attempt was started on. */
  date: string;
  setId: number;
  attemptNo: number;
  answers: Record<string, OptionKey>;
  marked: string[];
  current: number;
  startedAt: string;
}

export interface DailyHistoryEntry {
  date: string;
  setId: number;
  attemptNo: number;
  score: number;
  correct: number;
  incorrect: number;
  notAttempted: number;
  answers: Record<string, OptionKey>;
  startedAt: string;
  submittedAt: string;
  /** Submitted by the timer rather than the candidate. */
  timedOut: boolean;
}

export interface DailyProgress {
  attempt: DailyAttempt | null;
  history: DailyHistoryEntry[];
}

export type AnswerResult = "correct" | "incorrect" | "not_attempted";
