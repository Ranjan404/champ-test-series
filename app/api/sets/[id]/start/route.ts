import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getSet, parseSetId } from "@/lib/questions";
import { finalizeIfExpired, startPractice } from "@/lib/progress";
import { buildPracticeStart } from "@/lib/test-state";

type Ctx = { params: Promise<{ id: string }> };

/** Starts the set's timed attempt, or resumes the one in progress. Reports "completed" if time ran out meanwhile. */
export const POST = authed<Ctx>(async (_req, user, { params }) => {
  const setId = parseSetId((await params).id);
  const set = setId ? await getSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const now = Date.now();
  const state = await updateProgress(user.id, (p) => {
    finalizeIfExpired(p, set, now, 0);
    return buildPracticeStart(set, startPractice(p, set, now), now);
  });
  return json(state);
});
