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

const practiceQuestionId = z.string().regex(/^S\d{2}-Q\d{2}$/);
const practiceAnswers = z.record(practiceQuestionId, z.array(z.enum(["A", "B", "C", "D", "E"])).max(4));

export const practiceSaveSchema = z.object({
  answers: practiceAnswers,
  marked: z.array(practiceQuestionId).max(25).default([]),
  current: z.number().int().min(0).max(24).default(0),
});

export const practiceSubmitSchema = z.object({
  answers: practiceAnswers,
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

/** PYQ sets use P<set>-Q<n> ids so they can never collide with practice-set or daily ids. */
export const pyqQuestionSchema = baseQuestionSchema.extend({ id: z.string().regex(/^P\d{2}-Q\d{2}$/) });

export const pyqSetSchema = z.object({
  setId: z.number().int().min(1),
  title: z.string(),
  questions: z.array(pyqQuestionSchema).length(25),
});

const pyqQuestionId = z.string().regex(/^P\d{2}-Q\d{2}$/);
const pyqAnswers = z.record(pyqQuestionId, z.array(z.enum(["A", "B", "C", "D", "E"])).max(4));

export const pyqSaveSchema = z.object({
  answers: pyqAnswers,
  marked: z.array(pyqQuestionId).max(25).default([]),
  current: z.number().int().min(0).max(24).default(0),
});

export const pyqSubmitSchema = z.object({
  answers: pyqAnswers,
});

/** Full Length Tests use F<set>-Q<nnn> ids (150 questions per set). */
const fullLengthQuestionId = z.string().regex(/^F\d{2}-Q\d{3}$/);
export const fullLengthQuestionSchema = baseQuestionSchema.extend({
  id: fullLengthQuestionId,
  source: z.enum(["Generated", "PYQ", "Full Length Test"]),
});

export const fullLengthSetSchema = z.object({
  setId: z.number().int().min(1),
  title: z.string(),
  sections: z.array(z.object({ name: z.string().min(1), from: z.number().int().min(1), to: z.number().int().min(1) })).optional(),
  questions: z.array(fullLengthQuestionSchema).length(150),
});

const fullLengthAnswers = z.record(fullLengthQuestionId, z.array(z.enum(["A", "B", "C", "D", "E"])).max(4));

export const fullLengthSaveSchema = z.object({
  answers: fullLengthAnswers,
  marked: z.array(fullLengthQuestionId).max(150).default([]),
  current: z.number().int().min(0).max(149).default(0),
});

export const fullLengthSubmitSchema = z.object({
  answers: fullLengthAnswers,
});
