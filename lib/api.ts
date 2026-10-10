import { NextResponse } from "next/server";
import { currentUser } from "./session";
import { ProgressError } from "./progress";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const fail = (error: string, status = 400) => json({ error }, status);

type User = { id: string; username: string };

/** Wraps a route handler: requires a session and turns thrown ProgressErrors into JSON errors. */
export function authed<C>(handler: (req: Request, user: User, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    const user = await currentUser();
    if (!user) return fail("Not logged in.", 401);
    try {
      return await handler(req, user, ctx);
    } catch (e) {
      if (e instanceof ProgressError) return fail(e.message, e.status);
      console.error(e);
      return fail("Something went wrong.", 500);
    }
  };
}
