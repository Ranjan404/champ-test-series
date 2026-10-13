import { authed, json } from "@/lib/api";
import { getProgress, updateProgress } from "@/lib/store";
import { attemptDeadline, buildDailyState, finalizeIfExpired, SUBMIT_GRACE_MS } from "@/lib/daily";
import { getDailySet, getTodaysDailySet } from "@/lib/daily-questions";

export const GET = authed(async (_req, user) => {
  const todaySet = await getTodaysDailySet();
  let progress = await getProgress(user.id);
  const running = progress.daily?.attempt;
  let attemptSet = running ? await getDailySet(running.setId) : null;
  // Time ran out while the page was closed: submit what was saved, so the attempt shows up in history.
  if (running && attemptSet && Date.now() >= attemptDeadline(running) + SUBMIT_GRACE_MS) {
    const set = attemptSet;
    progress = await updateProgress(user.id, (p) => {
      finalizeIfExpired(p, set);
      return p;
    });
    if (!progress.daily?.attempt) attemptSet = null;
  }
  return json(buildDailyState(progress, todaySet, attemptSet));
});
