import { authed, json } from "@/lib/api";
import { getProgress } from "@/lib/store";
import { getAllSets } from "@/lib/questions";
import { buildDashboard } from "@/lib/report";

export const GET = authed(async (_req, user) => {
  const [progress, sets] = await Promise.all([getProgress(user.id), getAllSets()]);
  return json(buildDashboard(progress, sets));
});
