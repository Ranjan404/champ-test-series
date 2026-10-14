#!/usr/bin/env node
// Validates data/pyq_questions/set-XX.json (Computer Science previous-year questions, 25 per set).
// Usage: node scripts/validate-pyq-questions.mjs [setNumber ...]
// Same answer format as the other sets. PYQ wording is kept as printed, so "None of the above" style options are allowed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "data", "pyq_questions");

const TOPICS = [
  "Computer Fundamentals & Architecture",
  "Digital Logic & Number Systems",
  "C, C++, Java & OOP",
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
  "Office Tools & Internet",
];
const MISTAKE_TYPES = ["Conceptual", "Calculation", "Confusion Between Concepts", "Careless Error", "Question Misread", "Memory/Fact"];
const LETTERS = ["A", "B", "C", "D"];
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function validateSet(file) {
  const errors = [];
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return { errors: [`invalid JSON: ${e.message}`], data: null };
  }
  const n = Number(path.basename(file).match(/set-(\d+)\.json/)?.[1]);
  const pad = (x) => String(x).padStart(2, "0");
  if (data.setId !== n) errors.push(`setId ${data.setId} does not match file number ${n}`);
  if (data.title !== `PYQ Set ${n}`) errors.push(`title should be "PYQ Set ${n}"`);
  const qs = data.questions;
  if (!Array.isArray(qs)) return { errors: [...errors, "questions is not an array"], data };
  if (qs.length !== 25) errors.push(`expected 25 questions, got ${qs.length}`);
  qs.forEach((q, i) => {
    const tag = `Q${i + 1}`;
    if (q.id !== `P${pad(n)}-Q${pad(i + 1)}`) errors.push(`${tag}: id should be P${pad(n)}-Q${pad(i + 1)}, got ${q.id}`);
    if (q.type !== "single") errors.push(`${tag}: PYQ questions are single-answer only`);
    if (!["Easy", "Medium", "Hard"].includes(q.difficulty)) errors.push(`${tag}: bad difficulty ${q.difficulty}`);
    if (!TOPICS.includes(q.topic)) errors.push(`${tag}: unknown topic "${q.topic}"`);
    for (const f of ["subtopic", "concept", "question", "explanation", "sourceRef"]) {
      if (typeof q[f] !== "string" || q[f].trim().length < 3) errors.push(`${tag}: missing ${f}`);
    }
    if (q.source !== "PYQ") errors.push(`${tag}: source must be "PYQ"`);
    const o = q.options || {};
    if (Object.keys(o).join(",") !== "A,B,C,D,E") errors.push(`${tag}: options must be exactly A,B,C,D,E in order`);
    if (o.E !== "Not Attempted") errors.push(`${tag}: option E must be "Not Attempted"`);
    const texts = LETTERS.map((l) => String(o[l] ?? "").toLowerCase().replace(/\s+/g, " ").trim());
    if (texts.some((t) => !t)) errors.push(`${tag}: empty option`);
    if (new Set(texts).size !== 4) errors.push(`${tag}: duplicate option text`);
    const cor = q.correct;
    if (!Array.isArray(cor) || cor.length !== 1 || !LETTERS.includes(cor[0])) errors.push(`${tag}: correct must be exactly one of A-D`);
    else {
      const wrong = LETTERS.filter((l) => l !== cor[0]);
      const dm = q.distractorMistakeType || {};
      if (Object.keys(dm).sort().join() !== wrong.join()) errors.push(`${tag}: distractorMistakeType keys must be exactly [${wrong}]`);
      for (const [k, v] of Object.entries(dm)) if (!MISTAKE_TYPES.includes(v)) errors.push(`${tag}: bad mistake type "${v}" for ${k}`);
    }
    if (i > 0 && qs[i - 1].topic === q.topic) errors.push(`${tag}: same topic as previous question (${q.topic})`);
    if (JSON.stringify(q).includes("\u2014")) errors.push(`${tag}: contains an em dash`);
  });
  return { errors, data };
}

function main() {
  const args = process.argv.slice(2).map(Number).filter(Boolean);
  const files = fs
    .readdirSync(DIR)
    .filter((f) => /^set-\d+\.json$/.test(f))
    .filter((f) => !args.length || args.includes(Number(f.match(/\d+/)[0])))
    .sort();
  let failed = 0;
  let repeats = 0;
  const seen = new Map();
  files.forEach((f, i) => {
    if (!args.length && f !== `set-${String(i + 1).padStart(2, "0")}.json`) console.log(`! ${f}: set numbers must be consecutive from 01`);
    const { errors, data } = validateSet(path.join(DIR, f));
    const notes = [];
    for (const q of data?.questions ?? []) {
      const key = norm(q.question) + "|" + Object.values(q.options ?? {}).map(norm).sort().join("|");
      // The same question can appear in more than one exam paper; a repeat is allowed but listed.
      if (seen.has(key)) {
        if (seen.get(key).startsWith(`P${f.match(/\d+/)[0]}-`)) errors.push(`${q.id}: duplicates ${seen.get(key)} in the same set`);
        else notes.push(`${q.id}: same question as ${seen.get(key)} (asked again in ${q.sourceRef})`);
        repeats++;
      } else seen.set(key, q.id);
    }
    if (errors.length) failed++;
    console.log(`${errors.length ? "FAIL" : "PASS"} ${f}`);
    errors.forEach((e) => console.log(`   x ${e}`));
    notes.forEach((e) => console.log(`   i ${e}`));
  });
  if (!files.length) console.log("no PYQ set files found");
  console.log(`\n${files.length - failed}/${files.length} PYQ sets passed${repeats ? ` (${repeats} questions repeated from other papers)` : ""}`);
  process.exit(failed ? 1 : 0);
}

main();
