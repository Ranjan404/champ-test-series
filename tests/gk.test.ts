import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "@/lib/gk/cache";
import { fetchText, SourceError } from "@/lib/gk/http";
import { getOpenTdbQuestions, normalizeOpenTdb, resetOpenTdbThrottle, toQuizQuestion } from "@/lib/gk/opentdb";
import { getPibNews, parsePibDate, parsePibRss, parseReleasePage } from "@/lib/gk/pib";
import { NOTE_GROUPS } from "@/lib/gk/topics";
import { getStudyNotes, parseExtracts, trimExtract } from "@/lib/gk/wikipedia";

// Fixtures below are test-only stand-ins shaped like each source's real responses. They never reach the app.

const enc = (s: string) => encodeURIComponent(s);
const otdbItem = (q: string, correct = "Right", incorrect = ["W1", "W2", "W3"], type = "multiple") => ({
  type: enc(type),
  difficulty: enc("medium"),
  category: enc("History"),
  question: enc(q),
  correct_answer: enc(correct),
  incorrect_answers: incorrect.map(enc),
});
const otdbBody = (results: unknown[], code = 0) => ({ response_code: code, results });

let fetchMock: ReturnType<typeof vi.fn>;
const caught = (p: Promise<unknown>) => p.then(() => null, (e) => e as SourceError);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  clearCache();
  resetOpenTdbThrottle();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OpenTDB normalisation", () => {
  it("decodes url3986 text and keeps the source's correct answer", () => {
    const [q] = normalizeOpenTdb(otdbBody([otdbItem("Who wrote \"Gitanjali\"?", "Rabindranath Tagore", ["Premchand", "Nirala", "Dinkar"])]));
    expect(q).toMatchObject({ question: 'Who wrote "Gitanjali"?', correct: "Rabindranath Tagore", explanation: null, difficulty: "medium", lang: "en" });
  });

  it("drops questions with missing, ambiguous or non-MCQ answer data", () => {
    const out = normalizeOpenTdb(
      otdbBody([
        otdbItem("Valid question one?"),
        otdbItem("Two wrong options only?", "A", ["B", "C"]),
        otdbItem("Duplicate options?", "Same", ["same", "X", "Y"]),
        otdbItem("Empty correct answer?", ""),
        otdbItem("True or false?", "True", ["False"], "boolean"),
        { question: enc("No answers at all?") },
        otdbItem("Valid question one?"), // duplicate question text
      ]),
    );
    expect(out.map((q) => q.question)).toEqual(["Valid question one?"]);
  });

  it("maps response codes to errors and rejects malformed bodies", () => {
    const kind = (body: unknown) => {
      try {
        normalizeOpenTdb(body);
        return null;
      } catch (e) {
        return (e as SourceError).kind;
      }
    };
    expect(kind(otdbBody([], 5))).toBe("rate_limited");
    expect(kind(otdbBody([], 1))).toBe("empty");
    expect(kind(otdbBody([], 2))).toBe("invalid");
    expect(kind({ nope: true })).toBe("invalid");
    expect(kind("<html>")).toBe("invalid");
    expect(kind(otdbBody([otdbItem("Bad?", "A", ["B"])]))).toBe("empty");
  });

  it("shuffles options without ever losing the correct-answer mapping", () => {
    const [pq] = normalizeOpenTdb(otdbBody([otdbItem("Capital of Bihar?", "Patna", ["Gaya", "Bhagalpur", "Muzaffarpur"])]));
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const q = toQuizQuestion(pq);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options[q.correctIndex]).toBe("Patna");
      seen.add(q.correctIndex);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("OpenTDB fetching and caching", () => {
  const okResponse = () => new Response(JSON.stringify(otdbBody(Array.from({ length: 12 }, (_, i) => otdbItem(`Question number ${i}?`)))));

  it("serves later quizzes from the cached pool instead of calling OpenTDB again", async () => {
    fetchMock.mockImplementation(async () => okResponse());
    const a = await getOpenTdbQuestions("history", 5);
    const b = await getOpenTdbQuestions("history", 10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("category=23");
    expect(String(fetchMock.mock.calls[0][0])).toContain("encode=url3986");
    expect(a.value).toHaveLength(5);
    expect(b.value).toHaveLength(10);
    expect(a.stale).toBe(false);
  });

  it("serves the last good pool marked stale when a refresh fails, and never claims a fresh fetch", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T06:00:00Z"));
    fetchMock.mockImplementationOnce(async () => okResponse());
    const first = await getOpenTdbQuestions("general", 5);

    vi.setSystemTime(new Date("2026-10-18T07:00:00Z")); // past the 30-minute TTL
    fetchMock.mockImplementationOnce(async () => new Response("", { status: 503 }));
    const second = await getOpenTdbQuestions("general", 5);
    expect(second.stale).toBe(true);
    expect(second.fetchedAt).toBe(first.fetchedAt);
  });

  it("retries once after an HTTP 429, then reports the rate limit", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    fetchMock.mockImplementation(async () => new Response("", { status: 429, headers: { "Retry-After": "7" } }));
    const p = caught(getOpenTdbQuestions("science", 5));
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await p).toMatchObject({ kind: "rate_limited", retryAfter: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("succeeds when the retry after a rate limit gets through", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(otdbBody([], 5)))).mockImplementationOnce(async () => okResponse());
    const p = getOpenTdbQuestions("science", 5);
    await vi.advanceTimersByTimeAsync(6_000);
    expect((await p).value).toHaveLength(5);
  });

  it("reports network failures and empty categories as errors when nothing is cached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await caught(getOpenTdbQuestions("science", 5))).toMatchObject({ kind: "network" });

    clearCache();
    resetOpenTdbThrottle();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(otdbBody([], 1))));
    expect(await caught(getOpenTdbQuestions("science", 5))).toMatchObject({ kind: "empty" });
  });
});

