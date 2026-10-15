import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, username: string) {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#username", username);
  await page.fill("#password", "e2e-password");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/dashboard/);
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

const timeLeft = async (page: Page) => {
  const [m, s] = ((await page.getByRole("timer").textContent()) ?? "").trim().split(":").map(Number);
  return m * 60 + s;
};

/** Opens a Test menu item, from the dropdown on desktop or the menu sheet on phones. */
async function openTest(page: Page, isMobile: boolean, name: string) {
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator("#mobile-nav").getByRole("link", { name: new RegExp(name) }).click();
  } else {
    await page.getByRole("button", { name: "Test", exact: true }).click();
    await page.getByRole("menu", { name: "Tests" }).getByRole("menuitem", { name: new RegExp(name) }).click();
  }
}

test("Full Length flow: Test menu, 150 questions, pause on leaving, resume, submit", async ({ page, isMobile }, info) => {
  await login(page, `e2e-${info.project.name}`);

  // Every test page is reachable from the Test menu.
  for (const [name, url] of [
    ["Practice Sets", /\/practice$/],
    ["PYQs", /\/pyq$/],
    ["Daily Question", /\/daily$/],
    ["Full Length Test", /\/full-length$/],
  ] as const) {
    await openTest(page, isMobile, name);
    await expect(page).toHaveURL(url);
  }
  await expect(page.getByRole("heading", { name: "Full Length Tests" })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Test 2 is locked at first, even by URL
  await page.goto("/full-length/2");
  await expect(page).toHaveURL(/\/full-length$/);

  await page.getByRole("link", { name: "Start test" }).first().click();
  await expect(page.getByRole("heading", { name: /Question 1 of 150/ })).toBeVisible();
  expect(await timeLeft(page)).toBeGreaterThan(149 * 60);
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole("radio").first().click();
  await page.getByRole("button", { name: "Save & Next" }).click();
  await expect(page.getByRole("heading", { name: /Question 2 of 150/ })).toBeVisible();

  // Section tabs jump to the Computer Science part.
  await page.getByRole("tab", { name: /Computer Science/ }).click();
  await expect(page.getByRole("heading", { name: /Question 71 of 150/ })).toBeVisible();

  // Pause: the questions are hidden and the clock stands still.
  await page.getByRole("button", { name: "Pause test" }).click();
  await expect(page.getByRole("heading", { name: "Test paused" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  const pausedAt = await timeLeft(page);
  await page.waitForTimeout(2500);
  expect(await timeLeft(page)).toBe(pausedAt);
  await page.getByRole("button", { name: "Resume test" }).click();
  await expect(page.getByRole("heading", { name: /Question 71 of 150/ })).toBeVisible();

  // Leaving the page pauses on the server: the list shows the time left, and it has not moved on when we come back.
  await openTest(page, isMobile, "PYQs");
  await expect(page).toHaveURL(/\/pyq$/);
  await page.waitForTimeout(3500);
  await page.goto("/full-length");
  await expect(page.getByText(/left on the timer/)).toBeVisible();
  await page.getByRole("link", { name: "Resume" }).first().click();
  await expect(page.getByRole("heading", { name: /Question 71 of 150/ })).toBeVisible();
  expect(pausedAt - (await timeLeft(page))).toBeLessThan(4);

  await page.getByRole("button", { name: "Submit" }).first().click();
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page).toHaveURL(/\/full-length\/1\/result$/);
  await expect(page.getByText(/of 150:00/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Full Length Tests" }).first()).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
