import { authed, fail, json } from "@/lib/api";
import { getProgress } from "@/lib/store";
import { getAllPyqSets, getPyqSet, parsePyqSetId, pyqSetCount, pyqTrack } from "@/lib/pyq";
import { buildSetReport } from "@/lib/report";

type Ctx = { params: Promise<{ id: string }> };

export const GET = authed<Ctx>(async (_req, user, { params }) => {
  const setId = await parsePyqSetId((await params).id);
  const set = setId ? await getPyqSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const track = pyqTrack(await getProgress(user.id));
  if (track.sets[set.setId]?.status !== "completed") return fail("Finish the set to see its result.", 409);
  return json(buildSetReport(set, track, await getAllPyqSets(), await pyqSetCount()));
});
