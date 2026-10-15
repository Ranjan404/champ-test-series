import { authed, json } from "@/lib/api";
import { getProgress } from "@/lib/store";
import { getAllFullLengthSets, fullLengthSetCount, fullLengthTrack } from "@/lib/full-length";
import { buildSetList } from "@/lib/report";

export const GET = authed(async (_req, user) => {
  const [progress, sets, total] = await Promise.all([getProgress(user.id), getAllFullLengthSets(), fullLengthSetCount()]);
  const track = fullLengthTrack(progress);
  return json({ unlockedUpTo: track.unlockedUpTo, sets: buildSetList(track, sets, total) });
});
