import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { fullLengthSetCount, fullLengthTrack, getFullLengthSet, parseFullLengthSetId } from "@/lib/full-length";
import { fullLengthSaveSchema } from "@/lib/schemas";
import { finalizeIfExpired, PRACTICE_SUBMIT_GRACE_MS, pausePractice } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Stops the timer: the candidate pressed Pause, left the page, switched apps or closed the tab (sent as a beacon).
 * Stores the answers on screen too, when they come with it.
 */
export const POST = authed<Ctx>(async (req, user, { params }) => {
  const setId = await parseFullLengthSetId((await params).id);
  const set = setId ? await getFullLengthSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const body = fullLengthSaveSchema.safeParse(await req.json().catch(() => null));
  const total = await fullLengthSetCount();
  const result = await updateProgress(user.id, (p) => {
    const track = fullLengthTrack(p);
    const expired = finalizeIfExpired(track, set, Date.now(), PRACTICE_SUBMIT_GRACE_MS, total);
    if (expired) return { expired: true as const, setId: expired.setId };
    pausePractice(track, set, body.success ? body.data : null);
    return { expired: false as const, pausedAt: new Date().toISOString() };
  });
  return json(result, result.expired ? 409 : 200);
});
