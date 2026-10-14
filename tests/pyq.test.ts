import { describe, expect, it } from "vitest";
import { applyReset, isUnlocked, startPractice, submitPractice } from "@/lib/progress";
import { emptyProgress } from "@/lib/store";
import { buildSetList, buildSetReport } from "@/lib/report";
import { getAllPyqSets, getPyqSet, parsePyqSetId, pyqSetCount, pyqTrack } from "@/lib/pyq";
import type { OptionKey } from "@/lib/types";

describe("PYQ sets", () => {
  it("every set file loads with 25 PYQ-tagged single-answer questions", async () => {
    const total = await pyqSetCount();
    expect(total).toBeGreaterThan(0);
    const sets = await getAllPyqSets();
    expect(sets).toHaveLength(total);
    for (const s of sets) {
      expect(s.questions).toHaveLength(25);
      for (const q of s.questions) {
        expect(q.source).toBe("PYQ");
        expect(q.type).toBe("single");
        expect(q.id.startsWith(`P${String(s.setId).padStart(2, "0")}-`)).toBe(true);
      }
    }
  });

  it("parses only existing set numbers", async () => {
    const total = await pyqSetCount();
    expect(await parsePyqSetId("1")).toBe(1);
    expect(await parsePyqSetId(String(total))).toBe(total);
    expect(await parsePyqSetId(String(total + 1))).toBeNull();
    expect(await parsePyqSetId("0")).toBeNull();
    expect(await parsePyqSetId("abc")).toBeNull();
  });

  it("keeps PYQ progress separate from practice progress", async () => {
    const total = await pyqSetCount();
    const set1 = (await getPyqSet(1))!;
    const p = emptyProgress();
    const track = pyqTrack(p);
    expect(p.pyq).toBe(track);

    startPractice(track, set1, Date.now(), total);
    const answers = Object.fromEntries(set1.questions.map((q) => [q.id, q.correct as OptionKey[]]));
    const out = submitPractice(track, set1, answers, Date.now() + 1000, total);
    expect(out.score).toBe(25);
    expect(out.nextUnlocked).toBe(2);

    // Practice sets are untouched.
    expect(p.unlockedUpTo).toBe(1);
    expect(p.sets).toEqual({});
    expect(p.history).toEqual([]);

    expect(isUnlocked(track, 2, total)).toBe(true);
    const list = buildSetList(track, await getAllPyqSets(), total);
    expect(list).toHaveLength(total);
    expect(list[0].status).toBe("completed");
    const report = buildSetReport(set1, track, await getAllPyqSets(), total);
    expect(report.pyq).toEqual({ attempted: 25, correct: 25, wrong: 0 });

    applyReset(track, 1, total);
    expect(track.sets[1]).toBeUndefined();
    expect(track.unlockedUpTo).toBe(2);
  });

  it("does not unlock past the last PYQ set", async () => {
    const total = await pyqSetCount();
    const last = (await getPyqSet(total))!;
    const track = pyqTrack(emptyProgress());
    track.unlockedUpTo = total;
    startPractice(track, last, Date.now(), total);
    const out = submitPractice(track, last, {}, Date.now() + 1000, total);
    expect(out.nextUnlocked).toBeNull();
    expect(track.unlockedUpTo).toBe(total);
    expect(buildSetReport(last, track, [last], total).hasNextSet).toBe(false);
  });
});
