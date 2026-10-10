# Champ Test Series

CSE practice-test web app: 50 sets x 25 syllabus-based questions, one question at a time, instant feedback,
+1 / -1/3 / 0 marking, sequential unlocking and a detailed result report per set.

Built with Next.js 16 (App Router) + TypeScript + Tailwind CSS v4. All data lives in JSON files; there is no database.

## Quick start

```bash
npm install
cp .env.example .env.local        # then put a long random SESSION_SECRET in it
npm run create-user -- yourname   # prompts for a password (min 8 chars)
npm run dev                       # http://localhost:3000
```

Production:

```bash
npm run build
npm start                         # port 3000; set PORT to change
```

Session cookies are `Secure` in production, so serve it over HTTPS. If you run `npm start` over plain
http (e.g. on a LAN), set `INSECURE_COOKIES=1`, or login won't stick.

## Hosting

The app writes progress to `data/progress/*.json`, so it needs a server with a persistent disk (a VPS,
Railway/Render with a disk, or your own machine). Vercel serverless won't work (read-only filesystem).
Run a single Node process: the file locks are in-process.

With Supabase configured (`SUPABASE_URL` + `SUPABASE_SECRET_KEY` in `.env.local`), users and progress are stored in
Supabase instead, so serverless hosts like Vercel work too. Setup: run `supabase/schema.sql` in the Supabase SQL
Editor, then `npm run migrate-to-supabase` to copy existing `data/users.json` and `data/progress/*.json`.
Questions always stay in `data/questions/`. Setting `DATA_DIR` forces the JSON files (the e2e tests do this).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run create-user -- <name> [password]` | Add a user, or reset an existing user's password |
| `npm run validate` | Check every question set against `syllabus/TEST_RULES.md` |
| `npm test` | Unit tests: scoring, unlock, reset, report |
| `npm run test:e2e` | Build + Playwright run on phone and desktop sizes |
| `npm run lint` | TypeScript type check |

## Data

```
data/
  users.json              # [{ id, username, passwordHash, createdAt }]  (bcrypt hashes)
  questions/set-01..50.json
  progress/<userId>.json  # { unlockedUpTo, sets: { "<n>": current attempt }, history: [completed attempts] }
```

- Writes are atomic (temp file + rename) and serialised per file.
- `unlockedUpTo` only ever goes up. Reset deletes the set's current attempt; finished attempts stay in `history`
  (score + wrong question ids), which feeds "score improved from X to Y" and repeated-weakness detection.
- Correct answers, topics and difficulty never reach the browser before you submit. Scoring is server-side only.

## Question rules (enforced by `npm run validate`)

25 questions, A-D + E = "Not Attempted" (never correct), max 4 per topic and at least 7 topics, no two
consecutive questions on the same topic, 5 Easy / 12 Medium / 8 Hard, at most 1 multiple-select per set,
answer letters spread across A-D, no "all/none of the above", every question cites its syllabus batch file,
and no duplicate question text or concept across the 50 sets.

Every question is tagged `Generated` (the batch files have no exam-year attribution), so result pages say there
are no PYQ questions.
