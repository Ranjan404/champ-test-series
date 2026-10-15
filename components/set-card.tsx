import Link from "next/link";
import { CheckCircle2, Lock, PlayCircle, Timer } from "lucide-react";
import type { SetSummary } from "@/lib/report";
import { formatScore } from "@/lib/scoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ResetButton } from "@/components/reset-button";
import { formatDuration } from "@/lib/bpsc";
import { PRACTICE_DURATION_SECONDS } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatusBadge({ s }: { s: SetSummary }) {
  if (!s.unlocked) return <Badge variant="muted"><Lock className="size-3" /> Locked</Badge>;
  if (s.status === "completed") return <Badge variant="success"><CheckCircle2 className="size-3" /> Completed</Badge>;
  if (s.status === "in_progress") return <Badge variant="warning"><Timer className="size-3" /> In progress</Badge>;
  return <Badge><PlayCircle className="size-3" /> Unlocked</Badge>;
}

/** One set's tile on a set list page. Shared by practice, PYQ and Full Length sets; `pageBase`/`apiBase` pick the section. */
export function SetCard({
  s,
  pageBase = "/practice",
  apiBase = "/api/sets",
  minutes = PRACTICE_DURATION_SECONDS / 60,
  noun = "Set",
}: {
  s: SetSummary;
  pageBase?: string;
  apiBase?: string;
  minutes?: number;
  /** What the tile calls the set ("Set", "Test"). */
  noun?: string;
}) {
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
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{noun}</p>
          <p className="font-mono text-3xl font-bold leading-none">{String(s.setId).padStart(2, "0")}</p>
        </div>
        <StatusBadge s={s} />
      </div>

      <div className="mt-4 min-h-12 text-sm">
        {s.status === "completed" && (
          <p>
            Score <span className="font-mono font-bold">{formatScore(s.score!)}</span>
            <span className="text-muted-foreground"> / {s.total}</span>
            {s.attemptNo > 1 && <span className="block text-xs text-muted-foreground">Attempt {s.attemptNo}</span>}
          </p>
        )}
        {s.status === "in_progress" && (
          <div className="grid gap-1.5">
            <p className="text-muted-foreground">
              {s.answered} of {s.total} answered
              {s.timeLeft !== null && <span className="block text-xs">{formatDuration(s.timeLeft)} left on the timer</span>}
            </p>
            <Progress value={(s.answered / s.total) * 100} label={`${noun} ${s.setId} progress`} />
          </div>
        )}
        {s.status === "not_started" && !locked && <p className="text-muted-foreground">{s.total} questions · {minutes} minutes</p>}
        {locked && (
          <p className="text-muted-foreground">
            Submit {noun} {s.setId - 1} to unlock.
          </p>
        )}
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
              <Link href={`${pageBase}/${s.setId}/result`}>View result</Link>
            </Button>
            <ResetButton apiBase={apiBase} pageBase={pageBase} setId={s.setId} label="Retry" className="flex-1" />
          </>
        ) : s.status === "in_progress" ? (
          <>
            <Button asChild variant="accent" className="flex-1">
              <Link href={`${pageBase}/${s.setId}`}>Resume</Link>
            </Button>
            <ResetButton apiBase={apiBase} pageBase={pageBase} setId={s.setId} label="Reset" className="flex-1" />
          </>
        ) : (
          <Button asChild className="w-full">
            <Link href={`${pageBase}/${s.setId}`}>Start {noun.toLowerCase()}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
