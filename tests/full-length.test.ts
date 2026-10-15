import { describe, expect, it } from "vitest";
import { finalizeIfExpired, pauseAllPractice, pausePractice, savePractice, startPractice, submitPractice, TIMER_STALE_MS, timeUsedMs } from "@/lib/progress";
import { emptyProgress } from "@/lib/store";
import { buildSetList, buildSetReport } from "@/lib/report";
import { buildPracticeStart } from "@/lib/test-state";
import { fullLengthSetCount, fullLengthTrack, getAllFullLengthSets, getFullLengthSet } from "@/lib/full-length";
import { FULL_LENGTH_DURATION_SECONDS, type OptionKey, type PracticeTrack, type QuestionSet } from "@/lib/types";

const MIN = 60_000;
const T0 = Date.parse("2026-10-15T10:00:00Z");
const LIMIT = FULL_LENGTH_DURATION_SECONDS * 1000;

async function started() {
  const total = await fullLengthSetCount();
  const set = (await getFullLengthSet(1))!;
  const p = emptyProgress();
  const track = fullLengthTrack(p);
  startPractice(track, set, T0, total, FULL_LENGTH_DURATION_SECONDS);
  return { total, set, p, track };
}
const body = { answers: {}, marked: [], current: 0 };

/** The open test reports in every 20 seconds from `from` up to `to`. */
function keepOpen(track: PracticeTrack, set: QuestionSet, from: number, to: number) {
  for (let t = from + 20_000; t <= to; t += 20_000) savePractice(track, set, body, t);
}

describe("Full Length Tests", () => {
  it("every set file loads with 150 questions and its sections", async () => {
    const total = await fullLengthSetCount();
    expect(total).toBeGreaterThan(0);
    for (const s of await getAllFullLengthSets()) {
      expect(s.questions).toHaveLength(150);
      expect(s.questions[0].id).toBe(`F${String(s.setId).padStart(2, "0")}-Q001`);
      expect(s.sections?.at(-1)?.to).toBe(150);
    }
  });

  it("keeps its progress separate and gives the runner 150 minutes", async () => {
    const { set, p, track } = await started();
    expect(p.fullLength).toBe(track);
    expect(p.sets).toEqual({});
    const state = buildPracticeStart(set, track.sets[1], T0);
    if (state.status !== "in_progress") throw new Error("expected in progress");
    expect(state.attempt.pausable).toBe(true);
    expect(state.attempt.durationSeconds).toBe(150 * 60);
    expect(state.attempt.deadline).toBe(T0 + LIMIT);
    expect(state.attempt.sections.map((s) => s.name)).toHaveLength(3);
  });

  it("stops the clock while paused and continues on resume", async () => {
    const { total, set, track } = await started();
    keepOpen(track, set, T0, T0 + 40 * MIN);
    pausePractice(track, set, body, T0 + 40 * MIN);
    const sp = track.sets[1];
    expect(sp.timer!.runningSince).toBeNull();
    expect(timeUsedMs(sp, T0 + 40 * MIN)).toBe(40 * MIN);
    // A day away does not use time or end the attempt.
    const later = T0 + 24 * 60 * MIN;
    expect(timeUsedMs(sp, later)).toBe(40 * MIN);
    expect(finalizeIfExpired(track, set, later, 0, total)).toBeNull();

    startPractice(track, set, later, total, FULL_LENGTH_DURATION_SECONDS);
    const state = buildPracticeStart(set, sp, later);
    if (state.status !== "in_progress") throw new Error("expected in progress");
    expect(state.attempt.deadline).toBe(later + 110 * MIN);
    keepOpen(track, set, later, later + 20 * MIN);
    expect(timeUsedMs(sp, later + 10 * MIN)).toBe(50 * MIN);

    const answers = Object.fromEntries(set.questions.map((q) => [q.id, q.correct as OptionKey[]]));
    const out = submitPractice(track, set, answers, later + 20 * MIN, total);
    expect(out.score).toBe(150);
    expect(out.timedOut).toBe(false);
    expect(sp.timer!.usedMs).toBe(60 * MIN);
    const report = buildSetReport(set, track, await getAllFullLengthSets(), total);
    expect(report.timeTaken).toBe(60 * 60);
    expect(report.durationSeconds).toBe(150 * 60);
  });

  it("stops counting when the open test goes quiet (crash, no network)", async () => {
    const { total, set, track } = await started();
    keepOpen(track, set, T0, T0 + 10 * MIN);
    // No report since T0 + 10 min: only TIMER_STALE_MS more is counted, however long it stays quiet.
    const sp = track.sets[1];
    expect(timeUsedMs(sp, T0 + 5 * 60 * MIN)).toBe(10 * MIN + TIMER_STALE_MS);
    expect(finalizeIfExpired(track, set, T0 + 5 * 60 * MIN, 0, total)).toBeNull();
    startPractice(track, set, T0 + 5 * 60 * MIN, total, FULL_LENGTH_DURATION_SECONDS);
    expect(timeUsedMs(sp, T0 + 5 * 60 * MIN + MIN)).toBe(11 * MIN + TIMER_STALE_MS);
  });

  it("submits with the saved answers once the 150 minutes are used", async () => {
    const { total, set, track } = await started();
    keepOpen(track, set, T0, T0 + LIMIT - 1);
    const out = finalizeIfExpired(track, set, T0 + LIMIT + 1, 0, total);
    expect(out?.timedOut).toBe(true);
    expect(track.sets[1].timer!.usedMs).toBe(LIMIT);
    expect(track.unlockedUpTo).toBe(Math.min(2, total));
  });

  it("logout pauses running tests and the list shows the time left", async () => {
    const { total, set, track } = await started();
    keepOpen(track, set, T0, T0 + 15 * MIN);
    pauseAllPractice(track, T0 + 15 * MIN);
    expect(track.sets[1].timer!.runningSince).toBeNull();
    const list = buildSetList(track, await getAllFullLengthSets(), total, T0 + 99 * MIN);
    expect(list[0].status).toBe("in_progress");
    expect(list[0].timeLeft).toBe(135 * 60);
  });
});
