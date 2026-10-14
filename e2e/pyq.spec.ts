import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, username: string) {
  await page.goto("/pyq");
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#username", username);
  await page.fill("#password", "e2e-password");
  await page.click("button[type=submit]");
  await expect(page).toHaveURL(/\/pyq/);
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("PYQ flow: list, timed test, submit, unlock, result, retake", async ({ page }, info) => {
  await login(page, `e2e-${info.project.name}`);
  await expect(page.getByRole("heading", { name: "PYQ Sets" })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // PYQ set 2 is locked at first, even by URL
  await page.goto("/pyq/2");
  await expect(page).toHaveURL(/\/pyq$/);

  await page.goto("/pyq/1");
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByText(/PYQ · PYQ Set 1/)).toBeVisible();
  for (let i = 1; i <= 25; i++) {
    await expect(page.getByRole("heading", { name: new RegExp(`Question ${i}\\b`) })).toBeVisible();
    expect(await page.content()).not.toContain('"correct":[');
    await page.getByRole("radio").nth(i % 4).click();
    expect(await noHorizontalScroll(page)).toBe(true);
    if (i < 25) await page.getByRole("button", { name: "Save & Next" }).click();
  }
  await page.getByRole("button", { name: "Submit" }).first().click();
  await page.getByRole("button", { name: "Submit test" }).click();
  await expect(page).toHaveURL(/\/pyq\/1\/result$/);
  await expect(page.getByText("PYQ performance")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to PYQs" }).first()).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Retake set 1: PYQ set 2 stays unlocked
  await page.getByRole("button", { name: "Retry this set" }).first().click();
  await page.getByRole("button", { name: "Yes, reset" }).click();
  await expect(page).toHaveURL(/\/pyq\/1$/);
  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();
  await page.goto("/pyq/2");
  await expect(page.getByRole("heading", { name: /Question 1\b/ })).toBeVisible();
});
