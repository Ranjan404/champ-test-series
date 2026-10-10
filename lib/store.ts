import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Progress, User } from "./types";

/** Root of the JSON files (questions always; users and progress when Supabase is off). Overridable so tests can use a temp folder. */
export function dataDir() {
  return process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(process.cwd(), "data");
}

/** Users and progress go to Supabase when it is configured, unless DATA_DIR asks for files (tests do). */
const useSupabase = () => !!process.env.SUPABASE_URL && !process.env.DATA_DIR;

let client: SupabaseClient | null = null;
function sb() {
  if (!client) {
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!key) throw new Error("SUPABASE_URL is set but SUPABASE_SECRET_KEY is missing");
    client = createClient(process.env.SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

const usersFile = () => path.join(dataDir(), "users.json");
const progressFile = (userId: string) => {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error("invalid user id");
  return path.join(dataDir(), "progress", `${userId}.json`);
};

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}

/** Write to a temp file in the same folder, then rename, so a crash never leaves half a file. */
async function writeJsonAtomic(file: string, value: unknown) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, file);
}

// One promise chain per key: read-modify-write calls on the same file/row run one at a time in this process.
const locks = new Map<string, Promise<unknown>>();
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  try {
    return await run;
  } finally {
    if (locks.get(key) === tail) locks.delete(key);
  }
}

export const emptyProgress = (): Progress => ({ unlockedUpTo: 1, sets: {}, history: [] });

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}
const fromRow = (r: UserRow): User => ({ id: r.id, username: r.username, passwordHash: r.password_hash, createdAt: r.created_at });
const toRow = (u: User): UserRow => ({ id: u.id, username: u.username, password_hash: u.passwordHash, created_at: u.createdAt });

export async function getUsers(): Promise<User[]> {
  if (!useSupabase()) return readJson<User[]>(usersFile(), []);
  const { data, error } = await sb().from("users").select("*");
  if (error) throw error;
  return (data as UserRow[]).map(fromRow);
}

export async function findUserByUsername(username: string) {
  if (!useSupabase()) {
    const users = await getUsers();
    return users.find((u) => u.username.toLowerCase() === username.toLowerCase()) ?? null;
  }
  // ilike = case-insensitive match; escape its wildcards so "a_b" can't match "axb".
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .ilike("username", username.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as UserRow) : null;
}

/** `fn` gets every user and returns the new list. In Supabase, returned users are upserted (removals are not deleted). */
export async function updateUsers(fn: (users: User[]) => User[] | Promise<User[]>) {
  return withLock(usersFile(), async () => {
    const next = await fn(await getUsers());
    if (useSupabase()) {
      const { error } = await sb().from("users").upsert(next.map(toRow));
      if (error) throw error;
    } else {
      await writeJsonAtomic(usersFile(), next);
    }
    return next;
  });
}

export async function getProgress(userId: string): Promise<Progress> {
  if (!useSupabase()) return readJson<Progress>(progressFile(userId), emptyProgress());
  const { data, error } = await sb().from("progress").select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.data as Progress | undefined) ?? emptyProgress();
}

/**
 * Locked read-modify-write of one user's progress. `fn` may mutate the object it gets
 * and returns a result for the caller; the progress is saved only if `fn` doesn't throw.
 */
export async function updateProgress<T>(userId: string, fn: (p: Progress) => T | Promise<T>): Promise<T> {
  const file = progressFile(userId);
  return withLock(file, async () => {
    if (!useSupabase()) {
      const progress = await readJson<Progress>(file, emptyProgress());
      const result = await fn(progress);
      await writeJsonAtomic(file, progress);
      return result;
    }
    // Optimistic concurrency: the save only lands if `version` is unchanged since the read,
    // so two server instances can't overwrite each other. On a clash, re-read and run `fn` again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: row, error } = await sb()
        .from("progress")
        .select("data, version")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      const progress = (row?.data as Progress | undefined) ?? emptyProgress();
      const result = await fn(progress);
      const updatedAt = new Date().toISOString();
      if (row) {
        const { data: saved, error: saveError } = await sb()
          .from("progress")
          .update({ data: progress, version: row.version + 1, updated_at: updatedAt })
          .eq("user_id", userId)
          .eq("version", row.version)
          .select("user_id");
        if (saveError) throw saveError;
        if (saved.length) return result;
      } else {
        const { error: insertError } = await sb()
          .from("progress")
          .insert({ user_id: userId, data: progress, updated_at: updatedAt });
        if (!insertError) return result;
        if (insertError.code !== "23505") throw insertError; // 23505 = someone inserted first; retry
      }
    }
    throw new Error("Could not save progress: too many concurrent updates");
  });
}
