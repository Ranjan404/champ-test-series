import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface SessionData {
  userId?: string;
  username?: string;
}

export const SESSION_COOKIE = "cts_session";

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters (see .env.example).");
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    ttl: 60 * 60 * 24 * 7,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

/** For server components and route handlers: the logged-in user, or null. */
export async function currentUser() {
  const s = await getSession();
  return s.userId && s.username ? { id: s.userId, username: s.username } : null;
}

/** For pages: the logged-in user, or a redirect to /login. */
export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
