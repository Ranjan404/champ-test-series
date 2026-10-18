// Floating cheers shown while a test is running. They praise effort and progress, never correctness:
// the answers are only checked after submitting, so nothing here may hint at right or wrong.

/** Desi meme lines, shown after picking an option on every second newly answered question. */
export const MEME_LINES = [
  "Sherrr 🐯",
  "Bas thoda aur, bhai 💪",
  "Topper vibes 😎",
  "Ekdum jhakaas ✨",
  "Lage raho! 🚀",
  "Full josh 🔥",
  "How's the josh? High sir! 🫡",
  "Jhukega nahi 😤",
  "Apna time aayega 🎤",
  "Picture abhi baaki hai 🎬",
  "Chak de! 🏑",
  "Ek number! 👌",
  "Rukna nahi hai 🏃",
  "Ghabrana nahi hai 😌",
  "Kadak 🔥",
  "Rapchik 🤙",
  "Mehnat rang layegi 🌈",
  "Sher mode on 🦁",
  "Bhai full form mein hai 🏏",
  "Ye dil maange more 🙌",
  "Dimag ki batti jali 💡",
  "Babu Bhaiya approved 👓",
  "Tension nahi lene ka 😎",
  "Mogambo khush hua 😄",
  "Thoda aur, phir chai ☕",
  "Ek dum mast chal raha hai 🎯",
  "Machaa diya 🥁",
  "Seedha upar wala gear ⚙️",
] as const;

/** Effort praise at progress milestones (share of questions answered). */
export const MILESTONES: { at: number; lines: readonly string[] }[] = [
  { at: 0.25, lines: ["Quarter done, solid start 💪", "25% ho gaya, lage raho 🚀"] },
  { at: 0.5, lines: ["Halfway done 💪", "Aadha safar complete 🚀"] },
  { at: 0.75, lines: ["75% done, bas thoda aur 🔥", "Last stretch, finish strong 🏁"] },
  { at: 1, lines: ["Sab attempt ho gaye 🎯 Review karke submit karo", "All answered 🙌 Ek baar review kar lo"] },
];

/** Milestones crossed when going from `before` to `after` answered out of `total`. */
export function crossedMilestones(before: number, after: number, total: number): number[] {
  if (total <= 0) return [];
  return MILESTONES.map((m) => m.at).filter((at) => before < Math.ceil(at * total) && after >= Math.ceil(at * total));
}

/**
 * Draws the next line from a shuffled deck so no line repeats until all have been shown.
 * `deck` holds the indexes still to show; an empty or stale deck is reshuffled, never starting with `last`.
 */
export function drawFromDeck(deck: number[], size: number, last: number | null, rand: () => number = Math.random): { pick: number; deck: number[] } {
  let d = deck.filter((i) => Number.isInteger(i) && i >= 0 && i < size);
  if (d.length === 0) {
    d = [...Array(size).keys()];
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    if (size > 1 && d[0] === last) [d[0], d[1]] = [d[1], d[0]];
  }
  const [pick, ...rest] = d;
  return { pick, deck: rest };
}
