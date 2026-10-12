"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  Bookmark,
  CheckCircle2,
  CircleSlash,
  Clock,
  Eraser,
  Grid3x3,
  Percent,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Timer,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  formatDuration,
  OPT_OUT_INDEX,
  OPT_OUT_LABEL,
  scoreBpscTest,
  SECONDS_PER_QUESTION,
  topicLabel,
  WRONG_MARK_LABEL,
  type BpscAnswers,
  type BpscTest,
} from "@/lib/bpsc";
import { formatScore } from "@/lib/scoring";
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

const LETTERS = ["A", "B", "C", "D", "E"] as const;

export interface RunnerState {
  answers: BpscAnswers;
  marked: boolean[];
  visited: boolean[];
  current: number;
  startedAt: number;
  /** Set once the test is submitted (by the candidate or by the timer). */
  submittedAt: number | null;
}

export function freshRunnerState(count: number): RunnerState {
  return {
    answers: Array(count).fill(null),
    marked: Array(count).fill(false),
    visited: [true, ...Array(count - 1).fill(false)],
    current: 0,
    startedAt: Date.now(),
    submittedAt: null,
  };
}

interface Props {
  test: BpscTest;
  initial: RunnerState;
  /** Called on every change so the parent can persist progress across reloads. */
  onChange?: (s: RunnerState) => void;
  onRetake: () => void;
  onNewSet: () => void;
}

