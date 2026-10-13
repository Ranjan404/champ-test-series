import type { Difficulty, Letter, OptionKey, Progress, Question, QuestionSet, SetStatus } from "./types";
import { PRACTICE_DURATION_SECONDS, TOTAL_SETS } from "./types";
import { evaluate, netScore, round2, wrongLetters } from "./scoring";
import { isUnlocked, setStatus } from "./progress";

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 100));

type Outcome = "correct" | "incorrect" | "not_attempted";

interface Row {
  q: Question;
  answer: OptionKey[];
  outcome: Outcome;
  marks: number;
  mistake: string | null;
}

function rowsFor(set: QuestionSet, answers: Record<string, OptionKey[]>): Row[] {
  return set.questions.map((q) => {
    const answer = answers[q.id] ?? ["E"];
    const { result, marks } = evaluate(q, answer);
    let mistake: string | null = null;
    if (result === "incorrect") {
      const wrong = wrongLetters(q, answer);
      // A wrong pick tells us the mistake type; an incomplete multi-select (no wrong pick) can't be classified.
      mistake = wrong.length ? (q.distractorMistakeType[wrong[0]] ?? "Other / Unclassified") : "Other / Unclassified";
    } else if (result === "not_attempted") mistake = "Unattempted";
    return { q, answer, outcome: result, marks, mistake };
  });
}

interface Tally {
  questions: number;
  correct: number;
  incorrect: number;
  notAttempted: number;
}
const emptyTally = (): Tally => ({ questions: 0, correct: 0, incorrect: 0, notAttempted: 0 });
function add(t: Tally, o: Outcome) {
  t.questions++;
  if (o === "correct") t.correct++;
  else if (o === "incorrect") t.incorrect++;
  else t.notAttempted++;
}
/** Accuracy = correct / attempted (Not Attempted is excluded, like the exam rules' difficulty table). */
const accuracy = (t: Tally) => pct(t.correct, t.correct + t.incorrect);

const TIPS: Record<string, string> = {
  Conceptual: "Re-read the definition and work through one example by hand until you can explain it in your own words.",
  Calculation: "Redo the calculation step by step on paper and check each intermediate value.",
  "Confusion Between Concepts": "Make a two-column comparison table of the terms you mixed up, with one distinguishing example each.",
  "Careless Error": "You likely knew this. Slow down, re-read the question and every option before submitting.",
  "Question Misread": "Underline what the question actually asks (true/false, which is NOT, output vs. value) before answering.",
  "Memory/Fact": "Turn these facts into flashcards and review them over the next few days.",
  "Other / Unclassified": "Review the explanation and the syllabus section, then attempt a fresh question on it.",
  Unattempted: "Read this section of the syllabus first; it was skipped, so start with the basics.",
};

export type ReviewItem = {
  index: number;
  id: string;
  type: Question["type"];
  difficulty: Difficulty;
  topic: string;
  question: string;
  options: Question["options"];
  correct: Letter[];
  answer: OptionKey[];
  outcome: Outcome;
  marks: number;
  explanation: string;
};

export type SetReport = ReturnType<typeof buildSetReport>;

