import { expect, test, type Page } from "@playwright/test";

// The GK/GS API routes are mocked in the browser here, so this spec runs offline and never depends on OpenTDB, PIB or
// Wikipedia being up. The fixtures are test-only and are not real content.

async function login(page: Page, username: string) {
  await page.goto("/gk");
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#username", username);
  await page.fill("#password", "e2e-password");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/gk$/);
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const source = (name: string) => ({ name, url: "https://example.org", license: "test" });
const fetchedAt = new Date().toISOString();

const questions = {
  category: "general",
  source: source("Open Trivia Database"),
  fetchedAt,
  stale: false,
  questions: [1, 2, 3].map((n) => ({
    id: `q${n}`,
    question: `Mock question ${n}?`,
    options: ["Alpha", "Bravo", "Charlie", "Delta"],
    correctIndex: 1,
    explanation: null,
    category: "General Knowledge",
    difficulty: "easy",
    lang: "en",
  })),
};

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const news = (lang: string, region: string) => ({
  region,
  lang,
  source: source("Press Information Bureau"),
  fetchedAt,
  stale: false,
  newestAt: daysAgo(0),
  items:
    lang === "hi" && region === "bihar"
      ? []
      : [
          { id: "n1", title: `Fresh ${region} ${lang} release`, url: "https://example.org/1", publishedAt: daysAgo(0), summary: "Short summary…", category: "Ministry of Testing", sourceName: "PIB Delhi", lang },
          { id: "n2", title: "Old release", url: "https://example.org/2", publishedAt: daysAgo(12), summary: null, category: null, sourceName: "PIB Delhi", lang },
          { id: "n3", title: "Undated release", url: "https://example.org/3", publishedAt: null, summary: null, category: null, sourceName: "PIB Delhi", lang },
        ],
});

const notes = (lang: string) => ({
  section: "bihar",
  lang,
  source: source("Wikipedia"),
  fetchedAt,
  stale: true,
  notes: [
    { key: "Kosi River", group: "geography", status: "ok", title: lang === "hi" ? "कोसी नदी" : "Kosi River", extract: lang === "hi" ? "कोसी परिचय।" : "Kosi intro.", url: "https://example.org/k", lang },
    lang === "hi"
      ? { key: "History of Bihar", group: "history", status: "no-article", title: "History of Bihar", extract: null, url: "https://example.org/h", englishUrl: "https://example.org/h", lang }
      : { key: "History of Bihar", group: "history", status: "ok", title: "History of Bihar", extract: "History intro.", url: "https://example.org/h", lang },
  ],
});

