import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, username: string) {
  await page.goto("/practice");
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#username", username);
  await page.fill("#password", "e2e-password");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/practice/);
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("full flow: timed test, previous, submit, unlock, result, retake keeps unlock", async ({ page }, info) => {
  await login(page, `e2e-${info.project.name}`);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Set 2 is locked at first, even by URL
  await page.goto("/practice/2");
  await expect(page).toHaveURL(/\/practice$/);

  await page.goto("/practice/1");
  await expect(page.getByRole("timer")).toBeVisible();
  for (let i = 1; i <= 25; i++) {
    await expect(page.getByRole("heading", { name: new RegExp(`Question ${i}\\b`) })).toBeVisible();
    // No answers or explanations before submitting
    expect(await page.content()).not.toContain('"correct":[');
    await expect(page.getByText("Explanation:")).toHaveCount(0);
    const multi = await page.getByText("Select all correct options").isVisible();
    if (multi) {
      await page.getByRole("checkbox").nth(0).click();
      await page.getByRole("checkbox").nth(1).click();
      await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
    } else if (i !== 3) {
      await page.getByRole("radio").nth(i % 5).click(); // includes E on some questions; Q3 is left unanswered
    }
    expect(await noHorizontalScroll(page)).toBe(true);
    if (i === 2) {
      // Previous keeps the saved answer
      await page.getByRole("button", { name: "Save & Next" }).click();
      await page.getByRole("button", { name: "Previous question" }).click();
      await expect(page.getByRole("heading", { name: /Question 2\b/ })).toBeVisible();
      await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);
    }
    if (i < 25) await page.getByRole("button", { name: "Save & Next" }).click();
  }
  await page.getByRole("button", { name: "Submit" }).first().click();
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page).toHaveURL(/\/practice\/1\/result$/);
  await expect(page.getByText("Next set").first()).toBeVisible();

  await expect(page.getByText("Topic-wise performance")).toBeVisible();
  await expect(page.getByText("Revision plan")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Reset set 1: set 2 stays unlocked
  await page.getByRole("button", { name: "Retry this set" }).first().click();
  await page.getByRole("button", { name: "Yes, reset" }).click();
  await expect(page).toHaveURL(/\/practice\/1$/);
  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await page.goto("/practice/2");
  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();

  await page.goto("/dashboard");
  expect(await noHorizontalScroll(page)).toBe(true);
});
