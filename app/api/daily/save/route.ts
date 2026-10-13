import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { dailySaveSchema } from "@/lib/schemas";
import { finalizeIfExpired, saveDaily } from "@/lib/daily";
import { getDailySet } from "@/lib/daily-questions";
import { ProgressError } from "@/lib/progress";

/** Save & Next / Previous / palette jump: stores the answers so far on the server. */
export const POST = authed(async (req, user) => {
  const body = dailySaveSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("Invalid answers.", 400);
  const result = await updateProgress(user.id, async (p) => {
    const a = p.daily?.attempt;
    const set = a ? await getDailySet(a.setId) : null;
    if (!a || !set) throw new ProgressError("No daily test in progress. Start it again from the Daily Question page.", 409);
    // Out of time: close the attempt with what was saved before (the save itself must not land, so no throw here).
    const expired = finalizeIfExpired(p, set);
    if (expired) return { expired: true as const, attemptNo: expired.attemptNo, date: expired.date };
    saveDaily(p, set, body.data);
    return { expired: false as const, savedAt: new Date().toISOString() };
  });
  return json(result, result.expired ? 409 : 200);
});
