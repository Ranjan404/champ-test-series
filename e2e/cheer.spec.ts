import { expect, test } from "@playwright/test";

// Floating cheers during a test, and the Focus mode toggle that silences them.
test("cheers float on alternate answers and Focus mode hides them", async ({ page }, info) => {
  await page.goto("/practice/1");
  await page.fill("#username", `e2e-cheer-${info.project.name}`);
  await page.fill("#password", "e2e-password");
  await page.click("button[type=submit]");
  await expect(page.getByRole("timer")).toBeVisible();

  const focus = page.getByRole("button", { name: "Focus mode" });
  await expect(focus).toHaveAttribute("aria-pressed", "false");
  const cheers = page.locator(".cheer-float");

  const answer = async () => {
    if (await page.getByText("Select all correct options").isVisible()) await page.getByRole("checkbox").first().click();
    else await page.getByRole("radio").first().click();
  };

  // 1st new answer: nothing. 2nd: a meme floats up.
  await answer();
  await expect(cheers).toHaveCount(0);
  await page.getByRole("button", { name: "Save & Next" }).click();
  await answer();
  await expect(cheers).toHaveCount(1);
  if (info.project.name === "desktop") await page.screenshot({ path: "test-results/cheer-desktop.png" });
  await expect(cheers).toHaveCount(0, { timeout: 5000 });

  // Focus mode: no cheers, and the choice survives a reload.
  await focus.click();
  await expect(focus).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "Save & Next" }).click();
    await answer();
  }
  await expect(cheers).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Focus mode" })).toHaveAttribute("aria-pressed", "true");
});
