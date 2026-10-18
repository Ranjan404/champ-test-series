import { authed, json } from "@/lib/api";
import { getOpenTdbQuestions, OPENTDB_SOURCE } from "@/lib/gk/opentdb";
import { badRequest, sourceErrorResponse } from "@/lib/gk/respond";
import { QUIZ_AMOUNTS, QUIZ_CATEGORIES, type QuestionsResponse, type QuizCategoryId } from "@/lib/gk/types";

// GET /api/gk/questions?category=history&amount=10
// Multiple-choice questions from the Open Trivia Database, served from a 30-minute in-memory pool.
// Nothing is stored: the quiz, answers and score live only in the browser tab.
export const GET = authed(async (req) => {
  const params = new URL(req.url).searchParams;
  const category = params.get("category") ?? "general";
  const amount = Number(params.get("amount") ?? 10);
  if (!QUIZ_CATEGORIES.some((c) => c.id === category)) return badRequest("Unknown category.");
  if (!(QUIZ_AMOUNTS as readonly number[]).includes(amount)) return badRequest(`amount must be one of ${QUIZ_AMOUNTS.join(", ")}.`);

  try {
    const r = await getOpenTdbQuestions(category as QuizCategoryId, amount);
    const body: QuestionsResponse = {
      questions: r.value,
      category: category as QuizCategoryId,
      source: OPENTDB_SOURCE,
      fetchedAt: r.fetchedAt,
      stale: r.stale,
    };
    return json(body);
  } catch (e) {
    return sourceErrorResponse(e, OPENTDB_SOURCE.name);
  }
});
