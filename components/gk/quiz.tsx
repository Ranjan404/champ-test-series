"use client";
import { useEffect, useRef, useState } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleSlash, Flag, Loader2, Play, RotateCcw, Shuffle, X, XCircle } from "lucide-react";
import { QUIZ_AMOUNTS, QUIZ_CATEGORIES, type GkLang, type QuestionsResponse, type QuizCategoryId } from "@/lib/gk/types";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { t } from "./i18n";
import { useGkLang } from "./language";
import { ErrorState, Notice, Segmented, SourceFooter } from "./states";
import { getSource, type SourceState } from "./use-source";

// MCQ practice from the Open Trivia Database. Everything (questions, choices, score) lives in this component's state
// and is gone on reload; nothing is sent back to the server.

const LETTERS = ["A", "B", "C", "D"];

interface Attempt {
  data: QuestionsResponse;
  selected: (number | null)[];
  checked: boolean[];
  current: number;
  finished: boolean;
}

const freshAttempt = (data: QuestionsResponse): Attempt => ({
  data,
  selected: Array(data.questions.length).fill(null),
  checked: Array(data.questions.length).fill(false),
  current: 0,
  finished: false,
});

export function Quiz() {
  const { lang } = useGkLang();
  const [category, setCategory] = useState<QuizCategoryId>("general");
  const [amount, setAmount] = useState<number>(10);
  const [allowEnglish, setAllowEnglish] = useState(false);
  const [load, setLoad] = useState<SourceState<QuestionsResponse>>({ status: "idle" });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function start() {
    if (load.status === "loading") return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoad({ status: "loading" });
    try {
      const r = await getSource<QuestionsResponse>(`/api/gk/questions?category=${category}&amount=${amount}`, ctrl.signal);
      setLoad(r);
      if (r.status === "ok" && r.data.questions.length) setAttempt(freshAttempt(r.data));
    } catch {
      // Aborted because the component unmounted or a new quiz was started.
    }
  }

  if (lang === "hi" && !allowEnglish) {
    return (
      <Notice title={t(lang, "englishOnlyTitle")}>
        <p>{t(lang, "englishOnlyBody")}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => setAllowEnglish(true)}>
          {t(lang, "showEnglish")}
        </Button>
      </Notice>
    );
  }

  if (attempt) {
    return (
      <div lang="en">
        {attempt.finished ? (
          <QuizResult
            attempt={attempt}
            lang={lang}
            onRetry={() => setAttempt(freshAttempt(attempt.data))}
            onNew={() => {
              setAttempt(null);
              setLoad({ status: "idle" });
            }}
          />
        ) : (
          <QuizRunner attempt={attempt} setAttempt={setAttempt} lang={lang} />
        )}
      </div>
    );
  }

  const loading = load.status === "loading";
  return (
    <div className="grid gap-5 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <Notice>
        <p>{t(lang, "quizSourceNote")}</p>
      </Notice>
      <fieldset disabled={loading}>
        <legend className="mb-3 text-sm font-bold">{t(lang, "category")}</legend>
        <div role="radiogroup" aria-label={t(lang, "category")} className="flex flex-wrap gap-2">
          {QUIZ_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors hover:border-primary/60 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                category === c.id && "border-primary bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {c[lang]}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={loading}>
        <legend className="mb-3 text-sm font-bold">{t(lang, "questionsCount")}</legend>
        <Segmented
          label={t(lang, "questionsCount")}
          value={amount}
          onChange={setAmount}
          options={QUIZ_AMOUNTS.map((n) => ({ value: n, label: String(n) }))}
          className="w-full sm:w-64"
        />
      </fieldset>

      {load.status === "error" && <ErrorState state={load} lang={lang} onRetry={start} />}
      {load.status === "ok" && !load.data.questions.length && (
        <Notice tone="warning">
          <p>{t(lang, "noQuestions")}</p>
        </Notice>
      )}

      <Button size="lg" onClick={start} disabled={loading} className="w-full sm:w-auto sm:justify-self-start">
        {loading ? <Loader2 className="animate-spin" /> : <Play />}
        {loading ? t(lang, "loadingQuestions") : t(lang, "startQuiz")}
      </Button>
      {loading && (
        <p role="status" className="sr-only">
          {t(lang, "loadingQuestions")}
        </p>
      )}
    </div>
  );
}

type RowState = "idle" | "selected" | "right" | "wrong" | "answer";
const rowClass: Record<RowState, string> = {
  idle: "border-border bg-card",
  selected: "border-primary bg-primary/5 ring-1 ring-primary",
  right: "border-success bg-success-soft ring-1 ring-success",
  wrong: "border-danger bg-danger-soft ring-1 ring-danger",
  answer: "border-success border-dashed bg-success-soft/50",
};

