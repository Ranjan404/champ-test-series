import { getSession } from "@/lib/session";
import { json } from "@/lib/api";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return json({ ok: true });
}
