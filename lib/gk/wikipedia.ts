import { z } from "zod";
import { cached, type Cached } from "./cache";
import { cleanText, fetchJson, SourceError } from "./http";
import { NOTE_GROUPS } from "./topics";
import type { GkLang, NotesSection, SourceInfo, StudyNote } from "./types";

// Wikipedia (English and Hindi editions) via the MediaWiki Action API: the plain-text introduction of each article
// listed in topics.ts. Text is CC BY-SA 4.0 and is shown with attribution and a link to the article.
// English and Hindi articles are written independently, so they can differ; the UI says so.

export const WIKIPEDIA_SOURCE: SourceInfo = {
  name: "Wikipedia",
  url: "https://www.wikipedia.org",
  license: "CC BY-SA 4.0",
};

const TTL_MS = 12 * 60 * 60_000;
const MAX_STALE_MS = 7 * 24 * 60 * 60_000;
const TIMEOUT_MS = 12_000;
/** MediaWiki returns at most 20 intro extracts per request. */
const BATCH = 20;
/** Intros can run to several paragraphs; keep the first ones up to about this many characters. */
const MAX_EXTRACT = 1_400;

const apiSchema = z.object({
  query: z
    .object({
      normalized: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      redirects: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      pages: z.array(
        z.object({
          title: z.string(),
          missing: z.boolean().optional(),
          invalid: z.boolean().optional(),
          extract: z.string().optional(),
          fullurl: z.string().optional(),
        }),
      ),
    })
    .optional(),
});

const articleUrl = (lang: GkLang, title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

/** Keeps whole paragraphs (or, for a long first paragraph, whole sentences) up to MAX_EXTRACT characters. */
export function trimExtract(text: string): string {
  const paras = text
    .split(/\n+/)
    .map((p) => cleanText(p))
    .filter(Boolean);
  let out = "";
  for (const p of paras) {
    if (!out) out = p;
    else if (out.length + p.length + 2 <= MAX_EXTRACT) out += "\n\n" + p;
    else break;
  }
  if (out.length <= MAX_EXTRACT) return out;
  const cut = out.slice(0, MAX_EXTRACT);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("। "));
  return (end > 200 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "")) + " …";
}

/** Parses one API response into title -> {extract, url}, following normalisation and redirects. */
export function parseExtracts(body: unknown, lang: GkLang, requested: string[]) {
  const parsed = apiSchema.safeParse(body);
  if (!parsed.success || !parsed.data.query) throw new SourceError("invalid", "Wikipedia returned an unexpected response.");
  const q = parsed.data.query;
  const hop = new Map<string, string>();
  for (const m of [...(q.normalized ?? []), ...(q.redirects ?? [])]) hop.set(m.from, m.to);
  const resolve = (t: string) => {
    let cur = t;
    for (let i = 0; i < 3 && hop.has(cur); i++) cur = hop.get(cur)!;
    return cur;
  };
  const pages = new Map(q.pages.map((p) => [p.title, p]));
  const out = new Map<string, { title: string; extract: string; url: string } | null>();
  for (const t of requested) {
    const p = pages.get(resolve(t));
    const extract = p && !p.missing && !p.invalid && p.extract ? trimExtract(p.extract) : "";
    out.set(t, extract ? { title: p!.title, extract, url: p!.fullurl ?? articleUrl(lang, p!.title) } : null);
  }
  return out;
}

async function fetchExtracts(lang: GkLang, titles: string[]) {
  const results = new Map<string, { title: string; extract: string; url: string } | null>();
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      redirects: "1",
      prop: "extracts|info",
      exintro: "1",
      explaintext: "1",
      exlimit: String(BATCH),
      inprop: "url",
      titles: batch.join("|"),
    });
    const body = await fetchJson(`https://${lang}.wikipedia.org/w/api.php?${params}`, { timeoutMs: TIMEOUT_MS });
    for (const [k, v] of parseExtracts(body, lang, batch)) results.set(k, v);
  }
  return results;
}

async function loadNotes(section: NotesSection, lang: GkLang): Promise<StudyNote[]> {
  const groups = NOTE_GROUPS[section];
  const topics = groups.flatMap((g) => g.topics.map((t) => ({ ...t, group: g.id })));
  const wanted = topics.map((t) => (lang === "hi" ? t.hi : t.en)).filter((t): t is string => !!t);
  const extracts = await fetchExtracts(lang, wanted);
  const notes = topics.map<StudyNote>((t) => {
    const title = lang === "hi" ? t.hi : t.en;
    if (!title) {
      return { key: t.en, group: t.group, status: "no-article", title: t.en, extract: null, url: articleUrl("en", t.en), englishUrl: articleUrl("en", t.en), lang };
    }
    const hit = extracts.get(title);
    return hit
      ? { key: t.en, group: t.group, status: "ok", title: hit.title, extract: hit.extract, url: hit.url, lang }
      : { key: t.en, group: t.group, status: "missing", title, extract: null, url: articleUrl(lang, title), lang };
  });
  if (!notes.some((n) => n.status === "ok")) throw new SourceError("empty", "Wikipedia returned no article text.");
  return notes;
}

export function getStudyNotes(section: NotesSection, lang: GkLang): Promise<Cached<StudyNote[]>> {
  return cached(`wiki:${section}:${lang}`, { ttlMs: TTL_MS, maxStaleMs: MAX_STALE_MS }, () => loadNotes(section, lang));
}
