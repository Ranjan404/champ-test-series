import { authed, json } from "@/lib/api";
import { getProgress } from "@/lib/store";
import { getAllSets } from "@/lib/questions";
import { buildSetList } from "@/lib/report";

export const GET = authed(async (_req, user) => {
  const [progress, sets] = await Promise.all([getProgress(user.id), getAllSets()]);
  return json({ unlockedUpTo: progress.unlockedUpTo, sets: buildSetList(progress, sets) });
});
