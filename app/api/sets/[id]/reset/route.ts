import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getSet, parseSetId } from "@/lib/questions";
import { applyReset } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async (_req, user, { params }) => {
  const setId = parseSetId((await params).id);
  if (!setId || !(await getSet(setId))) return fail("Set not found.", 404);
  await updateProgress(user.id, (p) => applyReset(p, setId));
  return json({ ok: true });
});
