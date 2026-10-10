import fs from "node:fs/promises";
import path from "node:path";
import { questionSetSchema } from "./schemas";
import type { PublicQuestion, Question, QuestionSet } from "./types";
import { TOTAL_SETS } from "./types";
import { dataDir } from "./store";

const cache = new Map<number, QuestionSet>();

export function isValidSetId(id: number) {
  return Number.isInteger(id) && id >= 1 && id <= TOTAL_SETS;
}

/** Parses a route param like "3" into a set number, or null. */
export function parseSetId(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return isValidSetId(n) ? n : null;
}

export async function getSet(setId: number): Promise<QuestionSet | null> {
  if (!isValidSetId(setId)) return null;
  const hit = cache.get(setId);
  if (hit && process.env.NODE_ENV === "production") return hit;
  const file = path.join(dataDir(), "questions", `set-${String(setId).padStart(2, "0")}.json`);
  try {
    const parsed = questionSetSchema.parse(JSON.parse(await fs.readFile(file, "utf8"))) as QuestionSet;
    cache.set(setId, parsed);
    return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function getAllSets(): Promise<QuestionSet[]> {
  const sets = await Promise.all(Array.from({ length: TOTAL_SETS }, (_, i) => getSet(i + 1)));
  return sets.filter((s): s is QuestionSet => s !== null);
}

export function toPublic(q: Question): PublicQuestion {
  return { id: q.id, type: q.type, question: q.question, options: q.options };
}