test("GK/GS: hub, language switch, quiz, current affairs, Bihar notes", async ({ page }, info) => {
  await login(page, `e2e-${info.project.name}`);

  const requests: string[] = [];
  let questionsStatus = 429;
  await page.route("**/api/gk/questions**", async (route) => {
    requests.push(route.request().url());
    if (questionsStatus === 429) {
      await route.fulfill({ status: 429, headers: { "Retry-After": "6" }, json: { error: "Open Trivia Database: busy", code: "rate_limited" } });
    } else {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({ json: questions });
    }
  });
  await page.route("**/api/current-affairs**", async (route) => {
    const u = new URL(route.request().url());
    requests.push(u.pathname + u.search);
    await route.fulfill({ json: news(u.searchParams.get("lang")!, u.searchParams.get("region")!) });
  });
  await page.route("**/api/gk/notes**", async (route) => {
    const u = new URL(route.request().url());
    requests.push(u.pathname + u.search);
    await route.fulfill({ json: notes(u.searchParams.get("lang")!) });
  });

  // Hub
  await expect(page.getByRole("heading", { name: "GK/GS & Current Affairs" })).toBeVisible();
  for (const name of ["Indian GK/GS", "Bihar GK/GS", "Current Affairs"]) await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Old AI page redirects here
  await page.goto("/dashboard/bpsc-tre4");
  await expect(page).toHaveURL(/\/gk$/);

  // Hindi is remembered across GK/GS pages; the English-only quiz says so instead of showing English as Hindi.
  await page.getByRole("radio", { name: "हिन्दी" }).click();
  await expect(page.getByRole("heading", { name: "सामान्य ज्ञान एवं समसामयिकी" })).toBeVisible();
  await page.getByRole("link", { name: "भारत GK/GS" }).first().click();
  await expect(page).toHaveURL(/\/gk\/india$/);
  await expect(page.getByText("ये प्रश्न केवल अंग्रेज़ी में उपलब्ध हैं")).toBeVisible();
  await page.reload();
  await expect(page.getByText("ये प्रश्न केवल अंग्रेज़ी में उपलब्ध हैं")).toBeVisible();
  await page.getByRole("radio", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();
  expect(requests.filter((r) => r.includes("/api/gk/questions"))).toHaveLength(0); // nothing fetched before Start

  // Rate limit -> error with retry; retry succeeds.
  await page.getByRole("radio", { name: "History" }).click();
  await page.getByRole("radio", { name: "5", exact: true }).click();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The source is busy" })).toBeVisible();
  questionsStatus = 200;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 3" })).toBeVisible();
  expect(requests.at(-1)).toContain("category=history&amount=5");

  // No answer shown before checking; check is disabled until an option is chosen.
  await expect(page.getByText("Correct answer:")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Check answer" })).toBeDisabled();
  await page.getByRole("radio", { name: /Alpha/ }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Incorrect", { exact: true })).toBeVisible();
  await expect(page.getByText("Correct answer: B. Bravo")).toBeVisible();
  await expect(page.getByText("The source does not provide an explanation for this question.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Charlie/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Check answer" })).toHaveCount(0);

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Question 2 of 3" })).toBeVisible();
  await page.getByRole("radio", { name: /Bravo/ }).click();
  await page.getByRole("button", { name: "Check answer" }).click();
  await expect(page.getByText("Correct", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByRole("radio", { name: /Alpha/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Question 3 of 3: Not checked" }).click();
  await expect(page.getByRole("heading", { name: "Question 3 of 3" })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("button", { name: "Finish quiz" }).click();

  await expect(page.getByRole("heading", { name: "Quiz result" })).toBeVisible();
  await expect(page.getByText("1 / 3")).toBeVisible();
  await expect(page.getByText("33.3%")).toBeVisible();
  await expect(page.getByText("Your answer: Not answered")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.getByRole("button", { name: "Retry these questions" }).click();
  await expect(page.getByRole("heading", { name: "Question 1 of 3" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Alpha/ })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Question 3 of 3: Not checked" }).click();
  await page.getByRole("button", { name: "Finish quiz" }).click();
  await page.getByRole("button", { name: "New quiz" }).click();
  await expect(page.getByRole("button", { name: "Start quiz" })).toBeVisible();

  // Study notes tab
  await page.getByRole("tab", { name: "Study notes" }).click();
  await expect(page.getByText("Kosi intro.")).toBeVisible();
  await expect(page.getByText(/The source is not responding right now/)).toBeVisible(); // stale copy is labelled

  // Current affairs: dates, age badge, undated item, region switch
  await page.getByRole("link", { name: "Current Affairs" }).first().click();
  await expect(page.getByRole("link", { name: "Fresh india en release" })).toBeVisible();
  await expect(page.getByText("12 days old")).toBeVisible();
  await expect(page.getByText("Publication date not available from the source")).toBeVisible();
  await expect(page.getByText("Ministry of Testing")).toBeVisible();
  await page.getByRole("radio", { name: "Bihar (PIB Patna)" }).click();
  await expect(page.getByRole("link", { name: "Fresh bihar en release" })).toBeVisible();

  // Hindi Bihar feed is empty: say so, and offer English releases labelled as English.
  await page.getByRole("radio", { name: "हिन्दी" }).click();
  await expect(page.getByText("PIB पटना की हिन्दी फ़ीड में अभी कोई विज्ञप्ति नहीं है।")).toBeVisible();
  await page.getByRole("button", { name: "अंग्रेज़ी विज्ञप्तियाँ दिखाएँ" }).click();
  await expect(page.getByText("नीचे की विज्ञप्तियाँ अंग्रेज़ी में हैं (मूल भाषा)।")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fresh bihar en release" })).toHaveAttribute("lang", "en");
  expect(requests).toContain("/api/current-affairs?region=bihar&lang=en");
  expect(requests).toContain("/api/current-affairs?region=bihar&lang=hi");

  // Bihar notes in Hindi: real Hindi extract, and a clear note where no reviewed Hindi article exists.
  await page.getByRole("link", { name: "बिहार GK/GS" }).first().click();
  await expect(page.getByText("बिहार क्विज़ क्यों नहीं है")).toBeVisible();
  await expect(page.locator("div[lang=hi]", { hasText: "कोसी परिचय।" })).toBeVisible();
  await expect(page.getByText("इस विषय पर कोई समीक्षित हिन्दी विकिपीडिया लेख उपलब्ध नहीं है।")).toBeVisible();
  await expect(page.getByRole("link", { name: "अंग्रेज़ी लेख पढ़ें" })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Navbar GK/GS link points at the new section
  if (info.project.name === "phone") await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "GK/GS" })).toHaveAttribute("href", "/gk");
});
