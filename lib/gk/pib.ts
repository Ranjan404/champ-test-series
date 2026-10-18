import { cached, peek, put, type Cached } from "./cache";
import { cleanText, decodeEntities, fetchText, plainText, SourceError } from "./http";
import type { GkLang, NewsItem, NewsRegion, SourceInfo } from "./types";

// Press Information Bureau (Government of India) press-release RSS feeds.
// PIB's copyright policy allows reproduction free of charge without prior permission, provided it is accurate and
// the source is acknowledged prominently (https://pib.gov.in/Content/102_2_Copyright-Policy.aspx).
//
// The feeds give only a headline and a link: no date, summary or ministry. For each release we read those three
// fields from the public release page (date line, ministry line and og:description) and cache them for a day, since
// they never change. If a page cannot be read, the item is still shown, with its date marked as unavailable.

export const PIB_SOURCE: SourceInfo = {
  name: "Press Information Bureau, Government of India",
  url: "https://www.pib.gov.in",
  license: "PIB copyright policy: free reuse with prominent acknowledgement",
};

/** PIB regional offices (the "Regid" values from pib.gov.in/ViewRss.aspx). Lang 1 = English, 2 = Hindi. */
const FEEDS: Record<NewsRegion, { regid: number; office: string }> = {
  india: { regid: 3, office: "PIB Delhi" },
  bihar: { regid: 40, office: "PIB Patna" },
};

const FEED_TTL_MS = 20 * 60_000;
const FEED_MAX_STALE_MS = 12 * 60 * 60_000;
const FEED_TIMEOUT_MS = 12_000;
const PAGE_TIMEOUT_MS = 8_000;
const DETAILS_TTL_MS = 24 * 60 * 60_000;
/** Pages read in parallel, and the total time spent reading them per feed refresh. */
const PAGE_CONCURRENCY = 6;
const ENRICH_BUDGET_MS = 15_000;
const MAX_ITEMS = 20;

export const feedUrl = (region: NewsRegion, lang: GkLang) => {
  const { regid } = FEEDS[region];
  return `https://www.pib.gov.in/RssMain.aspx?ModId=6&Lang=${lang === "hi" ? 2 : 1}&Regid=${regid}&reg=${regid}`;
};
const releasePage = (prid: string) => `https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=${prid}`;
/** The link shown to readers: the full release page on pib.gov.in. */
const releaseLink = (prid: string) => `https://www.pib.gov.in/PressReleasePage.aspx?PRID=${prid}`;

export interface FeedEntry {
  prid: string;
  title: string;
  /** Present only if the feed ever starts carrying them. */
  pubDate: string | null;
  description: string | null;
}

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
};

/** Parses a PIB RSS document. Throws SourceError("invalid") when it is not RSS at all. Items without a PIB release link are dropped. */
export function parsePibRss(xml: string): FeedEntry[] {
  if (!/<rss\b/i.test(xml) || !/<channel\b/i.test(xml)) throw new SourceError("invalid", "PIB did not return an RSS feed.");
  const out: FeedEntry[] = [];
  const seen = new Set<string>();
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const body = m[1];
    const title = plainText(tag(body, "title") ?? "");
    const link = plainText(tag(body, "link") ?? "");
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      continue;
    }
    const prid = url.searchParams.get("PRID");
    const pibHost = url.hostname === "pib.gov.in" || url.hostname.endsWith(".pib.gov.in");
    if (!title || !prid || !/^\d{1,10}$/.test(prid) || !pibHost || seen.has(prid)) continue;
    seen.add(prid);
    const pubRaw = tag(body, "pubDate");
    const pub = pubRaw ? new Date(plainText(pubRaw)) : null;
    const desc = tag(body, "description");
    out.push({
      prid,
      title,
      pubDate: pub && !Number.isNaN(pub.getTime()) ? pub.toISOString() : null,
      description: desc ? plainText(desc) || null : null,
    });
  }
  return out;
}

export interface ReleaseDetails {
  publishedAt: string | null;
  ministry: string | null;
  summary: string | null;
}

const MONTHS: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

/** "18 OCT 2026 10:25AM" (India Standard Time, as printed by PIB) -> ISO string; null if it doesn't parse. */
export function parsePibDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?/i);
  if (!m) return null;
  const month = MONTHS[m[2].toUpperCase()];
  const year = Number(m[3]);
  const day = Number(m[1]);
  // Rejects unknown months and impossible days such as 31 FEB.
  if (month === undefined || new Date(Date.UTC(year, month, day)).getUTCDate() !== day) return null;
  let hour = m[4] ? Number(m[4]) % 12 : 0;
  if (m[6]?.toUpperCase() === "PM") hour += 12;
  const minute = m[5] ? Number(m[5]) : 0;
  if (minute > 59) return null;
  // IST is UTC+5:30 with no daylight saving.
  const utc = Date.UTC(year, month, day, hour, minute) - 330 * 60_000;
  // A date more than a day in the future means we misread the page.
  if (utc > Date.now() + 24 * 60 * 60_000) return null;
  return new Date(utc).toISOString();
}

