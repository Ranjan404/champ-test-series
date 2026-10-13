import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getSet, parseSetId } from "@/lib/questions";
import { practiceSubmitSchema } from "@/lib/schemas";
import { submitPractice } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

/** Scores the attempt. Correct answers and explanations are only revealed afterwards, on the result page. */
export const POST = authed<Ctx>(async (req, user, { params }) => {
  const setId = parseSetId((await params).id);
  const set = setId ? await getSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const body = practiceSubmitSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("Invalid answers.", 400);
  return json(await updateProgress(user.id, (p) => submitPractice(p, set, body.data.answers)));
});
