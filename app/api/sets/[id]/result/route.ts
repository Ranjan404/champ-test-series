import { authed, fail, json } from "@/lib/api";
import { getProgress } from "@/lib/store";
import { getAllSets, getSet, parseSetId } from "@/lib/questions";
import { buildSetReport } from "@/lib/report";

type Ctx = { params: Promise<{ id: string }> };

export const GET = authed<Ctx>(async (_req, user, { params }) => {
  const setId = parseSetId((await params).id);
  const set = setId ? await getSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const progress = await getProgress(user.id);
  if (progress.sets[set.setId]?.status !== "completed") return fail("Finish the set to see its result.", 409);
  return json(buildSetReport(set, progress, await getAllSets()));
});
