import { authed, json } from "@/lib/api";
import { badRequest, sourceErrorResponse } from "@/lib/gk/respond";
import type { NotesResponse } from "@/lib/gk/types";
import { getStudyNotes, WIKIPEDIA_SOURCE } from "@/lib/gk/wikipedia";

// GET /api/gk/notes?section=bihar&lang=hi
// Study notes: introductions of the Wikipedia articles listed in lib/gk/topics.ts, in English or Hindi.
export const GET = authed(async (req) => {
  const params = new URL(req.url).searchParams;
  const section = params.get("section");
  const lang = params.get("lang") ?? "en";
  if (section !== "india" && section !== "bihar") return badRequest("section must be india or bihar.");
  if (lang !== "en" && lang !== "hi") return badRequest("lang must be en or hi.");

  try {
    const r = await getStudyNotes(section, lang);
    const body: NotesResponse = { section, lang, notes: r.value, source: WIKIPEDIA_SOURCE, fetchedAt: r.fetchedAt, stale: r.stale };
    return json(body);
  } catch (e) {
    return sourceErrorResponse(e, WIKIPEDIA_SOURCE.name);
  }
});
