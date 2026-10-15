import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getFullLengthSet, parseFullLengthSetId, fullLengthSetCount, fullLengthTrack } from "@/lib/full-length";
import { finalizeIfExpired, startPractice } from "@/lib/progress";
import { buildPracticeStart } from "@/lib/test-state";
import { FULL_LENGTH_DURATION_SECONDS } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Starts the Full Length Test's timed attempt, or resumes the one in progress and restarts its paused timer. Reports "completed" if time ran out meanwhile. */
export const POST = authed<Ctx>(async (_req, user, { params }) => {
  const setId = await parseFullLengthSetId((await params).id);
  const set = setId ? await getFullLengthSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const total = await fullLengthSetCount();
  const now = Date.now();
  const state = await updateProgress(user.id, (p) => {
    const track = fullLengthTrack(p);
    finalizeIfExpired(track, set, now, 0, total);
    return buildPracticeStart(set, startPractice(track, set, now, total, FULL_LENGTH_DURATION_SECONDS), now);
  });
  return json(state);
});
