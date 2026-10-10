// Copies data/users.json and data/progress/*.json into Supabase. Usage:
//   npm run migrate-to-supabase
// Run supabase/schema.sql first. Safe to re-run: users are upserted, and progress
// rows that already exist in Supabase are left alone.
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Progress, User } from "../lib/types";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const dir = path.join(process.cwd(), "data");

  const users: User[] = JSON.parse(await fs.readFile(path.join(dir, "users.json"), "utf8").catch(() => "[]"));
  if (users.length) {
    const { error } = await db.from("users").upsert(
      users.map((u) => ({ id: u.id, username: u.username, password_hash: u.passwordHash, created_at: u.createdAt })),
    );
    if (error) throw error;
  }
  console.log(`Users: ${users.length} copied.`);

  const files = (await fs.readdir(path.join(dir, "progress")).catch(() => [])).filter((f) => f.endsWith(".json"));
  let copied = 0;
  for (const f of files) {
    const data: Progress = JSON.parse(await fs.readFile(path.join(dir, "progress", f), "utf8"));
    const { error } = await db
      .from("progress")
      .upsert({ user_id: f.replace(/\.json$/, ""), data }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw error;
    copied++;
  }
  console.log(`Progress: ${copied} file(s) copied.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  if (e.code === "PGRST205" || e.code === "42P01") console.error("Tables are missing: run supabase/schema.sql in the Supabase SQL Editor.");
  process.exit(1);
});
