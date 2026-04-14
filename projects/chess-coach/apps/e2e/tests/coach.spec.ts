import { expect, test } from "@playwright/test";

test.describe("Coach (web-no-llm)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("app loads and shows the menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
  });

  test("navigate to coach screen, make a move, Selena responds", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });

    // Navigate to coach screen
    await page.getByText("Play with Selena").click();
    await expect(page).toHaveURL(/\/selena/);

    // Wait for the board to render with pieces
    const e2 = page.locator("[data-square='e2']");
    await expect(e2.locator("img")).toBeVisible({ timeout: 15_000 });

    // Select the e2 pawn — valid-move indicator confirms selection
    await e2.click();
    const e4 = page.locator("[data-square='e4']");
    await expect(e4).toHaveAttribute("class", /valid/, { timeout: 5_000 });

    // Play e2 → e4
    await e4.click();

    // Confirm human move applied
    await expect(e4.locator("img")).toBeVisible({ timeout: 5_000 });
    await expect(e2.locator("img")).not.toBeVisible();

    // Wait for Selena's response: a black piece on ranks 5-6
    const selenaMove = page.locator(
      ":is([data-square$='5'], [data-square$='6']) img[alt^='b']",
    );
    await expect(selenaMove.first()).toBeVisible({ timeout: 30_000 });
  });
});
