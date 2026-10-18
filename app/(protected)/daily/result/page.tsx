import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleSlash, Clock, Percent, RotateCcw, Target, Trophy, XCircle } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getDailySet } from "@/lib/daily-questions";
import { istDateKey } from "@/lib/daily";
import { evaluate, formatDuration, formatScore } from "@/lib/scoring";
import type { ReviewItem } from "@/lib/report";
import { DAILY_DURATION_SECONDS, type OptionKey } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { QuestionReview } from "@/components/question-review";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Daily Test Result" };

type Props = { searchParams: Promise<{ date?: string; attempt?: string }> };

function Kpi({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 font-mono text-xl font-bold sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function CountTile({ icon: Icon, label, value, cls }: { icon: React.ElementType; label: string; value: number; cls: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-lg p-3 sm:p-4", cls)}>
      <Icon className="size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-mono text-xl font-bold leading-none">{value}</p>
        <p className="truncate text-xs font-semibold">{label}</p>
      </div>
    </div>
  );
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export default async function DailyResultPage({ searchParams }: Props) {
  const user = await requireUser();
  const { date, attempt } = await searchParams;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !attempt || !/^\d{1,4}$/.test(attempt)) notFound();
  const progress = await getProgress(user.id);
  const entry = progress.daily?.history.find((h) => h.date === date && h.attemptNo === Number(attempt));
  const set = entry ? await getDailySet(entry.setId) : null;
  if (!entry || !set) notFound();

  const items: ReviewItem[] = set.questions.map((q, i) => {
    const answer: OptionKey[] = [entry.answers[q.id] ?? "E"];
    const { result, marks } = evaluate(q, answer);
    return {
      index: i + 1,
      id: q.id,
      type: q.type,
      difficulty: q.difficulty,
      topic: q.topic,
      question: q.question,
      options: q.options,
      correct: q.correct,
      answer,
      outcome: result,
      marks,
      explanation: q.explanation,
    };
  });

  const topics = [...new Set(items.map((i) => i.topic))]
    .map((topic) => {
      const rows = items.filter((i) => i.topic === topic);
      const correct = rows.filter((i) => i.outcome === "correct").length;
      return { topic, total: rows.length, correct, accuracy: pct(correct, rows.length) };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);

  const total = set.questions.length;
  const taken = Math.min(DAILY_DURATION_SECONDS, Math.round((Date.parse(entry.submittedAt) - Date.parse(entry.startedAt)) / 1000));
  const attempted = entry.correct + entry.incorrect;
  const isToday = date === istDateKey();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow={`Daily Question · ${set.title} · Attempt ${entry.attemptNo}`} title="Test Result">
        <Button asChild variant="outline">
          <Link href="/daily">
            <ArrowLeft /> Daily Question
          </Link>
        </Button>
        {isToday && (
          <Button asChild>
            <Link href="/daily/test">
              <RotateCcw /> Attempt again
            </Link>
          </Button>
        )}
      </PageHeader>
      {entry.timedOut && <p className="-mt-3 mb-5 text-sm text-muted-foreground">Time ran out; the test was submitted automatically with your saved answers.</p>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={Trophy} label="Net score" value={`${formatScore(entry.score)} / ${total}`} sub={`${entry.correct} correct - ${entry.incorrect} wrong × 1/3`} />
        <Kpi icon={Percent} label="Percentage" value={`${formatScore((entry.score / total) * 100)}%`} sub="Net score / total" />
        <Kpi icon={Target} label="Accuracy" value={`${pct(entry.correct, attempted)}%`} sub={`${entry.correct} of ${attempted} attempted`} />
        <Kpi icon={Clock} label="Time taken" value={formatDuration(taken)} sub={`of ${formatDuration(DAILY_DURATION_SECONDS)} allowed`} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:mt-4 sm:gap-4">
        <CountTile icon={CheckCircle2} label="Correct" value={entry.correct} cls="text-success bg-success-soft" />
        <CountTile icon={XCircle} label="Wrong" value={entry.incorrect} cls="text-danger bg-danger-soft" />
        <CountTile icon={CircleSlash} label="Not attempted" value={entry.notAttempted} cls="text-muted-foreground bg-muted" />
      </div>

      <section className="mt-6 rounded-lg border bg-card p-4 sm:p-5">
        <h2 className="font-bold">By topic</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-x-6">
          {topics.map((t) => (
            <li key={t.topic} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium" title={t.topic}>
                  {t.topic}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {t.correct}/{t.total} · <span className="font-bold text-foreground">{t.accuracy}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", t.accuracy >= 50 ? "bg-success" : "bg-danger")} style={{ width: `${Math.max(t.accuracy, 3)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Question review</h2>
        <QuestionReview items={items} />
      </section>
    </div>
  );
}
