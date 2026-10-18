"use client";
import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Newspaper } from "lucide-react";
import type { GkLang, NewsItem, NewsRegion, NewsResponse } from "@/lib/gk/types";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { formatDate, t } from "./i18n";
import { useGkLang } from "./language";
import { CardSkeleton, ErrorState, Notice, Segmented, SourceFooter } from "./states";
import { useSource } from "./use-source";

const DAY_MS = 24 * 60 * 60_000;
/** Items older than this get an age badge, so old news is never mistaken for today's. */
const OLD_AFTER_DAYS = 3;
/** When even the newest item is older than this, say the feed has gone quiet. */
const QUIET_AFTER_DAYS = 7;

export function CurrentAffairs() {
  const { lang } = useGkLang();
  const [region, setRegion] = useState<NewsRegion>("india");
  // Lets a Hindi reader see a feed's English releases when the Hindi feed is empty, clearly labelled as English.
  const [englishFallback, setEnglishFallback] = useState(false);
  useEffect(() => setEnglishFallback(false), [region, lang]);

  const feedLang: GkLang = englishFallback ? "en" : lang;
  const { state, reload } = useSource<NewsResponse>(`/api/current-affairs?region=${region}&lang=${feedLang}`);
  const now = Date.now();

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t(lang, "newsIntro")}</p>
        <Segmented
          label={t(lang, "region")}
          value={region}
          onChange={setRegion}
          options={[
            { value: "india", label: t(lang, "regionIndia") },
            { value: "bihar", label: t(lang, "regionBihar") },
          ]}
          className="w-full shrink-0 sm:w-auto"
        />
      </div>

      {englishFallback && (
        <Notice>
          <p>{t(lang, "showingEnglish")}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setEnglishFallback(false)}>
            {t(lang, "backToHindi")}
          </Button>
        </Notice>
      )}

      {(state.status === "loading" || state.status === "idle") && <CardSkeleton rows={5} label={t(lang, "loading")} />}
      {state.status === "error" && <ErrorState state={state} lang={lang} onRetry={reload} />}
      {state.status === "ok" && (
        <>
          {state.data.items.length === 0 ? (
            <Notice tone="warning">
              <p>{lang === "hi" && region === "bihar" && !englishFallback ? t(lang, "noNewsBiharHi") : t(lang, "noNews")}</p>
              {lang === "hi" && !englishFallback && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setEnglishFallback(true)}>
                  {t(lang, "showEnglishNews")}
                </Button>
              )}
            </Notice>
          ) : (
            <>
              {state.data.newestAt && now - Date.parse(state.data.newestAt) > QUIET_AFTER_DAYS * DAY_MS && (
                <Notice tone="warning">
                  <p>{t(lang, "feedQuiet", { date: formatDate(state.data.newestAt, lang, false) })}</p>
                </Notice>
              )}
              <ul className="grid gap-3">
                {state.data.items.map((item) => (
                  <NewsCard key={item.id} item={item} lang={lang} now={now} />
                ))}
              </ul>
            </>
          )}
          <SourceFooter source={state.data.source} fetchedAt={state.data.fetchedAt} stale={state.data.stale} lang={lang} />
        </>
      )}
    </div>
  );
}

function NewsCard({ item, lang, now }: { item: NewsItem; lang: GkLang; now: number }) {
  const ageDays = item.publishedAt ? Math.floor((now - Date.parse(item.publishedAt)) / DAY_MS) : null;
  return (
    <li className="rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        {item.category && (
          <Badge variant="default" lang={item.lang}>
            {item.category}
          </Badge>
        )}
        <span className={cn("inline-flex items-center gap-1", item.publishedAt ? "text-muted-foreground" : "font-semibold text-accent-foreground dark:text-warning")}>
          <CalendarDays className="size-3.5" aria-hidden />
          {item.publishedAt ? t(lang, "published", { date: formatDate(item.publishedAt, lang) }) : t(lang, "dateUnavailable")}
        </span>
        {ageDays !== null && ageDays >= OLD_AFTER_DAYS && <Badge variant="warning">{t(lang, "olderItem", { days: ageDays })}</Badge>}
      </div>
      <h3 lang={item.lang} className="text-base font-bold leading-snug">
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
          {item.title}
        </a>
      </h3>
      {item.summary && (
        <p lang={item.lang} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {item.summary}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Newspaper className="size-3.5" aria-hidden /> {item.sourceName}
        </span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {t(lang, "readOnPib")} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </li>
  );
}