describe("fetchText", () => {
  it("times out a request that never answers", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "TimeoutError")))),
    );
    expect(await caught(fetchText("https://example.org", { timeoutMs: 30 }))).toMatchObject({ kind: "timeout" });
  });

  it("stops reading a large page once the wanted part has arrived", async () => {
    const enc8 = new TextEncoder();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc8.encode("<html><head>...</head><div id=\"PrDateTime\">15 OCT 2026 4:46PM</div>"));
        // Never closes: without the early stop this would hang until the timeout.
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValue(new Response(body));
    const text = await fetchText("https://example.org", { timeoutMs: 2_000, until: /id="PrDateTime"[^>]*>[\s\S]*?<\/div>/ });
    expect(text).toContain("15 OCT 2026");
    expect(cancelled).toBe(true);
  });

  it("rejects non-2xx answers", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    expect(await caught(fetchText("https://example.org", { timeoutMs: 1000 }))).toMatchObject({ kind: "http" });
  });
});

const rss = (items: string) =>
  `﻿<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Press Information Bureau </title>${items}</channel></rss>`;
const rssItem = (title: string, prid: string, host = "pib.gov.in") =>
  `<item><title>${title}</title><link>https://${host}/PressReleaseIframePage.aspx?PRID=${prid}</link></item>`;
const releaseHtml = (date: string, ministry: string, og: string) => `<html><head>
  <meta property="og:description" content="${og}" /></head><body>
  <div id="MinistryName" class="MinistryNameSubhead text-center">
     ${ministry}
  </div>
  <div id="PrDateTime" class="ReleaseDateSubHeaddateTime text-center pt20">
     Posted On:
     ${date} by PIB Patna
  </div></body></html>`;

