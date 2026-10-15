import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getFullLengthSet, parseFullLengthSetId, fullLengthSetCount, fullLengthTrack } from "@/lib/full-length";
import { applyReset } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async (_req, user, { params }) => {
  const setId = await parseFullLengthSetId((await params).id);
  if (!setId || !(await getFullLengthSet(setId))) return fail("Set not found.", 404);
  const total = await fullLengthSetCount();
  await updateProgress(user.id, (p) => applyReset(fullLengthTrack(p), setId, total));
  return json({ ok: true });
});
