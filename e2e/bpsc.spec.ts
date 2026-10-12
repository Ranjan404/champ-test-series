import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, username: string) {
  await page.goto("/dashboard/bpsc-tre4");
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#username", username);
  await page.fill("#password", "e2e-password");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard\/bpsc-tre4/);
}

const fakeTest = (count: number) => ({
  topic: "history",
  language: "en",
  generatedAt: new Date().toISOString(),
  questions: Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    question: `Mock question ${i + 1}?`,
    options: ["Alpha", "Bravo", "Charlie", "Delta"],
    correctIndex: 1,
    explanation: `Bravo is right for question ${i + 1}.`,
    subTopic: i % 2 ? "Maurya Empire" : "Champaran Satyagraha",
  })),
});

test("BPSC TRE 4.0: configure, generate, take, submit, review, retake", async ({ page }, info) => {
  await login(page, `e2e-${info.project.name}`);

  // The real endpoint answers with a JSON error when no key is configured, and validates input.
  const bad = await page.request.post("/api/bpsc-test/generate", { data: { topic: "full", count: 12 } });
  expect(bad.status()).toBe(400);
  if (!process.env.GEMINI_API_KEY) {
    const noKey = await page.request.post("/api/bpsc-test/generate", { data: { topic: "full", count: 10, language: "hi" } });
    expect(noKey.status()).toBe(500);
    expect(await noKey.json()).toMatchObject({ code: "config" });
  }

  let sent: unknown = null;
  await page.route("**/api/bpsc-test/generate", async (route) => {
    sent = route.request().postDataJSON();
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({ json: fakeTest(10) });
  });

  await page.getByRole("radio", { name: /Bihar History/ }).click();
  await page.getByRole("radio", { name: "10", exact: true }).click();
  await page.getByRole("radio", { name: "English" }).click();
  await page.getByRole("button", { name: /Generate & Start Test/ }).click();
  await expect(page.getByRole("status")).toContainText("Setting your 10-question paper");

  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();
  expect(sent).toEqual({ topic: "history", count: 10, language: "en" });
  await expect(page.getByText("+1 for correct")).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/0?9:5\d|10:00/);

  // Q1 right, Q2 wrong, Q3 marked without an answer, Q4 option E, rest skipped.
  await page.getByRole("radio", { name: /Bravo/ }).click();
  await page.getByRole("button", { name: /Save & Next/ }).click();
  await page.getByRole("radio", { name: /Alpha/ }).click();
  await page.getByRole("button", { name: /Save & Next/ }).click();
  await page.getByRole("button", { name: /Save & Next/ }).click();
  await page.getByRole("radio", { name: /I do not wish to answer/ }).click();
  await page.getByRole("button", { name: /Previous/ }).click();
  await page.getByRole("button", { name: /Mark for review/ }).click();
  await expect(page.getByText("Marked for review")).toBeVisible();

  // Reload keeps the test and answers.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Question 3\b/ })).toBeVisible();

  // Palette jump (the palette is collapsed on phones).
  if (info.project.name === "phone") await page.getByRole("button", { name: /Question Palette/ }).click();
  await page.getByRole("button", { name: "Question 1: Answered" }).click();
  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Bravo/ })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Submit", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Submit the test?");
  await expect(dialog.getByText("Unanswered", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Submit test" }).click();

  await expect(page.getByRole("heading", { name: "Test Result" })).toBeVisible();
  await expect(page.getByText("0.67 / 10")).toBeVisible(); // 1 - 1/3
  await expect(page.getByText("50%")).toBeVisible(); // accuracy 1 of 2; option E is not counted
  await expect(page.getByRole("button", { name: "Skipped 8" })).toBeVisible(); // 7 unattempted + 1 option E
  await page.getByRole("button", { name: "Wrong 1" }).click();
  await expect(page.getByText("Bravo is right for question 2.")).toBeVisible();
  await expect(page.getByText("Mock question 1?")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.getByRole("button", { name: /Retake Test/ }).first().click();
  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Bravo/ })).toHaveAttribute("aria-checked", "false");

  await page.getByRole("button", { name: "Submit", exact: true }).filter({ visible: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Submit test" }).click();
  await page.getByRole("button", { name: /Generate New Set/ }).first().click();
  await expect(page.getByRole("button", { name: /Generate & Start Test/ })).toBeVisible();
});
