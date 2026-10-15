import { getSession } from "@/lib/session";
import { json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { pauseAllPractice } from "@/lib/progress";

export async function POST() {
  const session = await getSession();
  // A Full Length Test left running stops its clock on logout.
  if (session.userId) {
    await updateProgress(session.userId, (p) => {
      if (p.fullLength) pauseAllPractice(p.fullLength);
    }).catch(() => null);
  }
  session.destroy();
  return json({ ok: true });
}