/** Reads date, ministry and the og:description summary from a release page. Missing fields come back null. */
export function parseReleasePage(html: string): ReleaseDetails {
  const block = (id: string) => {
    const m = html.match(new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]*?)</div>`, "i"));
    return m ? plainText(m[1]) : null;
  };
  const dateLine = block("PrDateTime");
  const ministry = block("MinistryName");
  const og = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)?.[1];
  let summary = og ? cleanText(decodeEntities(og)) : null;
  // PIB cuts og:description at about 100 characters, mid-word; say so with an ellipsis.
  if (summary && summary.length >= 95 && !/[.!?।]$/.test(summary)) summary = summary.replace(/\s+\S*$/, "") + "…";
  return {
    publishedAt: dateLine ? parsePibDate(dateLine) : null,
    ministry: ministry && ministry.length <= 120 ? ministry : null,
    summary: summary && summary.length >= 10 ? summary : null,
  };
}

async function releaseDetails(prid: string, deadline: number): Promise<ReleaseDetails | null> {
  const key = `pib:release:${prid}`;
  const hit = peek<ReleaseDetails>(key);
  if (hit) return hit;
  const left = deadline - Date.now();
  if (left < 1_000) return null;
  try {
    // The fields we need sit in the first ~75 KB of pages that can exceed 200 KB; stop once the date line is in.
    const html = await fetchText(releasePage(prid), { timeoutMs: Math.min(PAGE_TIMEOUT_MS, left), until: /id=["']PrDateTime["'][^>]*>[\s\S]*?<\/div>/i });
    const details = parseReleasePage(html);
    // Only cache pages we could actually read a date from; otherwise try again on the next refresh.
    if (details.publishedAt) put(key, details, DETAILS_TTL_MS);
    return details;
  } catch {
    return null;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function loadFeed(region: NewsRegion, lang: GkLang): Promise<NewsItem[]> {
  const entries = parsePibRss(await fetchText(feedUrl(region, lang), { timeoutMs: FEED_TIMEOUT_MS, accept: "application/rss+xml, text/xml" })).slice(
    0,
    MAX_ITEMS,
  );
  const deadline = Date.now() + ENRICH_BUDGET_MS;
  const details = await mapLimit(entries, PAGE_CONCURRENCY, (e) => releaseDetails(e.prid, deadline));
  const office = FEEDS[region].office;
  const items = entries.map<NewsItem>((e, i) => ({
    id: `pib-${e.prid}`,
    title: e.title,
    url: releaseLink(e.prid),
    publishedAt: details[i]?.publishedAt ?? e.pubDate,
    summary: details[i]?.summary ?? e.description,
    category: details[i]?.ministry ?? null,
    sourceName: office,
    lang,
  }));
  return sortNewestFirst(items);
}

/** Newest first; undated items keep their feed order after the dated ones. */
function sortNewestFirst(items: NewsItem[]): NewsItem[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      const ta = a.it.publishedAt ? Date.parse(a.it.publishedAt) : -Infinity;
      const tb = b.it.publishedAt ? Date.parse(b.it.publishedAt) : -Infinity;
      return tb - ta || a.i - b.i;
    })
    .map(({ it }) => it);
}

const filling = new Set<string>();

/** Reads release pages that were not ready in time, in the background, so the next request can show their dates. */
function fillMissing(items: NewsItem[]) {
  const prids = items.filter((i) => !i.publishedAt).map((i) => i.id.slice("pib-".length)).filter((p) => !filling.has(p));
  if (!prids.length) return;
  prids.forEach((p) => filling.add(p));
  void mapLimit(prids, 2, (p) => releaseDetails(p, Date.now() + PAGE_TIMEOUT_MS)).finally(() => prids.forEach((p) => filling.delete(p)));
}

/** Fills in details that arrived after the feed was cached. Never invents anything: only cached release pages are used. */
function withLateDetails(items: NewsItem[]): NewsItem[] {
  let changed = false;
  const out = items.map((it) => {
    if (it.publishedAt) return it;
    const d = peek<ReleaseDetails>(`pib:release:${it.id.slice("pib-".length)}`);
    if (!d?.publishedAt) return it;
    changed = true;
    return { ...it, publishedAt: d.publishedAt, category: it.category ?? d.ministry, summary: it.summary ?? d.summary };
  });
  return changed ? sortNewestFirst(out) : out;
}

/** An empty feed is a valid answer (PIB Patna's Hindi feed is often empty) and is returned as an empty list. */
export async function getPibNews(region: NewsRegion, lang: GkLang): Promise<Cached<NewsItem[]>> {
  const r = await cached(`pib:${region}:${lang}`, { ttlMs: FEED_TTL_MS, maxStaleMs: FEED_MAX_STALE_MS }, () => loadFeed(region, lang));
  const value = withLateDetails(r.value);
  fillMissing(value);
  return { ...r, value };
}
