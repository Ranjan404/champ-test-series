import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getSet, parseSetId } from "@/lib/questions";
import { answerSchema } from "@/lib/schemas";
import { applyAnswer } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

export const POST = authed<Ctx>(async (req, user, { params }) => {
  const setId = parseSetId((await params).id);
  const set = setId ? await getSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const body = answerSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("Invalid answer.", 400);
  const feedback = await updateProgress(user.id, (p) => applyAnswer(p, set, body.data.questionId, body.data.answer));
  return json(feedback);
});
