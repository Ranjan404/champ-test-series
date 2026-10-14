import { authed, json } from "@/lib/api";
import { getProgress } from "@/lib/store";
import { getAllPyqSets, pyqSetCount, pyqTrack } from "@/lib/pyq";
import { buildSetList } from "@/lib/report";

export const GET = authed(async (_req, user) => {
  const [progress, sets, total] = await Promise.all([getProgress(user.id), getAllPyqSets(), pyqSetCount()]);
  const track = pyqTrack(progress);
  return json({ unlockedUpTo: track.unlockedUpTo, sets: buildSetList(track, sets, total) });
});
