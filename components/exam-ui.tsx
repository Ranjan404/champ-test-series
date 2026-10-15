"use client";
import { useId, useState } from "react";
import { CloudCheck, Grid3x3, Loader2, Send, Timer } from "lucide-react";
import { formatDuration } from "@/lib/bpsc";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

// Pieces shared by the timed tests (Daily Question, Practice Sets, PYQs and Full Length Tests).

export function SaveStatus({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  return (
    <span
      aria-live="polite"
      className={cn("ml-auto inline-flex items-center gap-1 text-xs font-medium", state === "error" ? "text-danger" : "text-muted-foreground")}
    >
      {state === "saving" && (
        <>
          <Loader2 className="size-3 animate-spin" /> Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <CloudCheck className="size-3.5" /> Saved
        </>
      )}
      {state === "error" && "Not saved, will retry on next move"}
    </span>
  );
}

export function TimerChip({ remaining }: { remaining: number }) {
  const low = remaining <= 60;
  return (
    <div
      role="timer"
      aria-live={low ? "polite" : "off"}
      aria-label={`Time left ${formatDuration(remaining)}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-lg font-bold tabular-nums",
        low ? "border-danger/60 bg-danger-soft text-danger" : remaining <= 300 ? "border-warning/60 bg-warning-soft" : "bg-card",
      )}
    >
      <Timer className="size-4" /> {formatDuration(remaining)}
    </div>
  );
}

export function MarkingBanner({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold", className)}>
      <span className="text-success">+1 for correct</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-danger">-1/3 for wrong</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">0 for option E or unattempted</span>
    </div>
  );
}

type Cell = "answered" | "answered_marked" | "marked" | "skipped" | "unvisited";

const cellClass: Record<Cell, string> = {
  answered: "border-success bg-success text-white",
  answered_marked: "border-warning bg-warning text-accent-foreground ring-2 ring-success ring-offset-1 ring-offset-card",
  marked: "border-warning bg-warning-soft text-accent-foreground dark:text-warning",
  skipped: "border-danger/60 bg-danger-soft text-danger",
  unvisited: "border-input bg-card text-muted-foreground",
};

const legend: { cell: Cell; label: string }[] = [
  { cell: "answered", label: "Answered" },
  { cell: "skipped", label: "Not answered" },
  { cell: "marked", label: "Marked" },
  { cell: "answered_marked", label: "Answered + marked" },
  { cell: "unvisited", label: "Not visited" },
];

export function Palette({
  questions,
  answers,
  marked,
  visited,
  current,
  onJump,
  sections = [],
}: {
  questions: { id: string }[];
  /** Any truthy value counts as answered. */
  answers: Record<string, unknown>;
  marked: Set<string>;
  visited: Set<number>;
  current: number;
  onJump: (i: number) => void;
  /** Groups the cells under section headings (Full Length Tests). */
  sections?: { name: string; from: number; to: number }[];
}) {
  const [open, setOpen] = useState(false);
  const paletteId = useId();
  const cellOf = (i: number): Cell => {
    const id = questions[i].id;
    const a = !!answers[id];
    if (a && marked.has(id)) return "answered_marked";
    if (marked.has(id)) return "marked";
    if (a) return "answered";
    return visited.has(i) ? "skipped" : "unvisited";
  };
  const cells = questions.map((_, i) => cellOf(i));
  const counts = cells.reduce((acc, c) => ({ ...acc, [c]: acc[c] + 1 }), { answered: 0, answered_marked: 0, marked: 0, skipped: 0, unvisited: 0 } as Record<Cell, number>);
  return (
    <div className="rounded-lg border bg-card p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left lg:pointer-events-none"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={paletteId}
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <Grid3x3 className="size-4" /> Question Palette
        </span>
        <span className="text-xs text-muted-foreground lg:hidden">{open ? "Hide" : "Show"}</span>
      </button>
      <div id={paletteId} className={cn("mt-3", !open && "hidden lg:block")}>
        <div className={cn(questions.length > 50 && "lg:max-h-[55vh] lg:overflow-y-auto lg:pr-1")}>
          {(sections.length ? sections : [{ name: "", from: 1, to: questions.length }]).map((sec) => (
            <div key={sec.name || "all"} className="mb-3 last:mb-0">
              {sec.name && (
                <p className="sticky top-0 z-10 mb-2 bg-card py-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {sec.name} <span className="font-mono font-medium">({sec.from}-{sec.to})</span>
                </p>
              )}
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-5">
                {cells.slice(sec.from - 1, sec.to).map((c, k) => {
                  const i = sec.from - 1 + k;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onJump(i)}
                      aria-label={`Question ${i + 1}: ${legend.find((l) => l.cell === c)!.label}`}
                      aria-current={i === current ? "step" : undefined}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md border font-mono text-sm font-bold transition-transform hover:scale-105",
                        cellClass[c],
                        i === current && "outline-2 outline-offset-2 outline-primary",
                      )}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {legend.map(({ cell, label }) => (
            <li key={cell} className="flex items-center gap-1.5">
              <span className={cn("size-3.5 shrink-0 rounded-sm border", cellClass[cell], cell === "answered_marked" && "ring-1 ring-offset-0")} />
              <span className="text-muted-foreground">
                {label} <span className="font-mono font-semibold text-foreground">{counts[cell]}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SubmitButton({
  total,
  answered,
  marked,
  remaining,
  onSubmit,
  variant = "accent",
  className,
}: {
  total: number;
  answered: number;
  marked: number;
  remaining: number;
  onSubmit: () => void;
  variant?: "accent" | "outline";
  className?: string;
}) {
  const left = total - answered;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} className={className}>
          <Send /> Submit
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>Submit the test?</AlertDialogTitle>
        <AlertDialogDescription>You cannot change answers after submitting. {formatDuration(remaining)} is still left on the timer.</AlertDialogDescription>
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Answered" value={answered} tone="text-success" />
          <Stat label="Unanswered" value={left} tone={left ? "text-danger" : undefined} />
          <Stat label="Marked" value={marked} tone={marked ? "text-accent-foreground dark:text-warning" : undefined} />
        </dl>
        {left > 0 && <p className="text-sm text-muted-foreground">Unanswered questions score 0. Wrong answers cost 1/3 mark.</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep going</AlertDialogCancel>
          <AlertDialogAction onClick={onSubmit} className={buttonVariants({ variant: "default" })}>
            Submit test
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-muted px-2 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono text-2xl font-bold", tone)}>{value}</dd>
    </div>
  );
}
