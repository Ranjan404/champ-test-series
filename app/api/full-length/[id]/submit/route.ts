import { authed, fail, json } from "@/lib/api";
import { updateProgress } from "@/lib/store";
import { getFullLengthSet, parseFullLengthSetId, fullLengthSetCount, fullLengthTrack } from "@/lib/full-length";
import { fullLengthSubmitSchema } from "@/lib/schemas";
import { submitPractice } from "@/lib/progress";

type Ctx = { params: Promise<{ id: string }> };

/** Scores the attempt. Correct answers and explanations are only revealed afterwards, on the result page. */
export const POST = authed<Ctx>(async (req, user, { params }) => {
  const setId = await parseFullLengthSetId((await params).id);
  const set = setId ? await getFullLengthSet(setId) : null;
  if (!set) return fail("Set not found.", 404);
  const body = fullLengthSubmitSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("Invalid answers.", 400);
  const total = await fullLengthSetCount();
  return json(await updateProgress(user.id, (p) => submitPractice(fullLengthTrack(p), set, body.data.answers, Date.now(), total)));
});
