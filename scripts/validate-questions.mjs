#!/usr/bin/env node
// Validates data/questions/set-XX.json against syllabus/TEST_RULES.md.
// Usage: node scripts/validate-questions.mjs [setNumber ...]
// With no arguments every set file present is checked, plus cross-set duplicates.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QDIR = path.join(ROOT, "data", "questions");
const SYLLABUS = path.resolve(ROOT, "..", "syllabus");

export const TOPICS = [
  "Computer Fundamentals & Architecture",
  "Python Programming",
  "Data Structures & Algorithms",
  "DBMS & SQL",
  "Computer Networks",
  "Cybersecurity & Cryptography",
  "Operating Systems",
  "Theory of Computation",
  "AI, IoT & Emerging Tech",
  "Web, Multimedia & E-commerce",
  "Software Engineering",
  "C++, Java & OOP",
];
export const MISTAKE_TYPES = [
  "Conceptual",
  "Calculation",
  "Confusion Between Concepts",
  "Careless Error",
  "Question Misread",
  "Memory/Fact",
];
const SOURCE_FILES = [
  "01_PDF_01_TO_05.md", "02_PDF_06_TO_10.md", "03_PDF_11_TO_15.md", "04_PDF_16_TO_20.md",
  "05_PDF_21_TO_25.md", "06_PDF_26_TO_30.md", "07_PDF_31_TO_35.md", "08_PDF_36_TO_40.md",
  "09_PDF_41_TO_42.md", "10_PDF_43_TO_52.md", "11_PDF_53_TO_62.md", "12_PDF_63_TO_72.md",
  "13_PDF_73_TO_82.md", "14_PDF_83_TO_92.md", "15_PDF_93_TO_102.md", "16_PDF_103_TO_114.md",
];
const DIFF_TARGET = { Easy: 5, Medium: 12, Hard: 8 };
const BANNED = /\b(all|none) of (the above|these|them)\b|\bboth (of )?(the above|these|[a-d]\b)|\bboth [a-d] and [a-d]\b|\bneither\b.*\bnor\b.*\babove\b/i;
const LETTERS = ["A", "B", "C", "D"];

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function validateSet(file) {
  const errors = [];
  const warn = [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return { errors: [`invalid JSON: ${e.message}`], warn, data: null };
  }
  const n = Number(path.basename(file).match(/set-(\d+)\.json/)?.[1]);
  if (data.setId !== n) errors.push(`setId ${data.setId} does not match file number ${n}`);
  if (data.title !== `Set ${n}`) errors.push(`title should be "Set ${n}"`);
  const qs = data.questions;
  if (!Array.isArray(qs)) return { errors: [...errors, "questions is not an array"], warn, data };
  if (qs.length !== 25) errors.push(`expected 25 questions, got ${qs.length}`);

  const topicCount = {};
  const diffCount = { Easy: 0, Medium: 0, Hard: 0 };
  const letterCount = { A: 0, B: 0, C: 0, D: 0 };
  const concepts = new Set();
  let multiple = 0;

  qs.forEach((q, i) => {
    const tag = `Q${i + 1}`;
    const pad = (x) => String(x).padStart(2, "0");
    if (q.id !== `S${pad(n)}-Q${pad(i + 1)}`) errors.push(`${tag}: id should be S${pad(n)}-Q${pad(i + 1)}, got ${q.id}`);
    if (!["single", "multiple"].includes(q.type)) errors.push(`${tag}: bad type ${q.type}`);
    if (!(q.difficulty in DIFF_TARGET)) errors.push(`${tag}: bad difficulty ${q.difficulty}`);
    else diffCount[q.difficulty]++;
    if (!TOPICS.includes(q.topic)) errors.push(`${tag}: unknown topic "${q.topic}"`);
    topicCount[q.topic] = (topicCount[q.topic] || 0) + 1;
    for (const f of ["subtopic", "concept", "question", "explanation"]) {
      if (typeof q[f] !== "string" || q[f].trim().length < 3) errors.push(`${tag}: missing ${f}`);
    }
    if (q.source !== "Generated") errors.push(`${tag}: source must be "Generated"`);
    if (!SOURCE_FILES.includes(q.sourceRef)) errors.push(`${tag}: bad sourceRef ${q.sourceRef}`);
    else if (!fs.existsSync(path.join(SYLLABUS, q.sourceRef))) warn.push(`${tag}: sourceRef file not found on disk`);

    const c = norm(q.concept);
    if (concepts.has(c)) errors.push(`${tag}: concept repeated within set: ${q.concept}`);
    concepts.add(c);

    const o = q.options || {};
    const keys = Object.keys(o);
    if (keys.join(",") !== "A,B,C,D,E") errors.push(`${tag}: options must be exactly A,B,C,D,E in order`);
    if (o.E !== "Not Attempted") errors.push(`${tag}: option E must be "Not Attempted"`);
    const optTexts = LETTERS.map((l) => String(o[l] ?? "").toLowerCase().replace(/\s+/g, " ").trim());
    if (optTexts.some((t) => !t)) errors.push(`${tag}: empty option`);
    if (new Set(optTexts).size !== 4) errors.push(`${tag}: duplicate option text`);
    for (const l of LETTERS) if (BANNED.test(o[l] ?? "")) errors.push(`${tag}: banned phrasing in option ${l}: "${o[l]}"`);

    const cor = q.correct;
    if (!Array.isArray(cor) || cor.some((x) => !LETTERS.includes(x))) errors.push(`${tag}: correct must be letters from A-D`);
    else {
      if ([...cor].sort().join() !== cor.join() || new Set(cor).size !== cor.length) errors.push(`${tag}: correct must be sorted & unique`);
      if (q.type === "single") {
        if (cor.length !== 1) errors.push(`${tag}: single must have exactly 1 correct`);
        else letterCount[cor[0]]++;
      } else if (q.type === "multiple") {
        multiple++;
        if (cor.length < 2 || cor.length > 4) errors.push(`${tag}: multiple must have 2-4 correct`);
      }
      const wrong = LETTERS.filter((l) => !cor.includes(l));
      const dm = q.distractorMistakeType || {};
      const dk = Object.keys(dm).sort().join();
      if (dk !== wrong.join()) errors.push(`${tag}: distractorMistakeType keys must be exactly the wrong options [${wrong}], got [${dk}]`);
      for (const [k, v] of Object.entries(dm)) if (!MISTAKE_TYPES.includes(v)) errors.push(`${tag}: bad mistake type "${v}" for ${k}`);
    }
    if (i > 0 && qs[i - 1].topic === q.topic) errors.push(`${tag}: same topic as previous question (${q.topic})`);
  });

  for (const [t, c] of Object.entries(topicCount)) if (c > 4) errors.push(`topic "${t}" has ${c} questions (max 4)`);
  if (Object.keys(topicCount).length < 7) errors.push(`only ${Object.keys(topicCount).length} topics (min 7)`);
  for (const [d, t] of Object.entries(DIFF_TARGET)) if (diffCount[d] !== t) errors.push(`difficulty ${d}: ${diffCount[d]} (want ${t})`);
  if (multiple > 1) errors.push(`${multiple} multiple-select questions (max 1)`);
  for (const l of LETTERS) if (letterCount[l] < 3 || letterCount[l] > 9) errors.push(`correct letter ${l} used ${letterCount[l]} times (want 3-9)`);
  if (multiple === 1) {
    const pos = qs.findIndex((q) => q.type === "multiple");
    if (pos === 0 || pos === qs.length - 1) warn.push(`multiple-select question at position ${pos + 1} (prefer middle)`);
  }
  return { errors, warn, data };
}

