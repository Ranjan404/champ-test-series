import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Lock, PlayCircle, Timer } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getProgress } from "@/lib/store";
import { getAllSets } from "@/lib/questions";
import { buildSetList, type SetSummary } from "@/lib/report";
import { formatScore } from "@/lib/scoring";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ResetButton } from "@/components/reset-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Practice Sets" };

function StatusBadge({ s }: { s: SetSummary }) {
  if (!s.unlocked) return <Badge variant="muted"><Lock className="size-3" /> Locked</Badge>;
  if (s.status === "completed") return <Badge variant="success"><CheckCircle2 className="size-3" /> Completed</Badge>;
  if (s.status === "in_progress") return <Badge variant="warning"><Timer className="size-3" /> In progress</Badge>;
  return <Badge><PlayCircle className="size-3" /> Unlocked</Badge>;
}

function SetCard({ s }: { s: SetSummary }) {
  const locked = !s.unlocked;
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-card p-4 transition-shadow sm:p-5",
        locked ? "opacity-70" : "hover:shadow-md",
        s.status === "in_progress" && "border-warning/60",
        s.status === "completed" && "border-success/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Set</p>
          <p className="font-mono text-3xl font-bold leading-none">{String(s.setId).padStart(2, "0")}</p>
        </div>
        <StatusBadge s={s} />
      </div>

      <div className="mt-4 min-h-12 text-sm">
        {s.status === "completed" && (
          <p>
            Score <span className="font-mono font-bold">{formatScore(s.score!)}</span>
            <span className="text-muted-foreground"> / {s.total}</span>
            {s.attempts > 1 && <span className="block text-xs text-muted-foreground">Best {formatScore(s.bestScore!)} · {s.attempts} attempts</span>}
          </p>
        )}
        {s.status === "in_progress" && (
          <div className="grid gap-1.5">
            <p className="text-muted-foreground">{s.answered} of {s.total} answered</p>
            <Progress value={(s.answered / s.total) * 100} label={`Set ${s.setId} progress`} />
          </div>
        )}
        {s.status === "not_started" && !locked && <p className="text-muted-foreground">{s.total} questions · not started</p>}
        {locked && <p className="text-muted-foreground">Answer all questions of Set {s.setId - 1} to unlock.</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {locked ? (
          <Button variant="outline" disabled className="w-full">
            <Lock /> Locked
          </Button>
        ) : !s.available ? (
          <Button variant="outline" disabled className="w-full">Coming soon</Button>
        ) : s.status === "completed" ? (
          <>
            <Button asChild className="flex-1">
              <Link href={`/practice/${s.setId}/result`}>View result</Link>
            </Button>
            <ResetButton setId={s.setId} label="Retry" className="flex-1" />
          </>
        ) : s.status === "in_progress" ? (
          <>
            <Button asChild variant="accent" className="flex-1">
              <Link href={`/practice/${s.setId}`}>Resume</Link>
            </Button>
            <ResetButton setId={s.setId} label="Reset" className="flex-1" />
          </>
        ) : (
          <Button asChild className="w-full">
            <Link href={`/practice/${s.setId}`}>Start set</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export default async function PracticePage() {
  const user = await requireUser();
  const [progress, sets] = await Promise.all([getProgress(user.id), getAllSets()]);
  const list = buildSetList(progress, sets);
  const done = list.filter((s) => s.status === "completed").length;
  const unlocked = list.filter((s) => s.unlocked).length;

  return (
    <>
      <PageHeader eyebrow="Practice" title="Practice Sets">
        <Badge variant="success" className="px-3 py-1 text-sm">{done} completed</Badge>
        <Badge className="px-3 py-1 text-sm">{unlocked} unlocked</Badge>
      </PageHeader>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-muted-foreground sm:-mt-5">
        Each set has 25 questions from across the syllabus. Correct +1, wrong -1/3, Not Attempted 0. Answer every question in a set to unlock
        the next one. Unlocked sets stay unlocked even if you reset.
      </p>
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((s) => (
          <SetCard key={s.setId} s={s} />
        ))}
      </div>
    </>
  );
}