export function buildSetReport(set: QuestionSet, progress: Progress, allSets: QuestionSet[]) {
  const sp = progress.sets[set.setId];
  const rows = rowsFor(set, sp?.answers ?? {});
  const correct = rows.filter((r) => r.outcome === "correct").length;
  const incorrect = rows.filter((r) => r.outcome === "incorrect").length;
  const notAttempted = rows.length - correct - incorrect;
  const score = netScore(correct, incorrect);

  // Topic table (only topics that appeared)
  const topicMap = new Map<string, Tally>();
  for (const r of rows) {
    if (!topicMap.has(r.q.topic)) topicMap.set(r.q.topic, emptyTally());
    add(topicMap.get(r.q.topic)!, r.outcome);
  }
  const topics = [...topicMap.entries()]
    .map(([topic, t]) => ({ topic, ...t, accuracy: accuracy(t) }))
    .sort((a, b) => b.questions - a.questions || a.topic.localeCompare(b.topic));

  const difficulty = (["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => {
    const t = emptyTally();
    rows.filter((r) => r.q.difficulty === d).forEach((r) => add(t, r.outcome));
    return { difficulty: d, total: t.questions, attempted: t.correct + t.incorrect, correct: t.correct, incorrect: t.incorrect, accuracy: accuracy(t) };
  });

  // Strong areas: topics with correct answers and no wrong ones; plus every concept answered correctly.
  const strongTopics = topics.filter((t) => t.correct > 0 && t.incorrect === 0 && t.correct >= t.questions / 2).map((t) => t.topic);
  const strongConcepts = rows.filter((r) => r.outcome === "correct").map((r) => ({ topic: r.q.topic, concept: r.q.concept }));

  // Improvement areas grouped by topic
  const weakRows = rows.filter((r) => r.outcome !== "correct");
  const improvement = [...new Set(weakRows.map((r) => r.q.topic))].map((topic) => {
    const items = weakRows.filter((r) => r.q.topic === topic);
    const counts = new Map<string, number>();
    items.forEach((r) => counts.set(r.mistake!, (counts.get(r.mistake!) ?? 0) + 1));
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      topic,
      missed: items.map((r) => ({ subtopic: r.q.subtopic, concept: r.q.concept, outcome: r.outcome })),
      revise: [...new Set(items.map((r) => r.q.sourceRef))],
      tip: TIPS[dominant] ?? TIPS["Other / Unclassified"],
    };
  });

  // Mistake analysis
  const mistakeMap = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.outcome !== "incorrect") continue;
    const m = mistakeMap.get(r.mistake!) ?? new Map<string, number>();
    m.set(r.q.topic, (m.get(r.q.topic) ?? 0) + 1);
    mistakeMap.set(r.mistake!, m);
  }
  const mistakes = [...mistakeMap.entries()]
    .map(([type, byTopic]) => ({
      type,
      total: [...byTopic.values()].reduce((a, b) => a + b, 0),
      byTopic: [...byTopic.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.total - a.total);

  const pyqRows = rows.filter((r) => r.q.source === "PYQ");
  const pyq = pyqRows.length
    ? {
        attempted: pyqRows.filter((r) => r.outcome !== "not_attempted").length,
        correct: pyqRows.filter((r) => r.outcome === "correct").length,
        wrong: pyqRows.filter((r) => r.outcome === "incorrect").length,
      }
    : null;

  // Revision plan: this set's misses, boosted when the same topic/subtopic was also missed elsewhere.
  const pastWrong = pastWrongQuestions(progress, allSets, set.setId);
  const plan = new Map<string, { topic: string; subtopic: string; concepts: string[]; refs: Set<string>; weight: number; repeated: number }>();
  for (const r of weakRows) {
    const key = `${r.q.topic}::${r.q.subtopic}`;
    const e = plan.get(key) ?? { topic: r.q.topic, subtopic: r.q.subtopic, concepts: [], refs: new Set(), weight: 0, repeated: 0 };
    e.concepts.push(r.q.concept);
    e.refs.add(r.q.sourceRef);
    e.weight += r.outcome === "incorrect" ? 2 : 1;
    plan.set(key, e);
  }
  for (const e of plan.values()) {
    const sameSub = pastWrong.filter((q) => q.topic === e.topic && q.subtopic.toLowerCase() === e.subtopic.toLowerCase()).length;
    const sameTopic = pastWrong.filter((q) => q.topic === e.topic).length;
    e.repeated = sameSub;
    e.weight += sameSub * 3 + Math.min(sameTopic, 4);
  }
  const revisionPlan = [...plan.values()]
    .sort((a, b) => b.weight - a.weight)
    .map((e) => {
      const topicPast = pastWrong.filter((q) => q.topic === e.topic).length;
      return {
        topic: e.topic,
        subtopic: e.subtopic,
        concepts: e.concepts,
        refs: [...e.refs],
        repeated: e.repeated > 0,
        note:
          e.repeated > 0
            ? `Repeated weakness: missed ${e.repeated} time(s) before in this subtopic across your earlier attempts.`
            : topicPast > 0
              ? `You also missed ${topicPast} question(s) from ${e.topic} in other sets or attempts.`
              : "Missed in this set.",
      };
    });

  const review: ReviewItem[] = rows.map((r, i) => ({
    index: i + 1,
    id: r.q.id,
    type: r.q.type,
    difficulty: r.q.difficulty,
    topic: r.q.topic,
    question: r.q.question,
    options: r.q.options,
    correct: r.q.correct,
    answer: r.answer,
    outcome: r.outcome,
    marks: r.marks,
    explanation: r.q.explanation,
  }));

  const timeTaken =
    sp?.completedAt && sp.marked ? Math.min(PRACTICE_DURATION_SECONDS, Math.round((Date.parse(sp.completedAt) - Date.parse(sp.startedAt)) / 1000)) : null;

  return {
    setId: set.setId,
    title: set.title,
    attemptNo: sp?.attemptNo ?? 1,
    completedAt: sp?.completedAt ?? null,
    /** Seconds; null for attempts from before practice sets were timed. */
    timeTaken,
    durationSeconds: PRACTICE_DURATION_SECONDS,
    timedOut: sp?.timedOut ?? false,
    summary: { score, total: rows.length, percentage: round2((score / rows.length) * 100), correct, incorrect, notAttempted },
    previousScore: sp?.previousScore ?? null,
    topics,
    difficulty,
    strongTopics,
    strongConcepts,
    improvement,
    mistakes,
    pyq,
    revisionPlan,
    review,
    hasNextSet: set.setId < TOTAL_SETS,
    nextUnlocked: isUnlocked(progress, set.setId + 1),
  };
}

/** Questions answered wrong in other sets' current attempts and in earlier attempts of any set. */
function pastWrongQuestions(progress: Progress, allSets: QuestionSet[], excludeSetId: number) {
  const byId = new Map<string, Question>();
  allSets.forEach((s) => s.questions.forEach((q) => byId.set(q.id, q)));
  const ids: string[] = [];
  for (const s of allSets) {
    if (s.setId === excludeSetId) continue;
    const sp = progress.sets[s.setId];
    if (!sp) continue;
    for (const q of s.questions) {
      const a = sp.answers[q.id];
      if (a && evaluate(q, a).result === "incorrect") ids.push(q.id);
    }
  }
  // Earlier attempts (history keeps wrong ids). A set's latest history entry is the same attempt as its
  // current completed answers (counted above, or this very set), so skip it in that case.
  const latestIdx = new Map<number, number>();
  progress.history.forEach((h, i) => latestIdx.set(h.setId, i));
  progress.history.forEach((h, i) => {
    if (latestIdx.get(h.setId) !== i || progress.sets[h.setId]?.status !== "completed") ids.push(...h.wrong);
  });
  return ids.map((id) => byId.get(id)).filter((q): q is Question => !!q);
}

export type SetSummary = {
  setId: number;
  title: string;
  status: SetStatus;
  unlocked: boolean;
  available: boolean;
  answered: number;
  total: number;
  score: number | null;
  /** Number of the latest attempt (0 if never taken). A retake replaces the previous result. */
  attemptNo: number;
};

export function buildSetList(progress: Progress, allSets: QuestionSet[]): SetSummary[] {
  return Array.from({ length: TOTAL_SETS }, (_, i) => {
    const setId = i + 1;
    const set = allSets.find((s) => s.setId === setId);
    const sp = progress.sets[setId];
    return {
      setId,
      title: set?.title ?? `Set ${setId}`,
      status: setStatus(progress, setId),
      unlocked: isUnlocked(progress, setId),
      available: !!set,
      answered: sp ? Object.keys(sp.answers).length : 0,
      total: set?.questions.length ?? 25,
      score: sp?.status === "completed" ? netScore(sp.correct, sp.incorrect) : null,
      attemptNo: sp?.attemptNo ?? progress.history.findLast((h) => h.setId === setId)?.attemptNo ?? 0,
    };
  });
}

export function buildDashboard(progress: Progress, allSets: QuestionSet[]) {
  const list = buildSetList(progress, allSets);
  const completed = list.filter((s) => s.status === "completed");
  const inProgress = list.find((s) => s.status === "in_progress") ?? null;
  const avg = completed.length ? round2(completed.reduce((a, s) => a + (s.score ?? 0), 0) / completed.length) : null;
  const best = completed.length ? completed.reduce((b, s) => ((s.score ?? -99) > (b.score ?? -99) ? s : b)) : null;

  const topicMap = new Map<string, Tally>();
  let answered = 0;
  for (const s of allSets) {
    const sp = progress.sets[s.setId];
    if (!sp) continue;
    for (const q of s.questions) {
      const a = sp.answers[q.id];
      if (!a) continue;
      answered++;
      if (!topicMap.has(q.topic)) topicMap.set(q.topic, emptyTally());
      add(topicMap.get(q.topic)!, evaluate(q, a).result);
    }
  }
  const topicStats = [...topicMap.entries()].map(([topic, t]) => ({ topic, ...t, accuracy: accuracy(t) }));
  const ranked = topicStats.filter((t) => t.correct + t.incorrect >= 2 && t.accuracy !== null);
  const weakTopics = [...ranked].filter((t) => t.accuracy! < 60).sort((a, b) => a.accuracy! - b.accuracy!).slice(0, 5);
  const strongTopics = [...ranked].filter((t) => t.accuracy! >= 75).sort((a, b) => b.accuracy! - a.accuracy!).slice(0, 5);
  const totals = topicStats.reduce((acc, t) => ({ c: acc.c + t.correct, w: acc.w + t.incorrect }), { c: 0, w: 0 });

  const trend = progress.history.map((h, i) => ({ n: i + 1, label: `S${h.setId}${h.attemptNo > 1 ? ` #${h.attemptNo}` : ""}`, score: h.score }));
  const nextUp = inProgress ?? list.find((s) => s.unlocked && s.status === "not_started" && s.available) ?? null;

  return {
    completedCount: completed.length,
    totalSets: TOTAL_SETS,
    unlockedUpTo: Math.min(progress.unlockedUpTo, TOTAL_SETS),
    averageScore: avg,
    best: best ? { setId: best.setId, score: best.score } : null,
    questionsAnswered: answered,
    overallAccuracy: pct(totals.c, totals.c + totals.w),
    weakTopics,
    strongTopics,
    topicStats: topicStats.sort((a, b) => (a.accuracy ?? 101) - (b.accuracy ?? 101)),
    trend,
    nextUp: nextUp ? { setId: nextUp.setId, status: nextUp.status, answered: nextUp.answered } : null,
  };
}
