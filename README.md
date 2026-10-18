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
| `npm run validate:daily` | Check the Daily Question sets in `data/dailyquestions/` |
| `npm run validate:pyq` | Check the PYQ sets in `data/pyq_questions/` |
| `npm test` | Unit tests: scoring, unlock, reset, report |
| `npm run test:e2e` | Build + Playwright run on phone and desktop sizes |
| `npm run lint` | TypeScript type check |

## Data

```
data/
  users.json              # [{ id, username, passwordHash, createdAt }]  (bcrypt hashes)
  questions/set-01..50.json
  dailyquestions/set-01..40.json  # Daily Question rotation (ids D01-Q01...)
  pyq_questions/set-01..31.json   # PYQ sets (ids P01-Q01...)
  full_length_questions/set-01..05.json  # Full Length Tests, 150 questions each (ids F01-Q001...)
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

## Daily Question

One daily set per day (Indian time), rotating through `data/dailyquestions/set-01..40.json`: set 1 on
2026-10-13 (`DAILY_START_DATE` in `lib/daily.ts`), set 2 the next day, and back to set 1 after the last file. Adding
`set-41.json` adds it to the rotation. Each set has 25 single-answer questions, a 25-minute timer and the same
+1 / -1/3 / 0 marking, and can be attempted any number of times that day. The test works like the practice sets:
question palette, mark for review, Previous, Save & Next, and Submit (automatic when time runs out).

Attempts are kept on the server (`daily` in the progress file), so a reload or another device resumes the same
attempt. The 25 minutes are timed on the server. Correct answers only reach the browser on the result page.

The 1,000 questions come from two PDFs: the 328-question "Marathon" paper (answer key checked, questions with
"all/none of the above" rewritten to one correct option) and the "STET Computer Selected Topic" notes (questions
written from the slides). `sourceRef` says which PDF each question came from (`MARATHON_328#Q<n>` or `STET_NOTES#p<page>`).

## PYQs

The PYQs page (`/pyq`) has 31 sets of 25 Computer Science questions taken from previous papers (Bihar STET 2019,
2023 and 2025, and BPSC TRE 1.0, 2.0 and 3.0). Non-CS questions from those papers are not included. The sets work like
practice sets: same 25-minute timer, marking, sequential unlocking, retake and result report. Their progress is kept
separately in `progress.pyq`. Every question is tagged `PYQ`, and its `sourceRef` names the paper and question number.
Adding `set-32.json` adds a set. The same question sometimes appears in more than one paper, and `npm run validate:pyq`
lists those repeats.

## Full Length Tests

The Full Length Test page (`/full-length`) has complete papers of 150 questions in three sections (Language, GK & GS,
Computer Science) with a 150-minute timer. They work like practice sets: marking, sequential unlocking, retake and result
report, with section tabs and a grouped question palette. Progress is kept separately in `progress.fullLength`.

Unlike the other tests, the timer pauses. It stops when the candidate presses Pause, leaves the test page, switches tab or
app, closes the tab, or logs out, and continues from where it stopped on return. The open test reports to the server every
20 seconds; if those reports stop (crash, lost network), the server stops counting 60 seconds after the last one. The
server keeps the time used in `timer.usedMs` on the attempt. Adding `set-06.json` adds a test.

All test pages are grouped under the **Test** menu in the navbar.

## GK/GS & Current Affairs

The **GK/GS** navbar link opens `/gk`, with three sections and a Hindi/English switch that carries across them
(remembered in the browser's localStorage only). Content is fetched live from public sources by server-side route
handlers and kept in a transient in-memory cache (lost on restart). **Nothing GK/GS-related is stored anywhere:**
not in Supabase, not in `data/`, not in the progress file. Quiz answers and scores live in React state and are gone on
reload.

| Page | Content | Source (what it actually provides) |
| --- | --- | --- |
| `/gk/india` | Quiz | [Open Trivia Database](https://opentdb.com): MCQs with an answer key, English only, world/general trivia, **not** India-specific exam questions, no explanations. CC BY-SA 4.0. |
| `/gk/india`, `/gk/bihar` | Study notes | Wikipedia (English and Hindi) via the MediaWiki API: the introduction of each article listed in `lib/gk/topics.ts`. CC BY-SA 4.0. Community-edited, not official. |
| `/gk/current-affairs` | News to read (not quiz questions) | [PIB](https://www.pib.gov.in) press-release RSS: PIB Delhi for India, PIB Patna for Bihar, English and Hindi. Free reuse with acknowledgement ([policy](https://pib.gov.in/Content/102_2_Copyright-Policy.aspx)). |

API routes (all require login, like the rest of the API):

- `GET /api/gk/questions?category=general|history|geography|science|politics&amount=5|10|15`
- `GET /api/gk/notes?section=india|bihar&lang=en|hi`
- `GET /api/current-affairs?region=india|bihar&lang=en|hi`

Limitations, by design rather than filled with made-up content:

- **No Bihar quiz.** No public source publishes Bihar GK/GS MCQs with a verified answer key, and none are generated.
  The Bihar page shows study notes and links to the official portal for schemes and budget figures.
- **No Hindi quiz.** OpenTDB is English only; Hindi users are told so and can choose to see the English questions.
- **PIB feeds carry only a headline and link.** The date, ministry and summary are read from each public release page
  (the summary is PIB's own ~100-character preview, shown with an ellipsis). If a page can't be read in time, the item
  is shown as "date not available" rather than given a guessed date. Items older than 3 days carry an age badge.
- **PIB Patna's Hindi feed is usually empty;** the page says so and offers the English releases, labelled as English.
- **Hindi Wikipedia articles were reviewed on 2026-10-18.** Hindi articles whose introduction was opinionated or
  factually wrong are excluded (`hi: null` with a reason in `lib/gk/topics.ts`) and the page says no reviewed Hindi
  article is available. Hindi and English articles are written independently and can differ.
- **Bihar government portals** (state.bihar.gov.in) offer no RSS feed or API, so they are linked, not fetched.

Rate limits and caching: OpenTDB allows one request per IP every 5 seconds, so the server fetches a 50-question pool
per category, keeps it for 30 minutes and spaces its own calls 5.5 s apart (one automatic retry after a 429). PIB feeds
are cached for 20 minutes and each release page's date for a day; Wikipedia notes for 12 hours. When a source fails
and an earlier copy is still in memory, that copy is shown with a "source not responding, fetched on ..." notice;
otherwise the page shows the error with a retry button. A failing source only affects its own section.

No API keys or registration are needed for any of these sources. Optional: `SOURCE_USER_AGENT` overrides the
User-Agent sent to the sources (Wikimedia asks for contact details in it, e.g.
`Mozilla/5.0 (compatible; ChampTestSeries/1.0; +https://your-site.example; you@example.com)`).

This replaced the earlier AI-generated "BPSC TRE 4.0" GK/GS page (`/dashboard/bpsc-tre4`, which now redirects to
`/gk`). `GEMINI_API_KEY`, `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` are no longer used and can be deleted from your
environment.
