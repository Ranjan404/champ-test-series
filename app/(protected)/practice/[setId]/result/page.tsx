import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, BookOpen, Repeat, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getAllSets, getSet, parseSetId } from "@/lib/questions";
import { buildSetReport } from "@/lib/report";
import { formatScore } from "@/lib/scoring";
import { formatDuration } from "@/lib/bpsc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResetButton } from "@/components/reset-button";
import { OutcomeBarChart } from "@/components/charts";
import { QuestionReview } from "@/components/question-review";
import { TopicListMobile } from "@/components/topic-list-mobile";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ setId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Set ${(await params).setId} Result` };
}

const acc = (n: number | null) => (n === null ? "-" : `${n}%`);

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-bold sm:text-3xl", tone)}>{value}</p>
    </div>
  );
}

function Section({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const th = "px-2 sm:px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:whitespace-nowrap";
const td = "px-2 sm:px-3 py-2.5 whitespace-nowrap";

export default async function ResultPage({ params }: Props) {
  const user = await requireUser();
  const setId = parseSetId((await params).setId);
  const set = setId ? await getSet(setId) : null;
  if (!set) notFound();
  const progress = await getProgress(user.id);
  if (progress.sets[set.setId]?.status !== "completed") redirect(progress.unlockedUpTo >= set.setId ? `/practice/${set.setId}` : "/practice");
  const r = buildSetReport(set, progress, await getAllSets());
  const s = r.summary;
  const delta = r.previousScore !== null ? Math.round((s.score - r.previousScore) * 100) / 100 : null;

  return (
    <div className="grid gap-4 sm:gap-6">
      {/* Final result */}
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-4 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_60%)] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              {r.title} · Final Result{r.attemptNo > 1 ? ` · Attempt ${r.attemptNo}` : ""}
            </p>
            <p className="mt-2 font-mono text-5xl font-bold tracking-tight sm:text-6xl">
              {formatScore(s.score)}
              <span className="text-2xl text-muted-foreground sm:text-3xl"> / {s.total}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Percentage <span className="font-semibold text-foreground">{s.percentage}%</span> · net marks after +1 / -1/3 / 0
              {r.timeTaken !== null && (
                <>
                  {" "}
                  · Time <span className="font-semibold text-foreground">{formatDuration(r.timeTaken)}</span> of {formatDuration(r.durationSeconds)}
                </>
              )}
            </p>
            {r.timedOut && <p className="mt-1 text-sm text-muted-foreground">Time ran out; the set was submitted automatically with your saved answers.</p>}
            {delta !== null && (
              <p className={cn("mt-2 inline-flex items-center gap-1.5 text-sm font-semibold", delta >= 0 ? "text-success" : "text-danger")}>
                {delta >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                Score {delta >= 0 ? "improved" : "dropped"} from {formatScore(r.previousScore!)} to {formatScore(s.score)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 min-[420px]:flex-row">
            {r.hasNextSet && r.nextUnlocked && (
              <Button asChild>
                <Link href={`/practice/${r.setId + 1}`}>
                  Next set <ArrowRight />
                </Link>
              </Button>
            )}
            <ResetButton setId={r.setId} label="Retry this set" goToTest />
            <Button asChild variant="ghost">
              <Link href="/practice">Back to Practice</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t p-3 sm:gap-4 sm:p-6">
          <Stat label="Correct" value={s.correct} tone="text-success" />
          <Stat label="Incorrect" value={s.incorrect} tone="text-danger" />
          <Stat label="Not attempted" value={s.notAttempted} tone="text-muted-foreground" />
        </div>
      </section>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        {/* Topic-wise performance */}
        <Section title="Topic-wise performance" description="Only topics that appeared in this set. Accuracy = correct ÷ attempted." className="lg:col-span-3">
          <TopicListMobile rows={r.topics} />
          <div className="-mx-4 hidden overflow-x-auto sm:-mx-6 sm:block">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-y bg-muted/50">
                <tr>
                  <th className={cn(th, "pl-4 sm:pl-6")}>Topic</th>
                  <th className={cn(th, "text-right")}>Qs</th>
                  <th className={cn(th, "text-right")}>Correct</th>
                  <th className={cn(th, "text-right")}>Wrong</th>
                  <th className={cn(th, "text-right")}>NA</th>
                  <th className={cn(th, "pr-4 text-right sm:pr-6")}>Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.topics.map((t) => (
                  <tr key={t.topic}>
                    <td className={cn(td, "pl-4 font-medium sm:pl-6")}>{t.topic}</td>
                    <td className={cn(td, "text-right font-mono")}>{t.questions}</td>
                    <td className={cn(td, "text-right font-mono text-success")}>{t.correct}</td>
                    <td className={cn(td, "text-right font-mono text-danger")}>{t.incorrect}</td>
                    <td className={cn(td, "text-right font-mono text-muted-foreground")}>{t.notAttempted}</td>
                    <td className={cn(td, "pr-4 text-right font-mono font-bold sm:pr-6")}>{acc(t.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Difficulty performance */}
        <Section title="Difficulty performance" className="lg:col-span-2">
          <OutcomeBarChart
            category="difficulty"
            data={r.difficulty.map((d) => ({ name: d.difficulty, correct: d.correct, incorrect: d.incorrect, notAttempted: d.total - d.attempted }))}
          />
          <div className="-mx-4 mt-4 overflow-x-auto sm:-mx-6">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/50">
                <tr>
                  <th className={cn(th, "pl-4 sm:pl-6")}>Difficulty</th>
                  <th className={cn(th, "text-right")}>Attempted</th>
                  <th className={cn(th, "text-right")}>Correct</th>
                  <th className={cn(th, "pr-4 text-right sm:pr-6")}>Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.difficulty.map((d) => (
                  <tr key={d.difficulty}>
                    <td className={cn(td, "pl-4 font-medium sm:pl-6")}>{d.difficulty}</td>
                    <td className={cn(td, "text-right font-mono")}>
                      {d.attempted}/{d.total}
                    </td>
                    <td className={cn(td, "text-right font-mono")}>{d.correct}</td>
                    <td className={cn(td, "pr-4 text-right font-mono font-bold sm:pr-6")}>{acc(d.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Strong areas */}
        <Section title="Strong areas" description="Based only on questions you answered correctly.">
          {r.strongConcepts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No correct answers in this attempt yet. Use the revision plan below to build up.</p>
          ) : (
            <div className="grid gap-3">
              {r.strongTopics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {r.strongTopics.map((t) => (
                    <Badge key={t} variant="success">
                      <Sparkles className="size-3" /> {t}
                    </Badge>
                  ))}
                </div>
              )}
              <ul className="grid gap-1.5 text-sm">
                {r.strongConcepts.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-success" />
                    <span>
                      {c.concept} <span className="text-muted-foreground">· {c.topic}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        {/* Mistake analysis */}
        <Section title="Mistake analysis" description="What kind of error each wrong option usually points to.">
          {r.mistakes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incorrect answers in this set. {s.notAttempted > 0 && `${s.notAttempted} question(s) were left Not Attempted.`}</p>
          ) : (
            <ul className="grid gap-3">
              {r.mistakes.map((m) => (
                <li key={m.type} className="rounded-md border p-3">
                  <p className="font-semibold">
                    <span className="font-mono text-danger">{m.total}</span> {m.type} error{m.total > 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{m.byTopic.map((b) => `${b.count} in ${b.topic}`).join(", ")}</p>
                </li>
              ))}
              {s.notAttempted > 0 && <li className="text-sm text-muted-foreground">Plus {s.notAttempted} Not Attempted (no marks lost).</li>}
            </ul>
          )}
        </Section>
      </div>

      {/* Improvement areas */}
      <Section title="Improvement areas" description="For each topic where you lost or skipped marks: what was missed, what to revise, and how to practise.">
        {r.improvement.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to improve in this set. Every question was answered correctly.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {r.improvement.map((imp) => (
              <div key={imp.topic} className="rounded-lg border p-4">
                <p className="font-bold">{imp.topic}</p>
                <ul className="mt-2 grid gap-1 text-sm">
                  {imp.missed.map((m, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", m.outcome === "incorrect" ? "bg-danger" : "bg-muted-foreground")} />
                      <span>
                        <span className="font-medium">{m.subtopic}:</span> {m.concept}
                        {m.outcome === "not_attempted" && <span className="text-muted-foreground"> (skipped)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-start gap-2 text-sm">
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>
                    Revise: <span className="font-mono text-xs">{imp.revise.join(", ")}</span>
                  </span>
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">{imp.tip}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        {/* Revision plan */}
        <Section title="Revision plan" description="In priority order. Repeated weaknesses from your other sets rank higher." className="lg:col-span-3">
          {r.revisionPlan.length === 0 ? (
            <p className="text-sm text-muted-foreground">No revision needed from this set.</p>
          ) : (
            <ol className="grid gap-3">
              {r.revisionPlan.map((p, i) => (
                <li key={`${p.topic}-${p.subtopic}`} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-bold text-primary">{i + 1}</span>
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold">
                      {p.topic} <span className="font-normal text-muted-foreground">› {p.subtopic}</span>
                      {p.repeated && (
                        <Badge variant="danger" className="ml-2 align-middle">
                          <Repeat className="size-3" /> Repeated
                        </Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground">{p.concepts.join("; ")}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.note} Source: <span className="font-mono">{p.refs.join(", ")}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* PYQ performance */}
        <Section title="PYQ performance" className="lg:col-span-2">
          {r.pyq ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Attempted" value={r.pyq.attempted} />
              <Stat label="Correct" value={r.pyq.correct} tone="text-success" />
              <Stat label="Wrong" value={r.pyq.wrong} tone="text-danger" />
            </div>
          ) : (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              No PYQ-tagged questions in this set. The syllabus files don&apos;t attribute questions to a specific exam year, so every question is
              tagged Generated.
            </p>
          )}
        </Section>
      </div>

      {/* Question review */}
      <Section title="Question review" description="Tap a question to see your answer, the correct answer and the explanation.">
        <QuestionReview items={r.review} />
      </Section>

      <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:justify-center">
        <ResetButton setId={r.setId} label="Retry this set" goToTest size="lg" />
        {r.hasNextSet && r.nextUnlocked && (
          <Button asChild size="lg">
            <Link href={`/practice/${r.setId + 1}`}>
              Next set <ArrowRight />
            </Link>
          </Button>
        )}
        <Button asChild size="lg" variant="ghost">
          <Link href="/practice">Back to Practice</Link>
        </Button>
      </div>
    </div>
  );
}
