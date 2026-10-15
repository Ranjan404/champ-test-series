import fs from "node:fs/promises";
import path from "node:path";
import { fullLengthSetSchema } from "./schemas";
import type { PracticeTrack, Progress, QuestionSet } from "./types";
import { dataDir } from "./store";

// Full Length Tests live in data/full_length_questions/set-01.json ... set-NN.json: 150 questions per set in three
// sections (Language, GK & GS, Computer Science). They work like practice sets (sequential unlock, retake, report)
// but have a 150-minute timer that pauses while the test is closed, tracked separately in `progress.fullLength`.

const cache = new Map<number, QuestionSet>();
let countCache: number | null = null;
const dir = () => path.join(dataDir(), "full_length_questions");
const prod = () => process.env.NODE_ENV === "production";

/** Number of consecutive Full Length Test files present, starting at set-01. */
export async function fullLengthSetCount(): Promise<number> {
  if (countCache !== null && prod()) return countCache;
  let files: string[] = [];
  try {
    files = await fs.readdir(dir());
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const ids = new Set(files.map((f) => f.match(/^set-(\d{2})\.json$/)?.[1]).filter(Boolean).map(Number));
  let n = 0;
  while (ids.has(n + 1)) n++;
  countCache = n;
  return n;
}

/** Parses a route param like "3" into a Full Length Test number, or null. */
export async function parseFullLengthSetId(raw: string): Promise<number | null> {
  if (!/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= (await fullLengthSetCount()) ? n : null;
}

export async function getFullLengthSet(setId: number): Promise<QuestionSet | null> {
  if (!Number.isInteger(setId) || setId < 1 || setId > 99) return null;
  const hit = cache.get(setId);
  if (hit && prod()) return hit;
  const file = path.join(dir(), `set-${String(setId).padStart(2, "0")}.json`);
  try {
    const parsed = fullLengthSetSchema.parse(JSON.parse(await fs.readFile(file, "utf8"))) as QuestionSet;
    cache.set(setId, parsed);
    return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function getAllFullLengthSets(): Promise<QuestionSet[]> {
  const count = await fullLengthSetCount();
  const sets = await Promise.all(Array.from({ length: count }, (_, i) => getFullLengthSet(i + 1)));
  return sets.filter((s): s is QuestionSet => s !== null);
}

/** The user's Full Length Test track, created on first use. Mutates `p` (call inside updateProgress, or on a copy you won't save). */
export function fullLengthTrack(p: Progress): PracticeTrack {
  return (p.fullLength ??= { unlockedUpTo: 1, sets: {}, history: [] });
}
