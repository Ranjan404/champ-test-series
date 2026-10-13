import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getSet, parseSetId } from "@/lib/questions";
import { practiceSaveSchema } from "@/lib/schemas";
import { finalizeIfExpired, savePractice } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

/** Save & Next / Previous / palette jump: stores the answers so far on the server. */
export const POST = authed<Ctx>(async (req, user, { params }) => {
  const setId = parseSetId((await params).id);
  const set = setId ? await getSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const body = practiceSaveSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("Invalid answers.", 400);
  const result = await updateProgress(user.id, (p) => {
    // Out of time: close the attempt with what was saved before (the save itself must not land, so no throw here).
    const expired = finalizeIfExpired(p, set);
    if (expired) return { expired: true as const, setId: expired.setId };
    savePractice(p, set, body.data);
    return { expired: false as const, savedAt: new Date().toISOString() };
  });
  return json(result, result.expired ? 409 : 200);
});
