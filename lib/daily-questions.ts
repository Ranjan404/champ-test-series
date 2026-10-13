import fs from "node:fs/promises";
import path from "node:path";
import { dailySetSchema } from "./schemas";
import type { QuestionSet } from "./types";
import { dataDir } from "./store";
import { dailySetFor, istDateKey } from "./daily";

// Daily Question sets live in data/dailyquestions/set-01.json ... set-NN.json. Adding a file adds it to the rotation.

const cache = new Map<number, QuestionSet>();
let countCache: number | null = null;
const dir = () => path.join(dataDir(), "dailyquestions");
const prod = () => process.env.NODE_ENV === "production";

/** Number of consecutive daily set files present, starting at set-01. */
export async function dailySetCount(): Promise<number> {
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

export async function getDailySet(setId: number): Promise<QuestionSet | null> {
  if (!Number.isInteger(setId) || setId < 1 || setId > 99) return null;
  const hit = cache.get(setId);
  if (hit && prod()) return hit;
  const file = path.join(dir(), `set-${String(setId).padStart(2, "0")}.json`);
  try {
    const parsed = dailySetSchema.parse(JSON.parse(await fs.readFile(file, "utf8"))) as QuestionSet;
    cache.set(setId, parsed);
    return parsed;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** The set of the day (IST). */
export async function getTodaysDailySet(now = new Date()) {
  const id = dailySetFor(istDateKey(now), await dailySetCount());
  return id ? getDailySet(id) : null;
}
