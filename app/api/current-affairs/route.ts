import { authed, json } from "@/lib/api";
import { getPibNews, PIB_SOURCE } from "@/lib/gk/pib";
import { badRequest, sourceErrorResponse } from "@/lib/gk/respond";
import type { NewsResponse } from "@/lib/gk/types";

// GET /api/current-affairs?region=bihar&lang=en
// Latest press releases from PIB (Delhi for India, Patna for Bihar). These are news to read, not quiz questions.
export const GET = authed(async (req) => {
  const params = new URL(req.url).searchParams;
  const region = params.get("region") ?? "india";
  const lang = params.get("lang") ?? "en";
  if (region !== "india" && region !== "bihar") return badRequest("region must be india or bihar.");
  if (lang !== "en" && lang !== "hi") return badRequest("lang must be en or hi.");

  try {
    const r = await getPibNews(region, lang);
    const dated = r.value.map((i) => i.publishedAt).filter((d): d is string => !!d);
    const body: NewsResponse = {
      region,
      lang,
      items: r.value,
      source: PIB_SOURCE,
      fetchedAt: r.fetchedAt,
      stale: r.stale,
      newestAt: dated.length ? dated.reduce((a, b) => (a > b ? a : b)) : null,
    };
    return json(body);
  } catch (e) {
    return sourceErrorResponse(e, PIB_SOURCE.name);
  }
});
