import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, ListChecks, Percent, Target, Trophy } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getAllSets } from "@/lib/questions";
import { buildDashboard } from "@/lib/report";
import { formatScore } from "@/lib/scoring";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScoreTrendChart } from "@/components/charts";
import { TopicListMobile } from "@/components/topic-list-mobile";

export const metadata: Metadata = { title: "Dashboard" };

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 font-mono text-2xl font-bold sm:text-3xl">{value}</p>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function TopicBar({ topic, accuracy, answered, tone }: { topic: string; accuracy: number; answered: number; tone: "success" | "danger" }) {
  return (
    <li className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">{topic}</span>
        <span className="shrink-0 font-mono font-bold">{accuracy}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={tone === "success" ? "h-full rounded-full bg-success" : "h-full rounded-full bg-danger"} style={{ width: `${Math.max(accuracy, 3)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{answered} attempted</span>
    </li>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [progress, sets] = await Promise.all([getProgress(user.id), getAllSets()]);
  const d = buildDashboard(progress, sets);
  const fresh = d.questionsAnswered === 0;

  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`Welcome, ${user.username}`}>
        {d.nextUp && (
          <Button asChild variant={d.nextUp.status === "in_progress" ? "accent" : "default"}>
            <Link href={`/practice/${d.nextUp.setId}`}>
              {d.nextUp.status === "in_progress" ? `Resume Set ${d.nextUp.setId} (${d.nextUp.answered}/25)` : `Start Set ${d.nextUp.setId}`}
              <ArrowRight />
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi
          label="Sets done"
          icon={ListChecks}
          value={
            <>
              {d.completedCount}
              <span className="text-lg text-muted-foreground">/{d.totalSets}</span>
            </>
          }
          sub={<Progress value={(d.completedCount / d.totalSets) * 100} label="Sets completed" className="mt-2 h-1.5" />}
        />
        <Kpi label="Average score" icon={Target} value={d.averageScore === null ? "-" : formatScore(d.averageScore)} sub="out of 25, completed sets" />
        <Kpi label="Best set" icon={Trophy} value={d.best ? formatScore(d.best.score!) : "-"} sub={d.best ? `Set ${d.best.setId}` : "Finish a set to see it"} />
        <Kpi label="Accuracy" icon={Percent} value={d.overallAccuracy === null ? "-" : `${d.overallAccuracy}%`} sub={`${d.questionsAnswered} questions answered`} />
      </div>

      {fresh ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-start gap-4 p-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pt-6">
            <div>
              <p className="text-lg font-bold">Ready for your first test?</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Set 1 is open. You&apos;ll see one question at a time with instant feedback. Correct +1, wrong -1/3, and E (Not Attempted) scores 0.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/practice/1">
                Start Set 1 <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Score trend</CardTitle>
              <CardDescription>Net score of every completed attempt, in order.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.trend.length ? (
                <ScoreTrendChart data={d.trend} />
              ) : (
                <p className="text-sm text-muted-foreground">Finish your first set to see your trend.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weak areas</CardTitle>
              <CardDescription>Lowest accuracy across all your answers (min. 2 attempted).</CardDescription>
            </CardHeader>
            <CardContent>
              {d.weakTopics.length ? (
                <ul className="grid gap-4">
                  {d.weakTopics.map((t) => (
                    <TopicBar key={t.topic} topic={t.topic} accuracy={t.accuracy!} answered={t.correct + t.incorrect} tone="danger" />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No weak topics yet (below 60% accuracy). Keep going.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strong areas</CardTitle>
              <CardDescription>75% accuracy or better.</CardDescription>
            </CardHeader>
            <CardContent>
              {d.strongTopics.length ? (
                <ul className="grid gap-4">
                  {d.strongTopics.map((t) => (
                    <TopicBar key={t.topic} topic={t.topic} accuracy={t.accuracy!} answered={t.correct + t.incorrect} tone="success" />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Strong topics show up once you score 75%+ in them.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>All topics</CardTitle>
              <CardDescription>Every topic you have answered so far, weakest first.</CardDescription>
            </CardHeader>
            <CardContent>
              <TopicListMobile rows={d.topicStats} />
              <div className="-mx-4 hidden overflow-x-auto sm:-mx-6 sm:block">
                <table className="w-full min-w-[440px] text-sm">
                  <thead className="border-y bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 pl-4 text-left font-semibold sm:pl-6">Topic</th>
                      <th className="px-3 py-2 text-right font-semibold">Correct</th>
                      <th className="px-3 py-2 text-right font-semibold">Wrong</th>
                      <th className="px-3 py-2 text-right font-semibold">NA</th>
                      <th className="px-3 py-2 pr-4 text-right font-semibold sm:pr-6">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.topicStats.map((t) => (
                      <tr key={t.topic}>
                        <td className="whitespace-nowrap px-3 py-2.5 pl-4 font-medium sm:pl-6">{t.topic}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-success">{t.correct}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-danger">{t.incorrect}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{t.notAttempted}</td>
                        <td className="px-3 py-2.5 pr-4 text-right font-mono font-bold sm:pr-6">{t.accuracy === null ? "-" : `${t.accuracy}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2">
        <Link href="/practice" className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 sm:p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Practice Sets</span>
            <span className="block text-sm text-muted-foreground">{d.unlockedUpTo} of {d.totalSets} unlocked</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/daily" className="group flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 sm:p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground dark:text-accent">
            <CalendarDays className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Daily Question</span>
            <span className="block text-sm text-muted-foreground">New 25-question test every day</span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </>
  );
}
