export const LETTERS = ["A", "B", "C", "D"] as const;
export const ALL_OPTIONS = ["A", "B", "C", "D", "E"] as const;
export type Letter = (typeof LETTERS)[number];
export type OptionKey = (typeof ALL_OPTIONS)[number];

export const TOTAL_SETS = 50;
export const QUESTIONS_PER_SET = 25;

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
  source: "Generated" | "PYQ";
  sourceRef: string;
  question: string;
  options: Record<OptionKey, string>;
  correct: Letter[];
  explanation: string;
  distractorMistakeType: Partial<Record<Letter, MistakeType>>;
}

export interface QuestionSet {
  setId: number;
  title: string;
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

export interface SetProgress {
  status: Exclude<SetStatus, "not_started">;
  answers: Record<string, OptionKey[]>;
  currentIndex: number;
  correct: number;
  incorrect: number;
  notAttempted: number;
  startedAt: string;
  completedAt?: string;
  attemptNo: number;
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

export interface Progress {
  unlockedUpTo: number;
  sets: Record<string, SetProgress>;
  history: HistoryEntry[];
}

export type AnswerResult = "correct" | "incorrect" | "not_attempted";

export interface AnswerFeedback {
  result: AnswerResult;
  yourAnswer: OptionKey[];
  correct: Letter[];
  marks: number;
  explanation: string;
  score: number;
  answered: number;
  total: number;
  completed: boolean;
  nextUnlocked: number | null;
}