describe("PIB parsing", () => {
  it("parses items, decodes entities and drops non-PIB or duplicate links", () => {
    const items = parsePibRss(
      rss(
        rssItem("Flood relief &amp; crop loss review in Bihar", "100") +
          rssItem("Duplicate", "100") +
          rssItem("Not PIB", "101", "evil.example.com") +
          "<item><title>No link</title></item>" +
          rssItem("", "102"),
      ),
    );
    expect(items).toEqual([{ prid: "100", title: "Flood relief & crop loss review in Bihar", pubDate: null, description: null }]);
  });

  it("rejects responses that are not RSS (e.g. an error page)", () => {
    expect(() => parsePibRss("<html><body>The Page you have requested is not available</body></html>")).toThrow(SourceError);
  });

  it("returns an empty list for an empty but valid feed", () => {
    expect(parsePibRss(rss(""))).toEqual([]);
  });

  it("reads PIB's IST date line as an exact instant", () => {
    expect(parsePibDate("15 OCT 2026 4:46PM")).toBe("2026-10-15T11:16:00.000Z");
    expect(parsePibDate("18 OCT 2026 12:05AM")).toBe("2026-10-17T18:35:00.000Z");
    expect(parsePibDate("31 FEB 2026 1:00PM")).toBeNull();
    expect(parsePibDate("no date here")).toBeNull();
    expect(parsePibDate("01 JAN 2099 10:00AM")).toBeNull(); // future: misread
  });

  it("extracts date, ministry and a marked-as-truncated summary from a release page", () => {
    const d = parseReleasePage(
      releaseHtml(
        "15 OCT 2026 4:46PM",
        "Ministry of External Affairs",
        "In continuation of the Ministry of External Affairs&rsquo; citizen-centric initiative, &ldquo;Passport Seva &ndash; Pa",
      ),
    );
    expect(d.publishedAt).toBe("2026-10-15T11:16:00.000Z");
    expect(d.ministry).toBe("Ministry of External Affairs");
    expect(d.summary).toMatch(/^In continuation of the Ministry of External Affairs’ citizen-centric initiative, “Passport Seva –…$/);
  });

  it("returns nulls instead of guessing when a release page has no recognisable fields", () => {
    expect(parseReleasePage("<html><body>Changed layout</body></html>")).toEqual({ publishedAt: null, ministry: null, summary: null });
  });
});

describe("PIB news", () => {
  it("enriches items, sorts newest first, and keeps an item with an unreadable page as undated", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("RssMain")) return new Response(rss(rssItem("Older", "1") + rssItem("Broken page", "2") + rssItem("Newer", "3")));
      if (url.endsWith("PRID=1")) return new Response(releaseHtml("01 OCT 2026 10:00AM", "Ministry of Railways", "A short summary."));
      if (url.endsWith("PRID=3")) return new Response(releaseHtml("15 OCT 2026 10:00AM", "Ministry of Education", "Another summary."));
      return new Response("", { status: 500 });
    });
    const r = await getPibNews("bihar", "en");
    expect(String(fetchMock.mock.calls[0][0])).toContain("Regid=40");
    expect(r.value.map((i) => [i.title, i.publishedAt, i.category])).toEqual([
      ["Newer", "2026-10-15T04:30:00.000Z", "Ministry of Education"],
      ["Older", "2026-10-01T04:30:00.000Z", "Ministry of Railways"],
      ["Broken page", null, null],
    ]);
    expect(r.value[0]).toMatchObject({ url: "https://www.pib.gov.in/PressReleasePage.aspx?PRID=3", sourceName: "PIB Patna", lang: "en" });
  });

  it("fills in a date on a later request once a slow release page has been read in the background", async () => {
    let pageUp = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("RssMain")) return new Response(rss(rssItem("Slow page", "7")));
      return pageUp ? new Response(releaseHtml("10 OCT 2026 9:00AM", "Ministry of Mines", "Summary text here.")) : new Response("", { status: 503 });
    });
    const first = await getPibNews("india", "en");
    expect(first.value[0].publishedAt).toBeNull();
    pageUp = true;
    await vi.waitFor(async () => {
      const later = await getPibNews("india", "en");
      expect(later.value[0]).toMatchObject({ publishedAt: "2026-10-10T03:30:00.000Z", category: "Ministry of Mines" });
    });
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes("RssMain"))).toHaveLength(1); // feed itself still cached
  });

  it("passes an empty feed through as an empty list (PIB Patna's Hindi feed)", async () => {
    fetchMock.mockResolvedValue(new Response(rss("")));
    const r = await getPibNews("bihar", "hi");
    expect(r.value).toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("Lang=2");
  });

  it("fails cleanly when the feed itself is down", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 502 }));
    expect(await caught(getPibNews("india", "en"))).toMatchObject({ kind: "http" });
  });
});

