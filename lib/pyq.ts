import fs from "node:fs/promises";
import path from "node:path";
import { pyqSetSchema } from "./schemas";
import type { PracticeTrack, Progress, QuestionSet } from "./types";
import { dataDir } from "./store";

// PYQ sets live in data/pyq_questions/set-01.json ... set-NN.json: previous-year Computer Science questions,
// 25 per set. They work like practice sets (timer, sequential unlock, retake) but are tracked separately in `progress.pyq`.

const cache = new Map<number, QuestionSet>();
let countCache: number | null = null;
const dir = () => path.join(dataDir(), "pyq_questions");
const prod = () => process.env.NODE_ENV === "production";

/** Number of consecutive PYQ set files present, starting at set-01. */
export async function pyqSetCount(): Promise<number> {
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

/** Parses a route param like "3" into a PYQ set number, or null. */
export async function parsePyqSetId(raw: string): Promise<number | null> {
  if (!/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= (await pyqSetCount()) ? n : null;
}

export async function getPyqSet(setId: number): Promise<QuestionSet | null> {
  if (!Number.isInteger(setId) || setId < 1 || setId > 99) return null;
  const hit = cache.get(setId);
  if (hit && prod()) return hit;
  const file = path.join(dir(), `set-${String(setId).padStart(2, "0")}.json`);
  try {
    const parsed = pyqSetSchema.parse(JSON.parse(await fs.readFile(file, "utf8"))) as QuestionSet;
    cache.set(setId, parsed);
    return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

export async function getAllPyqSets(): Promise<QuestionSet[]> {
  const count = await pyqSetCount();
  const sets = await Promise.all(Array.from({ length: count }, (_, i) => getPyqSet(i + 1)));
  return sets.filter((s): s is QuestionSet => s !== null);
}

/** The user's PYQ track, created on first use. Mutates `p` (call inside updateProgress, or on a copy you won't save). */
export function pyqTrack(p: Progress): PracticeTrack {
  return (p.pyq ??= { unlockedUpTo: 1, sets: {}, history: [] });
}
