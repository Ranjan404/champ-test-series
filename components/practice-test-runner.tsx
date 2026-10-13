"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Bookmark, Eraser, Info, Loader2, Save } from "lucide-react";
import type { PracticeAttemptState, PracticeStart } from "@/lib/test-state";
import type { OptionKey } from "@/lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { OptionList } from "./option-list";
import { MarkingBanner, Palette, SaveStatus, SubmitButton, TimerChip } from "./exam-ui";

type Answers = Record<string, OptionKey[]>;

const resultUrl = (setId: number) => `/practice/${setId}/result`;

/** Starts (or resumes) the set's timed attempt on the server, then hands it to the runner. */
export function PracticeTest({ setId }: { setId: number }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ attempt: PracticeAttemptState; clockOffset: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sent = Date.now();
        const res = await fetch(`/api/sets/${setId}/start`, { method: "POST" });
        if (res.status === 401) return window.location.assign(`/login?next=/practice/${setId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Could not start the test.");
        const state = data as PracticeStart;
        if (state.status === "completed") return router.replace(resultUrl(setId));
        // Assume the server stamped its clock halfway through the round trip.
        const clockOffset = state.serverNow - (sent + Date.now()) / 2;
        if (!cancelled) setLoaded({ attempt: state.attempt, clockOffset });
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Network error. Check your connection and try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setId, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="mx-auto size-8 text-danger" />
        <p role="alert" className="mt-3 font-semibold">
          {error}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/practice">Back to Practice</Link>
        </Button>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="flex flex-col items-center py-20" role="status">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-4 font-semibold">Loading Set {setId}…</p>
      </div>
    );
  }
  return <PracticeTestRunner attempt={loaded.attempt} clockOffset={loaded.clockOffset} />;
}

/** Drops empty selections (a multi-select with every box unticked counts as not answered). */
const compact = (a: Answers): Answers => Object.fromEntries(Object.entries(a).filter(([, v]) => v.length));

function PracticeTestRunner({ attempt, clockOffset }: { attempt: PracticeAttemptState; clockOffset: number }) {
  const router = useRouter();
  const qs = attempt.questions;
  const total = qs.length;
  const setId = attempt.setId;
  const [answers, setAnswers] = useState<Answers>(attempt.answers);
  const [marked, setMarked] = useState<Set<string>>(() => new Set(attempt.marked));
  const [current, setCurrent] = useState(Math.min(attempt.current, total - 1));
  const [visited, setVisited] = useState<Set<number>>(() => new Set([...Array(Math.min(attempt.current, total - 1) + 1).keys()]));
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
        const res = await fetch(`/api/sets/${setId}/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: compact(next.answers), marked: [...next.marked], current: next.current }),
        });
        if (res.status === 401) return window.location.assign(`/login?next=/practice/${setId}`);
        const data = await res.json().catch(() => null);
        if (data?.expired) {
          submittedRef.current = true;
          return router.replace(resultUrl(setId));
        }
        if (!res.ok) throw new Error(data?.error ?? "Could not save");
        setSaving("saved");
      } catch {
        setSaving("error");
      }
    },
    [router, setId],
  );

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sets/${setId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: compact(snap.current.answers) }),
      });
      if (res.status === 401) return window.location.assign(`/login?next=/practice/${setId}`);
      const data = await res.json().catch(() => null);
      // 409: already submitted (another tab, or the timer on the server).
      if (!res.ok && res.status !== 409) throw new Error(data?.error ?? "Could not submit");
      router.replace(resultUrl(setId));
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(`${(e as Error).message || "Network error"}. Check your connection and press Submit again.`);
    }
  }, [router, setId]);

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
      navigator.sendBeacon?.(`/api/sets/${setId}/save`, JSON.stringify({ answers: compact(s.answers), marked: [...s.marked], current: s.current }));
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [setId]);

  const q = qs[current];
  const selected = answers[q.id] ?? [];
  const answered = qs.filter((x) => answers[x.id]?.length).length;
  const isMarked = marked.has(q.id);

  const goTo = (i: number, nextMarked = marked) => {
    const idx = Math.min(Math.max(0, i), total - 1);
    setCurrent(idx);
    setVisited((v) => new Set(v).add(idx));
    void save({ answers, marked: nextMarked, current: idx });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const choose = (v: OptionKey[]) => {
    setAnswers((a) => ({ ...a, [q.id]: v }));
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
            Practice · {attempt.title}
            {attempt.attemptNo > 1 ? ` · Attempt ${attempt.attemptNo}` : ""}
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
              {q.type === "multiple" ? (
                <Badge variant="warning">
                  <Info className="size-3" /> Select all correct options
                </Badge>
              ) : (
                <Badge variant="muted">Single correct</Badge>
              )}
              {isMarked && (
                <Badge variant="warning">
                  <Bookmark className="size-3" /> Marked for review
                </Badge>
              )}
              <SaveStatus state={saving} />
            </div>
            <p className="q-text mb-5 text-base font-semibold leading-relaxed sm:text-lg">{q.question}</p>
            <OptionList key={q.id} question={q} value={selected} onChange={choose} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={clear} disabled={selected.length === 0}>
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
          <Palette questions={qs} answers={compact(answers)} marked={marked} visited={visited} current={current} onJump={(i) => goTo(i)} />
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
