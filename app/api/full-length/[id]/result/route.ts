import { authed, fail, json } from "@/lib/api";
import { getProgress } from "@/lib/store";
import { getAllFullLengthSets, getFullLengthSet, parseFullLengthSetId, fullLengthSetCount, fullLengthTrack } from "@/lib/full-length";
import { buildSetReport } from "@/lib/report";

type Ctx = { params: Promise<{ id: string }> };

export const GET = authed<Ctx>(async (_req, user, { params }) => {
  const setId = await parseFullLengthSetId((await params).id);
  const set = setId ? await getFullLengthSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const track = fullLengthTrack(await getProgress(user.id));
  if (track.sets[set.setId]?.status !== "completed") return fail("Finish the set to see its result.", 409);
  return json(buildSetReport(set, track, await getAllFullLengthSets(), await fullLengthSetCount()));
});