function main() {
  const args = process.argv.slice(2).map(Number).filter(Boolean);
  const files = fs
    .readdirSync(QDIR)
    .filter((f) => /^set-\d+\.json$/.test(f))
    .filter((f) => !args.length || args.includes(Number(f.match(/\d+/)[0])))
    .sort();
  let failed = 0;
  const seenQ = new Map();
  const seenC = new Map();
  for (const f of files) {
    const { errors, warn, data } = validateSet(path.join(QDIR, f));
    if (data?.questions) {
      for (const q of data.questions) {
        const k = norm(q.question);
        if (seenQ.has(k)) errors.push(`${q.id}: question text duplicates ${seenQ.get(k)}`);
        else seenQ.set(k, q.id);
        const ck = norm(q.concept);
        if (seenC.has(ck)) warn.push(`${q.id}: concept "${q.concept}" also used in ${seenC.get(ck)} (ok only if a clearly different angle)`);
        else seenC.set(ck, q.id);
      }
    }
    if (errors.length) failed++;
    console.log(`${errors.length ? "FAIL" : "PASS"} ${f}${warn.length ? ` (${warn.length} warnings)` : ""}`);
    errors.forEach((e) => console.log(`   x ${e}`));
    warn.forEach((w) => console.log(`   ! ${w}`));
  }
  if (!files.length) console.log("no set files found");
  console.log(`\n${files.length - failed}/${files.length} sets passed`);
  process.exit(failed ? 1 : 0);
}

main();
