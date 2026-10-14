import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getPyqSet, parsePyqSetId, pyqSetCount, pyqTrack } from "@/lib/pyq";
import { finalizeIfExpired, startPractice } from "@/lib/progress";
import { buildPracticeStart } from "@/lib/test-state";

type Ctx = { params: Promise<{ id: string }> };

/** Starts the PYQ set's timed attempt, or resumes the one in progress. Reports "completed" if time ran out meanwhile. */
export const POST = authed<Ctx>(async (_req, user, { params }) => {
  const setId = await parsePyqSetId((await params).id);
  const set = setId ? await getPyqSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const total = await pyqSetCount();
  const now = Date.now();
  const state = await updateProgress(user.id, (p) => {
    const track = pyqTrack(p);
    finalizeIfExpired(track, set, now, 0, total);
    return buildPracticeStart(set, startPractice(track, set, now, total), now);
  });
  return json(state);
});
