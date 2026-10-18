"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ExternalLink, Landmark, MapPinned, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type StringKey } from "./i18n";
import { useGkLang } from "./language";
import { CurrentAffairs } from "./news";
import { Quiz } from "./quiz";
import { Notice } from "./states";
import { StudyNotes } from "./study-notes";

function Heading({ title, intro }: { title: StringKey; intro?: string }) {
  const { lang } = useGkLang();
  return (
    <div className="mb-5 sm:mb-6" lang={lang}>
      <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">{t(lang, "sectionEyebrow")}</p>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t(lang, title)}</h1>
      {intro && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
    </div>
  );
}

const HUB_CARDS = [
  { href: "/gk/india", title: "india", body: "hubIndia", icon: Landmark, tone: "bg-primary/10 text-primary" },
  { href: "/gk/bihar", title: "bihar", body: "hubBihar", icon: MapPinned, tone: "bg-success-soft text-success" },
  { href: "/gk/current-affairs", title: "currentAffairs", body: "hubNews", icon: Newspaper, tone: "bg-warning-soft text-accent-foreground dark:text-warning" },
] as const satisfies readonly { href: string; title: StringKey; body: StringKey; icon: unknown; tone: string }[];

const SOURCES = [
  { name: "Open Trivia Database", url: "https://opentdb.com", what: "MCQs with answer key · English · CC BY-SA 4.0" },
  { name: "Wikipedia (English & Hindi)", url: "https://www.wikipedia.org", what: "Study notes · CC BY-SA 4.0" },
  { name: "Press Information Bureau", url: "https://www.pib.gov.in", what: "Official press releases · English & Hindi" },
];

export function GkHub() {
  const { lang } = useGkLang();
  return (
    <div>
      <Heading title="hubTitle" intro={t(lang, "hubIntro")} />
      <div className="grid gap-4 md:grid-cols-3">
        {HUB_CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex flex-col rounded-lg border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn("mb-3 flex size-11 items-center justify-center rounded-lg transition-transform group-hover:scale-105", c.tone)}>
              <c.icon className="size-5" aria-hidden />
            </span>
            <h2 className="text-lg font-bold" lang={lang}>
              {t(lang, c.title)}
            </h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground" lang={lang}>
              {t(lang, c.body)}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary" lang={lang}>
              {t(lang, "open")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        ))}
      </div>

      <section aria-labelledby="gk-sources" className="mt-8">
        <h2 id="gk-sources" className="mb-3 text-base font-bold" lang={lang}>
          {t(lang, "sourcesTitle")}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {SOURCES.map((s) => (
            <li key={s.name} className="rounded-lg border bg-card px-4 py-3 text-sm">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-primary hover:underline">
                {s.name} <ExternalLink className="size-3.5" aria-hidden />
              </a>
              <p lang="en" className="text-xs text-muted-foreground">
                {s.what}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function IndiaGk() {
  const { lang } = useGkLang();
  const [tab, setTab] = useState<"quiz" | "notes">("quiz");
  const tabs = [
    { id: "quiz", label: t(lang, "quizTab"), icon: Landmark },
    { id: "notes", label: t(lang, "notesTab"), icon: BookOpen },
  ] as const;
  return (
    <div>
      <Heading title="india" />
      <div role="tablist" aria-label={t(lang, "india")} className="mb-5 inline-flex rounded-md border bg-muted p-1" lang={lang}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            id={`tab-${tb.id}`}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            aria-controls={`panel-${tb.id}`}
            tabIndex={tab === tb.id ? 0 : -1}
            onClick={() => setTab(tb.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = tab === "quiz" ? "notes" : "quiz";
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-[calc(var(--radius)-6px)] px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === tb.id && "bg-card text-foreground shadow-sm",
            )}
          >
            <tb.icon className="size-4" aria-hidden /> {tb.label}
          </button>
        ))}
      </div>
      {/* Both panels stay mounted so switching tabs keeps an unfinished quiz. */}
      <div id="panel-quiz" role="tabpanel" aria-labelledby="tab-quiz" hidden={tab !== "quiz"}>
        <Quiz />
      </div>
      <div id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" hidden={tab !== "notes"}>
        {tab === "notes" && <StudyNotes section="india" />}
      </div>
    </div>
  );
}

export function BiharGk() {
  const { lang } = useGkLang();
  return (
    <div className="grid gap-5">
      <Heading title="bihar" />
      <Notice title={t(lang, "biharNoQuizTitle")}>
        <p lang={lang}>{t(lang, "biharNoQuizBody")}</p>
      </Notice>
      <StudyNotes section="bihar" />
      <Notice title={t(lang, "schemesTitle")}>
        <p lang={lang}>{t(lang, "schemesBody")}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <a href="https://state.bihar.gov.in" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
            {t(lang, "officialPortal")} <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <Link href="/gk/current-affairs">{t(lang, "currentAffairs")}</Link>
        </p>
      </Notice>
    </div>
  );
}

export function CurrentAffairsPage() {
  return (
    <div>
      <Heading title="currentAffairs" />
      <CurrentAffairs />
    </div>
  );
}
