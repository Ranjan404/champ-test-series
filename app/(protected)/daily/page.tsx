import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleSlash, XCircle, Clock, History, ListOrdered, PlayCircle, RotateCcw, Timer, Trophy } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { buildDailyState } from "@/lib/daily";
import { getDailySet, getTodaysDailySet } from "@/lib/daily-questions";
import { formatDuration, formatScore } from "@/lib/scoring";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NextSetCountdown } from "@/components/next-set-countdown";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Daily Question" };

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
const longDate = (key: string) =>
  new Date(`${key}T00:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default async function DailyPage() {
  const user = await requireUser();
  const [progress, todaySet] = await Promise.all([getProgress(user.id), getTodaysDailySet()]);
  const running = progress.daily?.attempt;
  const attemptSet = running ? await getDailySet(running.setId) : null;
  const d = buildDailyState(progress, todaySet, attemptSet);
  // An attempt whose time ran out is closed by the API on the next visit to the test page.
  const live = d.attempt && d.attempt.deadline > d.serverNow ? d.attempt : null;
  const best = d.today.length ? Math.max(...d.today.map((t) => t.score)) : null;

  if (!d.setId) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
        <CalendarDays className="size-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-extrabold">No daily set yet</h1>
        <p className="mt-2 text-muted-foreground">Daily question sets have not been added. Check back soon.</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Daily Question" title={`Today's Test · ${d.title}`}>
        <Badge variant="muted" className="px-3 py-1 text-sm">
          <CalendarDays className="size-3.5" /> {longDate(d.date)}
        </Badge>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <ListOrdered className="size-4 text-muted-foreground" /> {d.total} questions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-4 text-muted-foreground" /> {d.durationSeconds / 60} minutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="size-4 text-muted-foreground" /> Max marks {d.total}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold">
            <span className="text-success">+1 for correct</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-danger">-1/3 for wrong</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">0 for option E (Not Attempted) or unanswered</span>
          </div>
          <ul className="mt-4 grid gap-1.5 text-sm text-muted-foreground">
            <li>One new set every day at midnight (IST). Today&apos;s set stays open all day and you can attempt it as many times as you like.</li>
            <li>Move with Previous and Save &amp; Next, or jump with the question palette. Your answers are saved as you go.</li>
            <li>Submit when you are done. When the 25 minutes end, the test is submitted automatically.</li>
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            {live ? (
              <Button asChild size="lg" variant="accent">
                <Link href="/daily/test">
                  <PlayCircle /> Resume attempt {live.attemptNo} ({formatDuration((live.deadline - d.serverNow) / 1000)} left)
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/daily/test">
                  {d.today.length ? <RotateCcw /> : <PlayCircle />} {d.today.length ? "Attempt again" : "Start today's test"}
                </Link>
              </Button>
            )}
          </div>
        </section>

        <aside className="grid content-start gap-4">
          <NextSetCountdown at={d.nextResetAt} serverNow={d.serverNow} />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attempts today</p>
              <p className="mt-1 font-mono text-2xl font-bold">{d.today.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Best score</p>
              <p className="mt-1 font-mono text-2xl font-bold">{best === null ? "-" : formatScore(best)}</p>
            </div>
          </div>
        </aside>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-bold">
          <History className="size-5" /> Today&apos;s attempts
        </h2>
        {d.today.length ? (
          <ul className="grid gap-2">
            {d.today.map((t) => (
              <li key={t.attemptNo} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-3 sm:p-4">
                <span className="font-semibold">Attempt {t.attemptNo}</span>
                <span className={cn("font-mono font-bold", t.score === best && "text-success")}>
                  {formatScore(t.score)} / {t.correct + t.incorrect + t.notAttempted}
                </span>
                <span className="inline-flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="size-3.5" /> {t.correct}
                  </span>
                  <span className="inline-flex items-center gap-1 text-danger">
                    <XCircle className="size-3.5" /> {t.incorrect}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CircleSlash className="size-3.5" /> {t.notAttempted}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="size-3.5" /> {time(t.submittedAt)}
                  {t.timedOut && " · time up"}
                </span>
                <Button asChild size="sm" variant="outline" className="ml-auto">
                  <Link href={`/daily/result?date=${t.date}&attempt=${t.attemptNo}`}>View result</Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No attempts yet today.</p>
        )}
      </section>
    </>
  );
}
