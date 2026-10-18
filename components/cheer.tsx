"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Focus, Sparkles } from "lucide-react";
import { MEME_LINES, MILESTONES, crossedMilestones, drawFromDeck } from "@/lib/cheer";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

// Floating cheers for the timed tests (Daily Question, Practice Sets, PYQs and Full Length Tests).
// Focus mode turns them off; it is off by default and remembered per browser.

const FOCUS_KEY = "champ:focus-mode";
const DECK_KEY = "champ:cheer-deck";

type Floater = { id: number; text: string; kind: "meme" | "milestone"; x: number; y: number };

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or blocked storage: the setting just isn't remembered.
  }
}

/** Next meme line; the deck is kept in storage so lines don't repeat across questions or tests. */
function nextMeme(): string {
  const saved = readStorage<{ deck?: number[]; last?: number | null }>(DECK_KEY, {});
  const { pick, deck } = drawFromDeck(Array.isArray(saved.deck) ? saved.deck : [], MEME_LINES.length, saved.last ?? null);
  writeStorage(DECK_KEY, { deck, last: pick });
  return MEME_LINES[pick];
}

const randomOf = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

export function useCheer({ total, initialAnswered }: { total: number; initialAnswered: number }) {
  const [focus, setFocus] = useState(false);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const pointer = useRef<{ x: number; y: number; at: number } | null>(null);
  // Questions already counted, so clearing and re-answering one doesn't trigger again.
  const counted = useRef(new Set<string>());
  const reached = useRef(new Set(MILESTONES.filter((m) => initialAnswered >= Math.ceil(m.at * total)).map((m) => m.at)));
  const nextId = useRef(0);

  useEffect(() => {
    setFocus(readStorage<unknown>(FOCUS_KEY, false) === true);
  }, []);

  const toggleFocus = useCallback(() => {
    setFocus((f) => {
      writeStorage(FOCUS_KEY, !f);
      if (!f) setFloaters([]);
      return !f;
    });
  }, []);

  /** Put on the options container so a cheer rises from where the option was tapped. */
  const trackPointer = useCallback((e: React.PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY, at: Date.now() };
  }, []);

  const show = useCallback((text: string, kind: Floater["kind"]) => {
    const w = window.innerWidth;
    const p = pointer.current && Date.now() - pointer.current.at < 1500 ? pointer.current : null;
    const margin = Math.min(110, w / 2);
    const x = Math.min(Math.max(p?.x ?? w / 2, margin), w - margin);
    const y = p ? p.y - 16 : window.innerHeight - 140;
    setFloaters((fs) => [...fs.slice(-2), { id: nextId.current++, text, kind, x, y }]);
  }, []);

  /** Call after an option is picked, with the answered count before and after the pick. */
  const pick = useCallback(
    (questionId: string, before: number, after: number) => {
      if (focus || after <= before || counted.current.has(questionId)) return;
      counted.current.add(questionId);
      const milestone = crossedMilestones(before, after, total)
        .filter((at) => !reached.current.has(at))
        .pop();
      if (milestone !== undefined) {
        reached.current.add(milestone);
        show(randomOf(MILESTONES.find((m) => m.at === milestone)!.lines), "milestone");
      } else if (counted.current.size % 2 === 0) {
        show(nextMeme(), "meme");
      }
    },
    [focus, total, show],
  );

  const layer = (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {floaters.map((f) => (
        <div
          key={f.id}
          // Rises from the tapped option to the top of the screen; the bubbles' own animations must not end it early.
          onAnimationEnd={(e) => e.target === e.currentTarget && setFloaters((fs) => fs.filter((x) => x.id !== f.id))}
          style={{ left: f.x, top: f.y, "--cheer-rise": `${f.y + 80}px` } as React.CSSProperties}
          className="cheer-float absolute"
        >
          <span className="cheer-bubble absolute -left-3 -top-4 size-3" />
          <span className="cheer-bubble absolute -right-7 -top-3 size-5 [animation-delay:150ms]" />
          <span
            className={cn(
              "block whitespace-nowrap rounded-full px-3.5 py-1.5 font-extrabold shadow-lg",
              f.kind === "milestone" ? "bg-primary text-base text-primary-foreground" : "border bg-card text-sm text-foreground",
            )}
          >
            {f.text}
          </span>
        </div>
      ))}
    </div>
  );

  return { focus, toggleFocus, pick, trackPointer, layer };
}

export function FocusToggle({ focus, onToggle }: { focus: boolean; onToggle: () => void }) {
  return (
    <Button
      variant={focus ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      aria-pressed={focus}
      aria-label="Focus mode"
      title={focus ? "Focus mode is on: motivational messages are hidden" : "Turn on Focus mode to hide motivational messages"}
    >
      {focus ? <Focus /> : <Sparkles />}
      <span className="hidden sm:inline">Focus {focus ? "on" : "off"}</span>
    </Button>
  );
}