function QuizRunner({ attempt, setAttempt, lang }: { attempt: Attempt; setAttempt: (a: Attempt) => void; lang: GkLang }) {
  const { data, selected, checked, current } = attempt;
  const total = data.questions.length;
  const q = data.questions[current];
  const pick = selected[current];
  const isChecked = checked[current];
  const done = checked.filter(Boolean).length;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new question so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [current]);

  const update = (patch: Partial<Attempt>) => setAttempt({ ...attempt, ...patch });
  const choose = (i: number) => {
    if (isChecked || i < 0 || i >= q.options.length) return;
    update({ selected: selected.map((s, j) => (j === current ? i : s)) });
  };
  const check = () => {
    if (isChecked || pick === null) return;
    update({ checked: checked.map((c, j) => (j === current ? true : c)) });
  };
  const goTo = (i: number) => i >= 0 && i < total && update({ current: i });

  const stateOf = (i: number): RowState => {
    if (!isChecked) return pick === i ? "selected" : "idle";
    if (i === q.correctIndex) return pick === i ? "right" : "answer";
    return pick === i ? "wrong" : "idle";
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-extrabold tracking-tight outline-none sm:text-2xl" lang={lang}>
          {t(lang, "questionOf", { n: current + 1, total })}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="muted">{q.category}</Badge>
          {q.difficulty && <Badge variant="muted">{q.difficulty}</Badge>}
        </div>
      </div>
      <Progress value={(done / total) * 100} label={t(lang, "progressLabel")} />

      <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
        <p className="q-text mb-5 text-base font-semibold leading-relaxed sm:text-lg">{q.question}</p>
        <RadioGroup.Root
          value={pick === null ? "" : String(pick)}
          onValueChange={(v) => choose(Number(v))}
          disabled={isChecked}
          aria-label={t(lang, "answerOptions")}
          className="grid gap-2.5"
        >
          {q.options.map((text, i) => {
            const st = stateOf(i);
            const id = `${q.id}-${i}`;
            return (
              <label
                key={id}
                htmlFor={id}
                className={cn(
                  "flex min-h-14 items-start gap-3 rounded-lg border p-3 text-left transition-colors sm:p-4",
                  !isChecked && "cursor-pointer hover:border-primary/60 hover:bg-muted/60",
                  rowClass[st],
                )}
              >
                <RadioGroup.Item
                  id={id}
                  value={String(i)}
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-input bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default data-[state=checked]:border-primary"
                >
                  <RadioGroup.Indicator className="size-2.5 rounded-full bg-primary" />
                </RadioGroup.Item>
                <span className="font-mono text-sm font-bold text-muted-foreground">{LETTERS[i]}.</span>
                <span className="q-text min-w-0 flex-1 text-[15px] leading-relaxed">{text}</span>
                {st === "right" && <Check className="mt-0.5 size-5 shrink-0 text-success" aria-label={t(lang, "correct")} />}
                {st === "wrong" && <X className="mt-0.5 size-5 shrink-0 text-danger" aria-label={t(lang, "incorrect")} />}
                {st === "answer" && <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label={t(lang, "correct")} />}
              </label>
            );
          })}
        </RadioGroup.Root>

        <div aria-live="polite">
          {isChecked && (
            <div
              lang={lang}
              className={cn(
                "mt-5 rounded-lg border px-4 py-3 text-sm",
                pick === q.correctIndex ? "border-success/40 bg-success-soft" : "border-danger/40 bg-danger-soft",
              )}
            >
              <p className={cn("flex items-center gap-2 font-bold", pick === q.correctIndex ? "text-success" : "text-danger")}>
                {pick === q.correctIndex ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                {pick === q.correctIndex ? t(lang, "correct") : t(lang, "incorrect")}
              </p>
              {pick !== q.correctIndex && (
                <p className="mt-1">
                  {t(lang, "correctAnswerIs", { answer: "" })}
                  <span lang="en" className="font-semibold">
                    {LETTERS[q.correctIndex]}. {q.options[q.correctIndex]}
                  </span>
                </p>
              )}
              {q.explanation ? (
                <p className="mt-2" lang={q.lang}>
                  {q.explanation}
                </p>
              ) : (
                <p className="mt-2 text-muted-foreground">{t(lang, "noExplanation")}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div lang={lang} className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={() => goTo(current - 1)} disabled={current === 0}>
          <ArrowLeft /> {t(lang, "previous")}
        </Button>
        <div className="flex flex-wrap gap-2">
          {!isChecked && (
            <Button onClick={check} disabled={pick === null} title={pick === null ? t(lang, "selectFirst") : undefined}>
              <Check /> {t(lang, "checkAnswer")}
            </Button>
          )}
          {current < total - 1 ? (
            <Button variant={isChecked ? "default" : "outline"} onClick={() => goTo(current + 1)}>
              {t(lang, "next")} <ArrowRight />
            </Button>
          ) : (
            <Button variant={isChecked ? "default" : "outline"} onClick={() => update({ finished: true })}>
              <Flag /> {t(lang, "finish")}
            </Button>
          )}
        </div>
      </div>
      {!isChecked && pick === null && (
        <p lang={lang} className="text-xs text-muted-foreground">
          {t(lang, "selectFirst")}
        </p>
      )}

      <nav lang={lang} aria-label={t(lang, "palette")} className="rounded-lg border bg-card p-3">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">{t(lang, "palette")}</p>
        <ul className="flex flex-wrap gap-1.5">
          {data.questions.map((qq, i) => {
            const status = !checked[i] ? null : selected[i] === qq.correctIndex ? "right" : "wrong";
            const statusLabel = status === "right" ? t(lang, "correct") : status === "wrong" ? t(lang, "incorrect") : t(lang, "skipped");
            return (
              <li key={qq.id}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  aria-current={i === current ? "step" : undefined}
                  aria-label={`${t(lang, "questionOf", { n: i + 1, total })}: ${statusLabel}`}
                  className={cn(
                    "size-9 rounded-md border text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    status === "right" && "border-success bg-success-soft text-success",
                    status === "wrong" && "border-danger bg-danger-soft text-danger",
                    i === current && "ring-2 ring-primary",
                  )}
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <SourceFooter source={data.source} fetchedAt={data.fetchedAt} stale={data.stale} lang={lang} />
    </div>
  );
}

function QuizResult({ attempt, lang, onRetry, onNew }: { attempt: Attempt; lang: GkLang; onRetry: () => void; onNew: () => void }) {
  const { data, selected, checked } = attempt;
  const total = data.questions.length;
  const correct = data.questions.filter((q, i) => checked[i] && selected[i] === q.correctIndex).length;
  const wrong = data.questions.filter((q, i) => checked[i] && selected[i] !== q.correctIndex).length;
  const skipped = total - correct - wrong;
  const pct = Math.round((correct / total) * 1000) / 10;
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className="grid gap-5">
      <div lang={lang} className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
        <h2 ref={headingRef} tabIndex={-1} className="mb-4 text-xl font-extrabold tracking-tight outline-none sm:text-2xl">
          {t(lang, "resultTitle")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label={t(lang, "score")} value={`${correct} / ${total}`} strong />
          <Stat label={t(lang, "percentage")} value={`${pct}%`} strong />
          <Stat label={t(lang, "answeredCorrect")} value={String(correct)} tone="success" />
          <Stat label={t(lang, "answeredWrong")} value={String(wrong)} tone="danger" />
          <Stat label={t(lang, "skipped")} value={String(skipped)} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onRetry}>
            <RotateCcw /> {t(lang, "retry")}
          </Button>
          <Button variant="outline" onClick={onNew}>
            <Shuffle /> {t(lang, "newQuiz")}
          </Button>
        </div>
      </div>

      <section aria-labelledby="gk-review" className="grid gap-3">
        <h3 id="gk-review" lang={lang} className="text-lg font-bold">
          {t(lang, "review")}
        </h3>
        <ol className="grid gap-3">
          {data.questions.map((q, i) => {
            const pick = checked[i] ? selected[i] : null;
            const ok = pick === q.correctIndex;
            return (
              <li key={q.id} className="rounded-lg border bg-card p-4">
                <p className="mb-2 flex items-start gap-2 font-semibold">
                  {pick === null ? (
                    <CircleSlash className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={t(lang, "skipped")} />
                  ) : ok ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label={t(lang, "correct")} />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label={t(lang, "incorrect")} />
                  )}
                  <span className="q-text">
                    {i + 1}. {q.question}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  <span lang={lang}>{t(lang, "yourAnswer", { answer: "" })}</span>
                  {pick === null ? <span lang={lang}>{t(lang, "notAnswered")}</span> : `${LETTERS[pick]}. ${q.options[pick]}`}
                </p>
                {!ok && (
                  <p className="text-sm font-semibold text-success">
                    <span lang={lang}>{t(lang, "correctAnswerIs", { answer: "" })}</span>
                    {LETTERS[q.correctIndex]}. {q.options[q.correctIndex]}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
      <SourceFooter source={data.source} fetchedAt={data.fetchedAt} stale={data.stale} lang={lang} />
    </div>
  );
}

function Stat({ label, value, tone, strong }: { label: string; value: string; tone?: "success" | "danger"; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2.5">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-extrabold", strong && "text-2xl", tone === "success" && "text-success", tone === "danger" && "text-danger")}>{value}</dd>
    </div>
  );
}
