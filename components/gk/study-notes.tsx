"use client";
import { useState } from "react";
import { BookOpen, ExternalLink } from "lucide-react";
import { NOTE_GROUPS } from "@/lib/gk/topics";
import type { GkLang, NotesResponse, NotesSection, StudyNote } from "@/lib/gk/types";
import { Button } from "../ui/button";
import { t } from "./i18n";
import { useGkLang } from "./language";
import { CardSkeleton, ErrorState, Notice, SourceFooter } from "./states";
import { useSource } from "./use-source";

const PREVIEW_CHARS = 360;

export function StudyNotes({ section }: { section: NotesSection }) {
  const { lang } = useGkLang();
  const { state, reload } = useSource<NotesResponse>(`/api/gk/notes?section=${section}&lang=${lang}`);

  return (
    <div className="grid gap-5">
      <Notice>
        <p>{t(lang, "notesIntro")}</p>
        {lang === "hi" && <p>{t(lang, "notesLangNote")}</p>}
      </Notice>

      {(state.status === "loading" || state.status === "idle") && <CardSkeleton rows={4} label={t(lang, "loading")} />}
      {state.status === "error" && <ErrorState state={state} lang={lang} onRetry={reload} />}
      {state.status === "ok" && (
        <>
          {NOTE_GROUPS[section].map((g) => {
            const notes = state.data.notes.filter((n) => n.group === g.id);
            if (!notes.length) return null;
            return (
              <section key={g.id} aria-labelledby={`notes-${g.id}`} className="grid gap-3">
                <h2 id={`notes-${g.id}`} lang={lang} className="text-lg font-bold">
                  {g[lang]}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {notes.map((n) => (
                    <NoteCard key={n.key} note={n} lang={lang} />
                  ))}
                </div>
              </section>
            );
          })}
          <SourceFooter source={state.data.source} fetchedAt={state.data.fetchedAt} stale={state.data.stale} lang={lang} />
        </>
      )}
    </div>
  );
}

function NoteCard({ note, lang }: { note: StudyNote; lang: GkLang }) {
  const [open, setOpen] = useState(false);

  if (note.status !== "ok" || !note.extract) {
    return (
      <article className="rounded-lg border border-dashed bg-card p-4">
        <h3 lang="en" className="font-bold">
          {note.title}
        </h3>
        <p lang={lang} className="mt-1 text-sm text-muted-foreground">
          {note.status === "no-article" ? t(lang, "noHindiArticle") : t(lang, "articleUnavailable")}
        </p>
        <a
          href={note.englishUrl ?? note.url}
          target="_blank"
          rel="noopener noreferrer"
          lang={lang}
          className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          {note.status === "no-article" ? t(lang, "readEnglishArticle") : t(lang, "readOnWikipedia")} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </article>
    );
  }

  const long = note.extract.length > PREVIEW_CHARS;
  const shown = open || !long ? note.extract : note.extract.slice(0, PREVIEW_CHARS).replace(/\s+\S*$/, "") + " …";
  return (
    <article className="flex flex-col rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <h3 lang={note.lang} className="flex items-start gap-2 font-bold">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {note.title}
      </h3>
      <div lang={note.lang} className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/90">
        {shown.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3">
        {long && (
          <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? t(lang, "readLess") : t(lang, "readMore")}
          </Button>
        )}
        <a href={note.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {t(lang, "readOnWikipedia")} <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </article>
  );
}
