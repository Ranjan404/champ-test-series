"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleSlash, Info, Loader2, PartyPopper, Trophy, XCircle } from "lucide-react";
import type { AnswerFeedback, OptionKey } from "@/lib/types";
import type { TestState } from "@/lib/test-state";
import { formatMarks, formatScore } from "@/lib/scoring";
import { OptionList } from "./option-list";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const fmtAnswer = (a: OptionKey[]) => (a.length === 1 && a[0] === "E" ? "E (Not Attempted)" : a.join(", "));

export function TestRunner({ initial }: { initial: TestState }) {
  const [state, setState] = useState(initial);
  const [selection, setSelection] = useState<OptionKey[]>([]);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const q = state.question;
  const number = state.currentIndex + 1;
  const answeredCount = feedback ? feedback.answered : state.currentIndex;

  useEffect(() => {
    if (feedback) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [feedback]);

  async function submit() {
    if (!q || !selection.length || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sets/${state.setId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, answer: selection }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Could not save your answer. Try again.");
        if (res.status === 409) await reload();
        return;
      }
      setFeedback(data as AnswerFeedback);
    } catch {
      setError("Network error. Your answer was not saved; try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    const res = await fetch(`/api/sets/${state.setId}/current`, { cache: "no-store" });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not load the next question.");
    const next = (await res.json()) as TestState;
    setState(next);
    setSelection([]);
    setFeedback(null);
    if (next.status === "completed") setFinished(true);
  }

  async function next() {
    if (!feedback) return;
    if (feedback.completed) {
      setFinished(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reload();
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (finished || !q) {
    const total = feedback?.total ?? state.total;
    const score = feedback?.score ?? state.score;
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-8 text-center sm:py-16">
        <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-success-soft text-success">
          <PartyPopper className="size-10" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{state.title}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Test Completed</h1>
        <p className="mt-3 text-muted-foreground">
          You answered all {total} questions. Net score: <span className="font-mono font-bold text-foreground">{formatScore(score)}</span> / {total}
        </p>
        {feedback?.nextUnlocked && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-1.5 text-sm font-semibold">
            <Trophy className="size-4" /> Set {feedback.nextUnlocked} unlocked
          </p>
        )}
        <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button asChild size="lg">
            <Link href={`/practice/${state.setId}/result`}>View Result</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/practice">Back to Practice</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="mx-auto max-w-3xl scroll-mt-20 pb-28 sm:pb-0">
      {/* Header: question number, progress, running score */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 sm:mb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{state.title}</p>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            Question {number} <span className="font-semibold text-muted-foreground">of {state.total}</span>
          </h1>
        </div>
        <div className="text-right text-sm">
          <span className="text-muted-foreground">Score </span>
          <span className="font-mono text-lg font-bold">{formatScore(feedback?.score ?? state.score)}</span>
        </div>
      </div>
      <Progress value={(answeredCount / state.total) * 100} label="Test progress" className="mb-6" />

      <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
        {q.type === "multiple" && (
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2.5 py-1 text-xs font-bold text-accent-foreground dark:text-warning">
            <Info className="size-3.5" /> Select all correct options
          </p>
        )}
        <p className="q-text mb-5 text-base font-semibold leading-relaxed sm:text-lg">{q.question}</p>
        <OptionList question={q} value={feedback ? feedback.yourAnswer : selection} onChange={setSelection} locked={!!feedback} correct={feedback?.correct} />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {feedback && <FeedbackPanel ref={feedbackRef} f={feedback} />}

      {/* Actions: sticky at the bottom on phones */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur sm:static sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {answeredCount}/{state.total} done
          </p>
          {!feedback ? (
            <Button size="lg" onClick={submit} disabled={!selection.length || busy} className="min-w-36">
              {busy && <Loader2 className="animate-spin" />} Submit
            </Button>
          ) : (
            <Button size="lg" onClick={next} disabled={busy} className="min-w-36">
              {busy && <Loader2 className="animate-spin" />}
              {feedback.completed ? "Finish" : "Next"} <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackPanel({ f, ref }: { f: AnswerFeedback; ref: React.Ref<HTMLDivElement> }) {
  const tone =
    f.result === "correct"
      ? { cls: "border-success/50 bg-success-soft", icon: <CheckCircle2 className="size-5 text-success" />, label: "Correct", badge: "success" as const }
      : f.result === "incorrect"
        ? { cls: "border-danger/50 bg-danger-soft", icon: <XCircle className="size-5 text-danger" />, label: "Incorrect", badge: "danger" as const }
        : { cls: "border-border bg-muted", icon: <CircleSlash className="size-5 text-muted-foreground" />, label: "Not Attempted", badge: "muted" as const };
  return (
    <div ref={ref} aria-live="polite" className={cn("mt-4 scroll-mb-28 rounded-lg border p-4 sm:p-5", tone.cls)}>
      <div className="flex flex-wrap items-center gap-2">
        {tone.icon}
        <p className="text-lg font-bold">{tone.label}</p>
        <Badge variant={tone.badge} className="ml-auto font-mono text-sm">
          {formatMarks(f.marks)}
        </Badge>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Your answer</dt>
        <dd className="font-semibold">{fmtAnswer(f.yourAnswer)}</dd>
        <dt className="text-muted-foreground">Correct answer</dt>
        <dd className="font-semibold">{f.correct.join(", ")}</dd>
      </dl>
      <p className="mt-3 text-sm leading-relaxed">
        <span className="font-semibold">Explanation: </span>
        {f.explanation}
      </p>
      <p className="mt-3 border-t border-current/10 pt-3 text-sm text-muted-foreground">
        Progress {f.answered}/{f.total} · Current score <span className="font-mono font-bold text-foreground">{formatScore(f.score)}</span> (out of {f.answered} possible so far)
      </p>
    </div>
  );
}
