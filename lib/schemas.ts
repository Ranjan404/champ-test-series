import { z } from "zod";

const letter = z.enum(["A", "B", "C", "D"]);
const mistake = z.enum([
  "Conceptual",
  "Calculation",
  "Confusion Between Concepts",
  "Careless Error",
  "Question Misread",
  "Memory/Fact",
]);

const baseQuestionSchema = z.object({
  type: z.enum(["single", "multiple"]),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  topic: z.string().min(2),
  subtopic: z.string().min(2),
  concept: z.string().min(2),
  source: z.enum(["Generated", "PYQ"]),
  sourceRef: z.string().min(2),
  question: z.string().min(3),
  options: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
    E: z.literal("Not Attempted"),
  }),
  correct: z.array(letter).min(1).max(4),
  explanation: z.string().min(3),
  distractorMistakeType: z.partialRecord(letter, mistake),
});

export const questionSchema = baseQuestionSchema.extend({ id: z.string().regex(/^S\d{2}-Q\d{2}$/) });
/** Daily Question sets use D<set>-Q<n> ids so they can never collide with practice-set ids. */
export const dailyQuestionSchema = baseQuestionSchema.extend({ id: z.string().regex(/^D\d{2}-Q\d{2}$/) });

export const questionSetSchema = z.object({
  setId: z.number().int().min(1),
  title: z.string(),
  questions: z.array(questionSchema).length(25),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export const answerSchema = z.object({
  questionId: z.string().regex(/^S\d{2}-Q\d{2}$/),
  answer: z.array(z.enum(["A", "B", "C", "D", "E"])).min(1).max(4),
});

export const dailySetSchema = z.object({
  setId: z.number().int().min(1),
  title: z.string(),
  questions: z.array(dailyQuestionSchema).length(25),
});

const dailyQuestionId = z.string().regex(/^D\d{2}-Q\d{2}$/);
const dailyAnswers = z.record(dailyQuestionId, z.enum(["A", "B", "C", "D", "E"]));

export const dailySaveSchema = z.object({
  answers: dailyAnswers,
  marked: z.array(dailyQuestionId).max(25).default([]),
  current: z.number().int().min(0).max(24).default(0),
});

export const dailySubmitSchema = z.object({
  answers: dailyAnswers,
  marked: z.array(dailyQuestionId).max(25).default([]),
});
