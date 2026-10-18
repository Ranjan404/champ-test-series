import { describe, expect, it } from "vitest";
import { crossedMilestones, drawFromDeck } from "@/lib/cheer";

describe("drawFromDeck", () => {
  it("shows every line once before any repeats", () => {
    let deck: number[] = [];
    let last: number | null = null;
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = drawFromDeck(deck, 10, last);
      seen.push(r.pick);
      deck = r.deck;
      last = r.pick;
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([...Array(10).keys()]);
  });

  it("never repeats the last line when reshuffling", () => {
    for (let n = 0; n < 50; n++) {
      expect(drawFromDeck([], 5, 3).pick).not.toBe(3);
    }
  });

  it("drops indexes that no longer exist", () => {
    expect(drawFromDeck([99, 2], 5, null)).toEqual({ pick: 2, deck: [] });
  });
});

describe("crossedMilestones", () => {
  it("fires each milestone when its count is reached", () => {
    expect(crossedMilestones(5, 6, 25)).toEqual([]);
    expect(crossedMilestones(6, 7, 25)).toEqual([0.25]);
    expect(crossedMilestones(12, 13, 25)).toEqual([0.5]);
    expect(crossedMilestones(24, 25, 25)).toEqual([1]);
  });

  it("does nothing when answers go down", () => {
    expect(crossedMilestones(13, 12, 25)).toEqual([]);
  });
});
