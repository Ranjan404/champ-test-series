import bcrypt from "bcryptjs";
import { findUserByUsername } from "@/lib/store";
import { getSession } from "@/lib/session";
import { loginSchema } from "@/lib/schemas";
import { fail, json } from "@/lib/api";

// A fixed hash so unknown usernames cost the same time as wrong passwords.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Simple in-memory throttle: 10 failed attempts per username+IP per 15 minutes.
const failures = new Map<string, { count: number; until: number }>();
const WINDOW = 15 * 60 * 1000;

export async function POST(req: Request) {
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Enter your username and password.", 400);
  const { username, password } = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${username.toLowerCase()}|${ip}`;
  const f = failures.get(key);
  if (f && f.count >= 10 && f.until > Date.now()) return fail("Too many attempts. Try again in a few minutes.", 429);

  const user = await findUserByUsername(username);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    const cur = f && f.until > Date.now() ? f : { count: 0, until: Date.now() + WINDOW };
    failures.set(key, { count: cur.count + 1, until: cur.until });
    return fail("Wrong username or password.", 401);
  }
  failures.delete(key);

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  await session.save();
  return json({ ok: true, username: user.username });
}
