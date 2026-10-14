import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getPyqSet, parsePyqSetId, pyqSetCount, pyqTrack } from "@/lib/pyq";
import { pyqSaveSchema } from "@/lib/schemas";
import { finalizeIfExpired, PRACTICE_SUBMIT_GRACE_MS, savePractice } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

/** Save & Next / Previous / palette jump: stores the answers so far on the server. */
export const POST = authed<Ctx>(async (req, user, { params }) => {
  const setId = await parsePyqSetId((await params).id);
  const set = setId ? await getPyqSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const body = pyqSaveSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("Invalid answers.", 400);
  const total = await pyqSetCount();
  const result = await updateProgress(user.id, (p) => {
    const track = pyqTrack(p);
    // Out of time: close the attempt with what was saved before (the save itself must not land, so no throw here).
    const expired = finalizeIfExpired(track, set, Date.now(), PRACTICE_SUBMIT_GRACE_MS, total);
    if (expired) return { expired: true as const, setId: expired.setId };
    savePractice(track, set, body.data);
    return { expired: false as const, savedAt: new Date().toISOString() };
  });
  return json(result, result.expired ? 409 : 200);
});
