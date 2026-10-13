import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { buildDailyState, finalizeIfExpired, istDateKey, startDaily } from "@/lib/daily";
import { getDailySet, getTodaysDailySet } from "@/lib/daily-questions";

/** Starts today's daily test, or resumes the attempt already running. */
export const POST = authed(async (_req, user) => {
  const now = Date.now();
  const todaySet = await getTodaysDailySet(new Date(now));
  if (!todaySet) return fail("No daily question set is available yet.", 404);
  const state = await updateProgress(user.id, async (p) => {
    const running = p.daily?.attempt;
    const runningSet = running ? await getDailySet(running.setId) : null;
    if (runningSet) finalizeIfExpired(p, runningSet, now, 0);
    else if (running) p.daily!.attempt = null; // its set file is gone
    const a = startDaily(p, todaySet, istDateKey(new Date(now)), now);
    const attemptSet = a.setId === todaySet.setId ? todaySet : runningSet;
    return buildDailyState(p, todaySet, attemptSet, now);
  });
  return json(state);
});