describe("Wikipedia study notes", () => {
  it("follows normalisation and redirects and marks missing pages", () => {
    const body = {
      query: {
        normalized: [{ from: "son river", to: "Son river" }],
        redirects: [{ from: "Son river", to: "Sone River" }],
        pages: [
          { title: "Sone River", extract: "The Sone is a river.", fullurl: "https://en.wikipedia.org/wiki/Sone_River" },
          { title: "Nowhere", missing: true },
        ],
      },
    };
    const out = parseExtracts(body, "en", ["son river", "Nowhere"]);
    expect(out.get("son river")).toEqual({ title: "Sone River", extract: "The Sone is a river.", url: "https://en.wikipedia.org/wiki/Sone_River" });
    expect(out.get("Nowhere")).toBeNull();
    expect(() => parseExtracts({ error: { code: "x" } }, "en", ["A"])).toThrow(SourceError);
  });

  it("trims long introductions at a paragraph or sentence boundary", () => {
    const para = "Sentence one is here. ".repeat(40).trim(); // 879 characters
    expect(trimExtract(`${para}\n\n${para}`)).toBe(para); // a second paragraph would pass the limit
    const huge = trimExtract("Sentence one is here. ".repeat(100).trim());
    expect(huge.length).toBeLessThanOrEqual(1402);
    expect(huge.endsWith("here. …")).toBe(true);
    expect(trimExtract("Short.\n\n\nSecond.")).toBe("Short.\n\nSecond.");
  });

  it("never asks Hindi Wikipedia for topics without a reviewed Hindi article, and labels them", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const titles = new URL(url).searchParams.get("titles")!.split("|");
      return new Response(JSON.stringify({ query: { pages: titles.map((t) => ({ title: t, extract: `${t} का परिचय।` })) } }));
    });
    const r = await getStudyNotes("bihar", "hi");
    const requested = fetchMock.mock.calls.flatMap(([u]) => new URL(String(u)).searchParams.get("titles")!.split("|"));
    expect(fetchMock.mock.calls.every(([u]) => String(u).startsWith("https://hi.wikipedia.org/"))).toBe(true);
    expect(requested).not.toContain("History of Bihar");
    const history = r.value.find((n) => n.key === "History of Bihar")!;
    expect(history).toMatchObject({ status: "no-article", extract: null, englishUrl: "https://en.wikipedia.org/wiki/History_of_Bihar" });
    const kosi = r.value.find((n) => n.key === "Kosi River")!;
    expect(kosi).toMatchObject({ status: "ok", title: "कोसी नदी", lang: "hi" });
    expect(r.value).toHaveLength(NOTE_GROUPS.bihar.flatMap((g) => g.topics).length);
  });

  it("treats a response with no usable article text as an error", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ query: { pages: [] } })));
    expect(await caught(getStudyNotes("india", "en"))).toMatchObject({ kind: "empty" });
  });
});

describe("GK/GS never persists content", () => {
  const root = path.resolve(__dirname, "..");
  const walk = (rel: string): string[] => {
    const abs = path.join(root, rel);
    return fs.statSync(abs).isDirectory() ? fs.readdirSync(abs).flatMap((f) => walk(path.join(rel, f))) : [rel];
  };
  const files = ["lib/gk", "components/gk", "app/api/gk", "app/api/current-affairs", "app/(protected)/gk"].flatMap(walk);

  it("does not import Supabase, the user/progress store or any storage/file-writing API", () => {
    expect(files.length).toBeGreaterThan(10);
    const forbidden = /from\s+["'](@supabase\/[^"']*|@\/lib\/store|@\/lib\/progress|node:fs[^"']*|fs)["']|createClient\(|updateProgress\(|writeFile|sessionStorage/;
    for (const f of files) {
      expect(fs.readFileSync(path.join(root, f), "utf8"), f).not.toMatch(forbidden);
    }
  });
});
