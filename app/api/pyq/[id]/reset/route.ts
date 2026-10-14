import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getPyqSet, parsePyqSetId, pyqSetCount, pyqTrack } from "@/lib/pyq";
import { applyReset } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async (_req, user, { params }) => {
  const setId = await parsePyqSetId((await params).id);
  if (!setId || !(await getPyqSet(setId))) return fail("Set not found.", 404);
  const total = await pyqSetCount();
  await updateProgress(user.id, (p) => applyReset(pyqTrack(p), setId, total));
  return json({ ok: true });
});
