"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Languages, ListOrdered, Loader2, Sparkles, Timer, X } from "lucide-react";
import {
  BPSC_COUNTS,
  BPSC_TOPICS,
  SECONDS_PER_QUESTION,
  WRONG_MARK_LABEL,
  type BpscCount,
  type BpscLanguage,
  type BpscTest,
  type BpscTopicId,
} from "@/lib/bpsc";
import { cn } from "@/lib/utils";
import { BpscTestRunner, freshRunnerState, type RunnerState } from "./bpsc-test-runner";
import { Button } from "./ui/button";

const STORAGE_KEY = "cts:bpsc-tre4";

interface Saved {
  test: BpscTest;
  runner: RunnerState;
}

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const v = raw ? (JSON.parse(raw) as Saved) : null;
    return v?.test?.questions?.length && v.runner?.answers?.length === v.test.questions.length ? v : null;
  } catch {
    return null;
  }
}
function save(v: Saved | null) {
  try {
    if (v) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode): the test still works, it just won't survive a reload.
  }
}

export function BpscTre4() {
  const [topic, setTopic] = useState<BpscTopicId>("full");
  const [count, setCount] = useState<BpscCount>(25);
  const [language, setLanguage] = useState<BpscLanguage>("hi");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Saved | null>(null);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Resume a test that was in progress before a reload.
  useEffect(() => {
    const saved = load();
    if (saved) {
      setActive(saved);
      setTopic(saved.test.topic);
      setLanguage(saved.test.language);
      if ((BPSC_COUNTS as readonly number[]).includes(saved.test.questions.length)) setCount(saved.test.questions.length as BpscCount);
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const testRef = useRef<BpscTest | null>(null);
  testRef.current = active?.test ?? null;
  const persist = useCallback((runner: RunnerState) => {
    if (testRef.current) save({ test: testRef.current, runner });
  }, []);

  async function generate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/bpsc-test/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, count, language }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (res.status === 401) return window.location.assign("/login?next=/dashboard/bpsc-tre4");
        setError(data?.error ?? (res.status === 504 ? "The request timed out. Try again." : "Could not generate the test. Try again."));
        return;
      }
      const next: Saved = { test: data as BpscTest, runner: freshRunnerState((data as BpscTest).questions.length) };
      save(next);
      setActive(next);
      setAttempt((n) => n + 1);
      window.scrollTo({ top: 0 });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  if (active) {
    return (
      <BpscTestRunner
        key={attempt}
        test={active.test}
        initial={active.runner}
        onChange={persist}
        onRetake={() => {
          const next = { test: active.test, runner: freshRunnerState(active.test.questions.length) };
          save(next);
          setActive(next);
          setAttempt((n) => n + 1);
          window.scrollTo({ top: 0 });
        }}
        onNewSet={() => {
          save(null);
          setActive(null);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 sm:mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary">BPSC TRE 4.0</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Bihar Special GK/GS & Current Affairs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AI-generated mock tests in the BPSC Teacher Recruitment pattern. 4 options plus option E (do not wish to answer) per question, 1 minute per question,
          +1 for correct, {WRONG_MARK_LABEL} for wrong, 0 for option E or unattempted.
        </p>
      </div>

      {loading ? (
        <GeneratingSkeleton count={count} onCancel={() => abortRef.current?.abort()} />
      ) : (
        <div className="grid gap-5 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
          <fieldset>
            <legend className="mb-3 text-sm font-bold">Topic</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Topic">
              {BPSC_TOPICS.map((t) => (
                <Pill key={t.id} on={topic === t.id} onClick={() => setTopic(t.id)}>
                  <span>{t.label}</span>
                  <span lang="hi" className={cn("text-xs font-medium", topic === t.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {t.hi}
                  </span>
                </Pill>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-3 inline-flex items-center gap-2 text-sm font-bold">
                <ListOrdered className="size-4" /> Questions
              </legend>
              <Segmented
                label="Number of questions"
                value={count}
                onChange={setCount}
                options={BPSC_COUNTS.map((n) => ({ value: n, label: String(n) }))}
              />
            </fieldset>
            <fieldset>
              <legend className="mb-3 inline-flex items-center gap-2 text-sm font-bold">
                <Languages className="size-4" /> Language
              </legend>
              <Segmented
                label="Language"
                value={language}
                onChange={setLanguage}
                options={[
                  { value: "hi", label: "हिन्दी" },
                  { value: "en", label: "English" },
                ]}
              />
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-muted px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Timer className="size-4 text-muted-foreground" /> {(count * SECONDS_PER_QUESTION) / 60} min
            </span>
            <span>Max marks {count}</span>
            <span className="text-muted-foreground">+1 / {WRONG_MARK_LABEL} / 0</span>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}

          <Button size="lg" onClick={generate} className="w-full sm:w-auto sm:justify-self-start">
            <Sparkles /> Generate & Start Test
          </Button>
          <p className="text-xs text-muted-foreground">
            Questions are generated by AI and can occasionally contain factual errors, especially for budget figures and recent events. Cross-check
            anything that looks off with official sources.
          </p>
        </div>
      )}
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-lg border px-3.5 py-2 text-left text-sm font-semibold transition-colors hover:border-primary/60 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on && "border-primary bg-primary text-primary-foreground hover:bg-primary",
      )}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-md border bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-10 flex-1 rounded-[calc(var(--radius)-6px)] text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value && "bg-card text-foreground shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function GeneratingSkeleton({ count, onCancel }: { count: number; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6" aria-busy="true">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="inline-flex items-center gap-2 font-semibold">
          <Loader2 className="size-5 animate-spin text-primary" /> Setting your {count}-question paper… {elapsed}s
        </p>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X /> Cancel
        </Button>
      </div>
      <div className="animate-pulse">
        <div className="mb-3 h-5 w-24 rounded-full bg-muted" />
        <div className="mb-2 h-4 w-full rounded bg-muted" />
        <div className="mb-5 h-4 w-3/4 rounded bg-muted" />
        <div className="grid gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg border bg-muted/50" />
          ))}
        </div>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">This usually takes 15-40 seconds. Keep this tab open.</p>
    </div>
  );
}
