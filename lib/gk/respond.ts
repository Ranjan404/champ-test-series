import { json } from "@/lib/api";
import { SourceError } from "./http";
import type { GkApiError } from "./types";

const STATUS: Record<SourceError["kind"], number> = {
  timeout: 504,
  network: 502,
  http: 502,
  invalid: 502,
  empty: 404,
  rate_limited: 429,
};

/** Turns a SourceError into the JSON error every GK/GS route answers with. Other errors are rethrown (authed() logs them). */
export function sourceErrorResponse(e: unknown, sourceName: string) {
  if (!(e instanceof SourceError)) throw e;
  const body: GkApiError = { error: `${sourceName}: ${e.message}`, code: e.kind };
  const res = json(body, STATUS[e.kind]);
  if (e.retryAfter) res.headers.set("Retry-After", String(e.retryAfter));
  return res;
}

export const badRequest = (error: string) => json({ error, code: "bad_request" } satisfies GkApiError, 400);
