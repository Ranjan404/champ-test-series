"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Bookmark, CloudCheck, Eraser, Grid3x3, Loader2, Save, Send, Timer } from "lucide-react";
import type { DailyAttemptState } from "@/lib/daily";
import { formatDuration } from "@/lib/bpsc";
import type { OptionKey } from "@/lib/types";
import { ALL_OPTIONS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
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

interface Props {
  attempt: DailyAttemptState;
  /** Server clock minus browser clock at load, in ms. */
  clockOffset: number;
}

type Answers = Record<string, OptionKey>;

const resultUrl = (date: string, attemptNo: number) => `/daily/result?date=${date}&attempt=${attemptNo}`;

export function DailyTestRunner({ attempt, clockOffset }: Props) {
  const router = useRouter();
  const qs = attempt.questions;
  const total = qs.length;
  const [answers, setAnswers] = useState<Answers>(attempt.answers);
  const [marked, setMarked] = useState<Set<string>>(() => new Set(attempt.marked));
  const [current, setCurrent] = useState(Math.min(attempt.current, total - 1));
  const [visited, setVisited] = useState<Set<number>>(() => new Set([...Array(attempt.current + 1).keys()]));
  const [now, setNow] = useState(() => Date.now() + clockOffset);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  // Latest snapshot for the unload beacon and the auto-submit.
  const snap = useRef({ answers, marked, current });
  snap.current = { answers, marked, current };

  const remaining = Math.max(0, Math.ceil((attempt.deadline - now) / 1000));

  const save = useCallback(
    async (next: { answers: Answers; marked: Set<string>; current: number }) => {
      if (submittedRef.current) return;
      setSaving("saving");
      try {
        const res = await fetch("/api/daily/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: next.answers, marked: [...next.marked], current: next.current }),
        });
        if (res.status === 401) return window.location.assign("/login?next=/daily/test");
        const data = await res.json().catch(() => null);
        if (data?.expired) {
          submittedRef.current = true;
          return router.replace(resultUrl(data.date, data.attemptNo));
        }
        if (!res.ok) throw new Error(data?.error ?? "Could not save");
        setSaving("saved");
      } catch {
        setSaving("error");
      }
    },
    [router],
  );

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/daily/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: snap.current.answers, marked: [...snap.current.marked] }),
      });
      if (res.status === 401) return window.location.assign("/login?next=/daily/test");
      const data = await res.json().catch(() => null);
      if (res.status === 409) return router.replace("/daily");
      if (!res.ok) throw new Error(data?.error ?? "Could not submit");
      router.replace(resultUrl(data.date, data.attemptNo));
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(`${(e as Error).message || "Network error"}. Check your connection and press Submit again.`);
    }
  }, [router]);

  // Countdown; auto-submits at zero.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffset), 1000);
    return () => clearInterval(t);
  }, [clockOffset]);
  useEffect(() => {
    if (remaining === 0) void submit();
  }, [remaining, submit]);

  // Closing the tab or switching apps on a phone: save what is on screen.
  useEffect(() => {
    const flush = () => {
      if (submittedRef.current || document.visibilityState === "visible") return;
      const s = snap.current;
      navigator.sendBeacon?.("/api/daily/save", JSON.stringify({ answers: s.answers, marked: [...s.marked], current: s.current }));
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const q = qs[current];
  const selected = answers[q.id] ?? null;
  const answered = qs.filter((x) => answers[x.id]).length;
  const isMarked = marked.has(q.id);

  const goTo = (i: number, nextMarked = marked) => {
    const idx = Math.min(Math.max(0, i), total - 1);
    setCurrent(idx);
    setVisited((v) => new Set(v).add(idx));
    void save({ answers, marked: nextMarked, current: idx });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const choose = (opt: OptionKey) => {
    setAnswers((a) => ({ ...a, [q.id]: opt }));
    setSaving("idle");
  };
  const clear = () => {
    setAnswers(({ [q.id]: _removed, ...rest }) => rest);
    setSaving("idle");
  };
  const toggleMark = () => {
    setMarked((m) => {
      const n = new Set(m);
      if (n.has(q.id)) n.delete(q.id);
      else n.add(q.id);
      return n;
    });
    setSaving("idle");
  };
  const saveAndNext = () => (current < total - 1 ? goTo(current + 1) : void save({ answers, marked, current }));
  const markAndNext = () => {
    const n = new Set(marked).add(q.id);
    setMarked(n);
    if (current < total - 1) goTo(current + 1, n);
    else void save({ answers, marked: n, current });
  };

  if (submitting) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center" role="status">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 font-semibold">{remaining === 0 ? "Time is up. Submitting your answers…" : "Submitting your answers…"}</p>
      </div>
    );
  }

  return (
    <div className="pb-28 lg:pb-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Daily Question · {attempt.title} · Attempt {attempt.attemptNo}
          </p>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            Question {current + 1} <span className="font-semibold text-muted-foreground">of {total}</span>
          </h1>
        </div>
        <TimerChip remaining={remaining} />
      </div>
      <MarkingBanner className="mb-4" />
      <Progress value={(answered / total) * 100} label="Questions answered" className="mb-5" />

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="muted">Single correct</Badge>
              {isMarked && (
                <Badge variant="warning">
                  <Bookmark className="size-3" /> Marked for review
                </Badge>
              )}
              <SaveStatus state={saving} />
            </div>
            <p className="q-text mb-5 text-base font-semibold leading-relaxed sm:text-lg">{q.question}</p>
            <div role="radiogroup" aria-label="Answer options" className="grid gap-2.5">
              {ALL_OPTIONS.map((key) => {
                const on = selected === key;
                const optOut = key === "E";
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => choose(key)}
                    className={cn(
                      "flex min-h-14 items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4",
                      optOut && "border-dashed",
                      on && "border-primary bg-primary/5 ring-1 ring-primary hover:bg-primary/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border-2 font-mono text-xs font-bold",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground",
                      )}
                    >
                      {key}
                    </span>
                    <span className={cn("q-text min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed", optOut && "text-muted-foreground")}>{q.options[key]}</span>
                    {optOut && <span className="shrink-0 pt-1 font-mono text-xs font-semibold text-muted-foreground">0</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={clear} disabled={selected === null}>
              <Eraser /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={toggleMark} aria-pressed={isMarked}>
              <Bookmark /> {isMarked ? "Unmark" : "Mark for review"}
            </Button>
            <Button variant="outline" size="sm" onClick={markAndNext} className="hidden sm:inline-flex">
              <Bookmark /> Mark & Next
            </Button>
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <Palette questions={qs} answers={answers} marked={marked} visited={visited} current={current} onJump={(i) => goTo(i)} />
          <SubmitButton total={total} answered={answered} marked={marked.size} remaining={remaining} onSubmit={submit} className="hidden w-full lg:inline-flex" />
        </aside>
      </div>

      {/* Navigation: sticky at the bottom on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <Button variant="outline" onClick={() => goTo(current - 1)} disabled={current === 0} aria-label="Previous question">
            <ArrowLeft /> <span className="hidden sm:inline">Previous</span>
          </Button>
          <SubmitButton total={total} answered={answered} marked={marked.size} remaining={remaining} onSubmit={submit} variant="outline" className="lg:hidden" />
          <Button onClick={saveAndNext} className="ml-auto min-w-32">
            {current < total - 1 ? (
              <>
                Save & Next <ArrowRight />
              </>
            ) : (
              <>
                <Save /> Save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SaveStatus({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
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

function TimerChip({ remaining }: { remaining: number }) {
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

function MarkingBanner({ className }: { className?: string }) {
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

function Palette({
  questions,
  answers,
  marked,
  visited,
  current,
  onJump,
}: {
  questions: DailyAttemptState["questions"];
  answers: Answers;
  marked: Set<string>;
  visited: Set<number>;
  current: number;
  onJump: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
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
        aria-controls="daily-palette"
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <Grid3x3 className="size-4" /> Question Palette
        </span>
        <span className="text-xs text-muted-foreground lg:hidden">{open ? "Hide" : "Show"}</span>
      </button>
      <div id="daily-palette" className={cn("mt-3", !open && "hidden lg:block")}>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-5">
          {cells.map((c, i) => (
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

function SubmitButton({
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