export function BpscTestRunner({ test, initial, onChange, onRetake, onNewSet }: Props) {
  const [s, setS] = useState(initial);
  const total = test.questions.length;
  const deadline = s.startedAt + total * SECONDS_PER_QUESTION * 1000;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    onChange?.(s);
  }, [s, onChange]);

  // Countdown; auto-submits at zero.
  useEffect(() => {
    if (s.submittedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s.submittedAt]);
  useEffect(() => {
    if (!s.submittedAt && now >= deadline) setS((p) => ({ ...p, submittedAt: deadline }));
  }, [now, deadline, s.submittedAt]);

  if (s.submittedAt) {
    return <ResultScreen test={test} state={s} onRetake={onRetake} onNewSet={onNewSet} />;
  }

  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const q = test.questions[s.current];
  const selected = s.answers[s.current];
  const answered = s.answers.filter((a) => a !== null).length;

  const goTo = (i: number) =>
    setS((p) => ({ ...p, current: i, visited: p.visited.map((v, j) => v || j === i) }));
  const choose = (opt: number) => setS((p) => ({ ...p, answers: p.answers.map((a, j) => (j === p.current ? opt : a)) }));
  const clear = () => setS((p) => ({ ...p, answers: p.answers.map((a, j) => (j === p.current ? null : a)) }));
  const toggleMark = () => setS((p) => ({ ...p, marked: p.marked.map((m, j) => (j === p.current ? !m : m)) }));
  const next = () => s.current < total - 1 && goTo(s.current + 1);
  const markAndNext = () => {
    setS((p) => ({ ...p, marked: p.marked.map((m, j) => (j === p.current ? true : m)) }));
    next();
  };
  const submit = () => setS((p) => ({ ...p, submittedAt: Date.now() }));

  return (
    <div className="pb-28 lg:pb-0">
      {/* Header: section, timer, marking scheme */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">BPSC TRE 4.0 · {topicLabel(test.topic)}</p>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            Question {s.current + 1} <span className="font-semibold text-muted-foreground">of {total}</span>
          </h1>
        </div>
        <TimerChip remaining={remaining} />
      </div>
      <MarkingBanner className="mb-4" />
      <Progress value={(answered / total) * 100} label="Questions answered" className="mb-5" />

      <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6" lang={test.language}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="muted">{q.subTopic}</Badge>
              {s.marked[s.current] && (
                <Badge variant="warning">
                  <Bookmark className="size-3" /> Marked for review
                </Badge>
              )}
            </div>
            <p className="q-text mb-5 text-base font-semibold leading-relaxed sm:text-lg">{q.question}</p>
            <div role="radiogroup" aria-label="Answer options" className="grid gap-2.5">
              {[...q.options, OPT_OUT_LABEL[test.language]].map((text, i) => {
                const on = selected === i;
                const optOut = i === OPT_OUT_INDEX;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => choose(i)}
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
                      {LETTERS[i]}
                    </span>
                    <span className={cn("q-text min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed", optOut && "text-muted-foreground")}>{text}</span>
                    {optOut && <span className="shrink-0 pt-1 font-mono text-xs font-semibold text-muted-foreground">0</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={clear} disabled={selected === null}>
              <Eraser /> Clear
            </Button>
            <Button variant="outline" size="sm" onClick={toggleMark} aria-pressed={s.marked[s.current]}>
              <Bookmark /> {s.marked[s.current] ? "Unmark" : "Mark for review"}
            </Button>
            {s.current < total - 1 && (
              <Button variant="outline" size="sm" onClick={markAndNext} className="hidden sm:inline-flex">
                <Bookmark /> Mark & Next
              </Button>
            )}
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <Palette state={s} onJump={goTo} />
          <SubmitButton state={s} remaining={remaining} onSubmit={submit} className="hidden w-full lg:inline-flex" />
        </aside>
      </div>

      {/* Navigation: sticky at the bottom on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <Button variant="outline" onClick={() => goTo(s.current - 1)} disabled={s.current === 0} aria-label="Previous question">
            <ArrowLeft /> <span className="hidden sm:inline">Previous</span>
          </Button>
          <SubmitButton state={s} remaining={remaining} onSubmit={submit} variant="outline" className="lg:hidden" />
          <Button onClick={next} disabled={s.current === total - 1} className="ml-auto min-w-32">
            Save & Next <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
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
      <span className="text-danger">{WRONG_MARK_LABEL} for wrong</span>
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground">0 for option E or unattempted</span>
    </div>
  );
}

type Cell = "current" | "answered" | "answered_marked" | "marked" | "skipped" | "unvisited";

function cellState(s: RunnerState, i: number): Cell {
  const a = s.answers[i] !== null;
  if (a && s.marked[i]) return "answered_marked";
  if (s.marked[i]) return "marked";
  if (a) return "answered";
  return s.visited[i] ? "skipped" : "unvisited";
}

const cellClass: Record<Cell, string> = {
  current: "",
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

function Palette({ state, onJump }: { state: RunnerState; onJump: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const counts = state.answers.reduce(
    (acc, _, i) => {
      acc[cellState(state, i)]++;
      return acc;
    },
    { answered: 0, answered_marked: 0, marked: 0, skipped: 0, unvisited: 0, current: 0 } as Record<Cell, number>,
  );
  return (
    <div className="rounded-lg border bg-card p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left lg:pointer-events-none"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="bpsc-palette"
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <Grid3x3 className="size-4" /> Question Palette
        </span>
        <span className="text-xs text-muted-foreground lg:hidden">{open ? "Hide" : "Show"}</span>
      </button>
      <div id="bpsc-palette" className={cn("mt-3", !open && "hidden lg:block")}>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10 lg:grid-cols-5">
          {state.answers.map((_, i) => {
            const c = cellState(state, i);
            const current = i === state.current;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onJump(i)}
                aria-label={`Question ${i + 1}: ${legend.find((l) => l.cell === c)!.label}`}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border font-mono text-sm font-bold transition-transform hover:scale-105",
                  cellClass[c],
                  current && "outline-2 outline-offset-2 outline-primary",
                )}
              >
                {i + 1}
              </button>
            );
          })}
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
  state,
  remaining,
  onSubmit,
  variant = "accent",
  className,
}: {
  state: RunnerState;
  remaining: number;
  onSubmit: () => void;
  variant?: "accent" | "outline";
  className?: string;
}) {
  const answered = state.answers.filter((a) => a !== null).length;
  const marked = state.marked.filter(Boolean).length;
  const left = state.answers.length - answered;
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
        {left > 0 && <p className="text-sm text-muted-foreground">Unanswered questions score 0. Wrong answers cost {WRONG_MARK_LABEL}.</p>}
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

/* ---------------------------------------------------------------- Result screen */

type Filter = "all" | "wrong" | "correct" | "unattempted";

function ResultScreen({ test, state, onRetake, onNewSet }: { test: BpscTest; state: RunnerState; onRetake: () => void; onNewSet: () => void }) {
  const r = useMemo(() => scoreBpscTest(test.questions, state.answers), [test, state.answers]);
  const [filter, setFilter] = useState<Filter>("all");
  const taken = Math.round(((state.submittedAt ?? Date.now()) - state.startedAt) / 1000);
  const allowed = test.questions.length * SECONDS_PER_QUESTION;

  const outcomeOf = (a: number | null, correctIndex: number) =>
    a === null || a === OPT_OUT_INDEX ? "unattempted" : a === correctIndex ? "correct" : "wrong";
  const rows = test.questions
    .map((q, i) => ({ q, i, a: state.answers[i] }))
    .filter(({ q, a }) => filter === "all" || outcomeOf(a, q.correctIndex) === filter);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">BPSC TRE 4.0 · {topicLabel(test.topic)}</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Test Result</h1>
          {taken >= allowed && <p className="mt-1 text-sm text-muted-foreground">Time ran out; the test was submitted automatically.</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onRetake}>
            <RotateCcw /> Retake Test
          </Button>
          <Button onClick={onNewSet}>
            <Sparkles /> Generate New Set
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={Trophy} label="Net score" value={`${formatScore(r.net)} / ${r.total}`} sub={`${r.correct} correct - ${r.wrong} wrong × 1/3`} />
        <Kpi icon={Percent} label="Percentage" value={`${formatScore(r.percentage)}%`} sub="Net score / total" />
        <Kpi icon={Target} label="Accuracy" value={`${formatScore(r.accuracy)}%`} sub={`${r.correct} of ${r.correct + r.wrong} attempted`} />
        <Kpi icon={Clock} label="Time taken" value={formatDuration(Math.min(taken, allowed))} sub={`of ${formatDuration(allowed)} allowed`} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:mt-4 sm:grid-cols-4 sm:gap-4">
        <CountTile icon={CheckCircle2} label="Correct" value={r.correct} cls="text-success bg-success-soft" />
        <CountTile icon={XCircle} label="Wrong" value={r.wrong} cls="text-danger bg-danger-soft" />
        <CountTile icon={Ban} label="Option E" value={r.optedOut} cls="text-muted-foreground bg-muted" />
        <CountTile icon={CircleSlash} label="Unattempted" value={r.unattempted} cls="text-muted-foreground bg-muted" />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 sm:p-5">
          <h2 className="font-bold">Weak topics</h2>
          {r.weak.length ? (
            <ul className="mt-3 grid gap-3">
              {r.weak.slice(0, 6).map((w) => (
                <TopicRow key={w.subTopic} name={w.subTopic} accuracy={w.accuracy} detail={`${w.correct}/${w.total} correct`} tone="danger" />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No weak topics in this set. Well done.</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4 sm:p-5">
          <h2 className="font-bold">By sub-topic</h2>
          <ul className="mt-3 grid max-h-72 gap-3 overflow-y-auto pr-1">
            {r.subTopics.map((t) => (
              <TopicRow key={t.subTopic} name={t.subTopic} accuracy={t.accuracy} detail={`${t.correct}/${t.total}`} tone={t.accuracy >= 50 ? "success" : "danger"} />
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Question review</h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter questions">
            {(
              [
                ["all", `All ${r.total}`],
                ["wrong", `Wrong ${r.wrong}`],
                ["correct", `Correct ${r.correct}`],
                ["unattempted", `Skipped ${r.unattempted + r.optedOut}`],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm font-semibold transition-colors hover:bg-muted",
                  filter === f && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <ol className="grid gap-3">
          {rows.map(({ q, i, a }) => {
            const outcome = outcomeOf(a, q.correctIndex);
            return (
              <li key={q.id} className="rounded-lg border bg-card p-4 sm:p-5" lang={test.language}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-muted-foreground">Q{i + 1}</span>
                  <Badge variant="muted">{q.subTopic}</Badge>
                  <Badge variant={outcome === "correct" ? "success" : outcome === "wrong" ? "danger" : "muted"} className="ml-auto font-mono">
                    {outcome === "correct" ? "+1" : outcome === "wrong" ? WRONG_MARK_LABEL : "0"}
                  </Badge>
                </div>
                <p className="q-text font-semibold leading-relaxed">{q.question}</p>
                <ul className="mt-3 grid gap-1.5">
                  {[...q.options, OPT_OUT_LABEL[test.language]].map((o, j) => {
                    const right = j === q.correctIndex;
                    const picked = j === a;
                    return (
                      <li
                        key={j}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                          j === OPT_OUT_INDEX && "border-dashed text-muted-foreground",
                          picked && j === OPT_OUT_INDEX && "border-input bg-muted text-foreground",
                          right && "border-success bg-success-soft",
                          picked && !right && j !== OPT_OUT_INDEX && "border-danger bg-danger-soft",
                        )}
                      >
                        <span className="font-mono font-bold text-muted-foreground">{LETTERS[j]}.</span>
                        <span className="q-text min-w-0 flex-1">{o}</span>
                        {right && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Correct answer" />}
                        {picked && j === OPT_OUT_INDEX && <Ban className="size-4 shrink-0 text-muted-foreground" aria-label="Your answer" />}
                        {picked && !right && j !== OPT_OUT_INDEX && <XCircle className="size-4 shrink-0 text-danger" aria-label="Your answer" />}
                      </li>
                    );
                  })}
                </ul>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Your answer</dt>
                  <dd className={cn("font-semibold", outcome === "wrong" && "text-danger", outcome === "correct" && "text-success")}>
                    {a === null ? "Not attempted" : a === OPT_OUT_INDEX ? "E (not answered, 0 marks)" : LETTERS[a]}
                  </dd>
                  <dt className="text-muted-foreground">Correct answer</dt>
                  <dd className="font-semibold text-success">{LETTERS[q.correctIndex]}</dd>
                </dl>
                <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm leading-relaxed">
                  <span className="font-semibold">{test.language === "hi" ? "व्याख्या: " : "Explanation: "}</span>
                  {q.explanation}
                </p>
              </li>
            );
          })}
        </ol>
        {rows.length === 0 && <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">No questions in this filter.</p>}
      </section>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="outline" size="lg" onClick={onRetake}>
          <RotateCcw /> Retake Test
        </Button>
        <Button size="lg" onClick={onNewSet}>
          <Sparkles /> Generate New Set
        </Button>
      </div>
    </div>
  );
}

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
    <div className={cn("flex min-w-0 flex-col items-start gap-1.5 rounded-lg p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4", cls)}>
      <Icon className="size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-mono text-xl font-bold leading-none">{value}</p>
        <p className="truncate text-xs font-semibold">{label}</p>
      </div>
    </div>
  );
}

function TopicRow({ name, accuracy, detail, tone }: { name: string; accuracy: number; detail: string; tone: "success" | "danger" }) {
  return (
    <li className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium" title={name}>
          {name}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {detail} · <span className="font-bold text-foreground">{Math.round(accuracy)}%</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone === "success" ? "bg-success" : "bg-danger")} style={{ width: `${Math.max(accuracy, 3)}%` }} />
      </div>
    </li>
  );
}
