// Server-only helpers for fetching public GK/GS sources (OpenTDB, PIB, Wikipedia).
// Nothing here touches Supabase or the progress store: fetched content lives only in the in-memory cache (cache.ts).

export type SourceErrorKind = "timeout" | "network" | "http" | "rate_limited" | "invalid" | "empty";

export class SourceError extends Error {
  constructor(
    public kind: SourceErrorKind,
    message: string,
    /** Seconds before it is worth asking the source again (rate limits). */
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "SourceError";
  }
}

/** Identifies the app in the standard bot format (PIB rejects some non-browser formats). Wikimedia asks for contact
 * details in it: set SOURCE_USER_AGENT to add them. */
export const userAgent = () =>
  process.env.SOURCE_USER_AGENT?.trim() || "Mozilla/5.0 (compatible; ChampTestSeries/1.0; educational quiz app)";

/** Responses bigger than this are treated as invalid; none of the sources legitimately send more. */
const MAX_BYTES = 3_000_000;

export interface FetchTextOptions {
  timeoutMs: number;
  accept?: string;
  signal?: AbortSignal;
  /** Stop downloading once the text received so far matches (the rest of a large page is not needed). */
  until?: RegExp;
}

async function readBody(res: Response, until?: RegExp): Promise<string> {
  if (!until || !res.body) return res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    text += decoder.decode(value, { stream: true });
    if (text.length > MAX_BYTES) break;
    if (until.test(text)) {
      await reader.cancel().catch(() => undefined);
      return text;
    }
  }
  await reader.cancel().catch(() => undefined);
  return text;
}

/** GET a URL as text with a hard timeout. Throws SourceError for timeouts, network errors, 429 and other non-2xx. */
export async function fetchText(url: string, { timeoutMs, accept, signal, until }: FetchTextOptions): Promise<string> {
  const timeout = AbortSignal.timeout(timeoutMs);
  let res: Response;
  let body: string;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": userAgent(), ...(accept ? { Accept: accept } : {}) },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: "no-store",
      redirect: "follow",
    });
    // Read the body under the same signal, so a stalled stream also times out.
    body = await readBody(res, until);
  } catch (e) {
    const name = (e as Error)?.name;
    if (timeout.aborted || name === "TimeoutError") throw new SourceError("timeout", "The source took too long to respond.");
    if (name === "AbortError") throw new SourceError("network", "The request was cancelled.");
    throw new SourceError("network", "Could not reach the source.");
  }
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after"));
    throw new SourceError("rate_limited", "The source is rate limiting requests.", Number.isFinite(retry) && retry > 0 ? retry : 10);
  }
  if (!res.ok) throw new SourceError("http", `The source answered with HTTP ${res.status}.`);
  if (body.length > MAX_BYTES) throw new SourceError("invalid", "The source sent an unexpectedly large response.");
  return body;
}

export async function fetchJson(url: string, opts: FetchTextOptions): Promise<unknown> {
  const text = await fetchText(url, { accept: "application/json", ...opts });
  try {
    return JSON.parse(text);
  } catch {
    throw new SourceError("invalid", "The source returned malformed JSON.");
  }
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "-",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  rupee: "₹",
};

/** Decodes the HTML/XML entities that the sources actually use (named subset plus numeric). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      // The source may write an em dash as a numeric entity; it is shown as a plain hyphen.
      if (n === 0x2014) return "-";
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

/** Collapses whitespace; a literal U+2014 dash from a source is shown as a plain hyphen, like its entity form. */
export const cleanText = (s: string) => s.replace(/\u2014/g, "-").replace(/\s+/g, " ").trim();

/** Strips tags, decodes entities and collapses whitespace. */
export const plainText = (html: string) =>
  cleanText(decodeEntities(html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " ")));
