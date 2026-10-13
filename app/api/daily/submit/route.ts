import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { dailySubmitSchema } from "@/lib/schemas";
import { submitDaily, summarise } from "@/lib/daily";
import { getDailySet } from "@/lib/daily-questions";
import { ProgressError } from "@/lib/progress";

/** Scores the running attempt. Correct answers are only revealed afterwards, on the result page. */
export const POST = authed(async (req, user) => {
  const body = dailySubmitSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("Invalid answers.", 400);
  const entry = await updateProgress(user.id, async (p) => {
    const a = p.daily?.attempt;
    const set = a ? await getDailySet(a.setId) : null;
    if (!a || !set) throw new ProgressError("This attempt was already submitted.", 409);
    return submitDaily(p, set, body.data.answers);
  });
  return json(summarise(entry));
});
