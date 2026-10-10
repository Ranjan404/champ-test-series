import { authed, fail, json } from "@/lib/api";
import { getProgress } from "@/lib/store";
import { getSet, parseSetId } from "@/lib/questions";
import { isUnlocked } from "@/lib/progress";
import { buildTestState } from "@/lib/test-state";

type Ctx = { params: Promise<{ id: string }> };

export const GET = authed<Ctx>(async (_req, user, { params }) => {
  const setId = parseSetId((await params).id);
  const set = setId ? await getSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const progress = await getProgress(user.id);
  if (!isUnlocked(progress, set.setId)) return fail("This set is locked.", 403);
  return json(buildTestState(set, progress));
});
