"use client";
import { useEffect, useState } from "react";
import { Hind } from "next/font/google";

// Devanagari face for the Hindi taglines; the app's Latin font has no Hindi glyphs.
const hind = Hind({ subsets: ["devanagari", "latin"], weight: "600", display: "swap" });

// Gen-Z taglines on the login page, each floating up the screen in a bubble from bottom to top.

export const HYPE_LINES = [
  "टॉपर बनने की तैयारी शुरू... ⏳",
  "पढ़ाई मोड: ऑन 🔥",
  "इस परीक्षा की कहानी के हीरो तुम हो 🎬",
  "शेर, पढ़ ले, पढ़ ले! 🦁",
  "बाबू, एक सेट और... बस एक सेट और! 🫡",
  "सच बोलूँ? प्रैक्टिस ही असली जुगाड़ है 💯",
  "सपने नहीं, रोज़ एक सेट ✅",
  "तैयारी पूरी, तो परीक्षा के दिन टेंशन नहीं 😎",
  "रैंक 1 का सपना, प्रैक्टिस से होगा पूरा 😤",
  "रील कम, सवाल ज़्यादा 📵",
] as const;

// A bubble takes RISE_MS to cross the screen and a new one starts every SPAWN_MS,
// so with SPAWN_MS > RISE_MS / 2 at most MAX_BUBBLES are on screen at once.
const SPAWN_MS = 8500;
const RISE_MS = 16000;
const MAX_BUBBLES = 2;

// Background / text pairs, cycled so neighbouring bubbles never share a colour.
const COLORS = [
  ["#fde68a", "#78350f"],
  ["#bbf7d0", "#14532d"],
  ["#bfdbfe", "#1e3a8a"],
  ["#fbcfe8", "#831843"],
  ["#ddd6fe", "#4c1d95"],
  ["#fed7aa", "#7c2d12"],
  ["#a5f3fc", "#164e63"],
] as const;

type Bubble = { id: number; line: string; side: "left" | "right"; offset: number };

// Alternate sides so consecutive bubbles never overlap. Anchoring to the screen edge (rather than a left %)
// keeps a wrapped bubble from running off the right side on narrow phones.
function pickSpot(id: number): Pick<Bubble, "side" | "offset"> {
  return { side: id % 2 ? "left" : "right", offset: 3 + Math.random() * 5 };
}

export function LoginHype() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    let id = 0;
    const removals = new Set<ReturnType<typeof setTimeout>>();
    const spawn = () => {
      const b = {
        id,
        line: HYPE_LINES[id % HYPE_LINES.length],
        ...pickSpot(id),
      };
      id++;
      setBubbles((list) => (list.length >= MAX_BUBBLES ? list : [...list, b]));
      const r = setTimeout(() => {
        removals.delete(r);
        setBubbles((list) => list.filter((x) => x.id !== b.id));
      }, RISE_MS);
      removals.add(r);
    };
    spawn();
    const t = setInterval(spawn, SPAWN_MS);
    // Reset fully so a remount (e.g. React Strict Mode in dev) doesn't leave a duplicate bubble behind.
    return () => {
      clearInterval(t);
      removals.forEach(clearTimeout);
      setBubbles([]);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
    >
      {bubbles.map((b) => (
        <span
          key={b.id}
          className={`hype-bubble ${hind.className} absolute top-full max-w-[64vw] rounded-2xl px-3.5 py-2 text-center text-sm leading-snug md:max-w-[calc(50vw-14rem)]`}
          style={
            {
              [b.side]: `${b.offset}%`,
              "--hb-bg": COLORS[b.id % COLORS.length][0],
              "--hb-fg": COLORS[b.id % COLORS.length][1],
            } as React.CSSProperties
          }
        >
          {b.line}
        </span>
      ))}
    </div>
  );
}
