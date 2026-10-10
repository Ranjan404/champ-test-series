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

test("full flow: test, unlock, result, reset keeps unlock", async ({ page }, info) => {
  await login(page, `e2e-${info.project.name}`);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Set 2 is locked at first, even by URL
  await page.goto("/practice/2");
  await expect(page).toHaveURL(/\/practice$/);

  await page.goto("/practice/1");
  for (let i = 1; i <= 25; i++) {
    await expect(page.getByRole("heading", { name: new RegExp(`Question ${i}\\b`) })).toBeVisible();
    // The answer must not be in the page before submitting
    expect(await page.content()).not.toContain('"correct":[');
    const multi = await page.getByText("Select all correct options").isVisible();
    if (multi) {
      await page.getByRole("checkbox").nth(0).click();
      await page.getByRole("checkbox").nth(1).click();
      await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(2);
    } else {
      await page.getByRole("radio").nth(i % 5).click(); // includes E on some questions
    }
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Explanation:")).toBeVisible();
    await page.getByRole("button", { name: i === 25 ? /Finish/ : /Next/ }).click();
  }
  await expect(page.getByRole("heading", { name: "Test Completed" })).toBeVisible();
  await expect(page.getByText("Set 2 unlocked")).toBeVisible();

  await page.getByRole("link", { name: "View Result" }).click();
  await expect(page.getByText("Topic-wise performance")).toBeVisible();
  await expect(page.getByText("Revision plan")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Reset set 1: set 2 stays unlocked
  await page.getByRole("button", { name: "Retry this set" }).first().click();
  await page.getByRole("button", { name: "Yes, reset" }).click();
  await expect(page).toHaveURL(/\/practice\/1$/);
  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();
  await page.goto("/practice/2");
  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();

  await page.goto("/dashboard");
  expect(await noHorizontalScroll(page)).toBe(true);
});
