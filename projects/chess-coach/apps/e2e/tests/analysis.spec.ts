import { expect, test } from "@playwright/test";

test.describe("Analysis screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("load FEN, pawn promotion opens modal and promotes to queen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Solo Analysis")).toBeVisible({ timeout: 15_000 });

    // Navigate to the analysis screen.
    await page.getByText("Solo Analysis").click();
    await expect(page).toHaveURL(/\/analysis/);

    // Kings at a1 / a3, black pawn at c2 one square from promotion, black to move.
    const fen = "8/8/8/8/8/k7/2p5/K7 b - - 0 1";
    const fenInput = page.getByLabel("Load from FEN");
    await expect(fenInput).toBeVisible({ timeout: 15_000 });
    await fenInput.fill(fen);
    await page.getByRole("button", { name: "Load" }).click();

    // Confirm the loaded position.
    const a1 = page.locator("[data-square='a1']");
    const a3 = page.locator("[data-square='a3']");
    const c2 = page.locator("[data-square='c2']");
    const c1 = page.locator("[data-square='c1']");
    await expect(a1.locator("img[alt='w k']")).toBeVisible({ timeout: 10_000 });
    await expect(a3.locator("img[alt='b k']")).toBeVisible();
    await expect(c2.locator("img[alt='b p']")).toBeVisible();

    // Select the pawn; c1 should light up as a valid destination.
    await c2.click();
    await expect(c1).toHaveAttribute("class", /valid/, { timeout: 5_000 });

    // Attempt to promote — the modal should pop open before the move applies.
    await c1.click();

    // Label-scoped locator so this doesn't collide with the game-over dialog
    // that appears on mate (Qc1 delivers mate against Ka1 after promotion).
    const promotionModal = page.getByRole("dialog", { name: "Promote pawn" });
    await expect(promotionModal).toBeVisible({ timeout: 5_000 });
    await expect(promotionModal.getByRole("button", { name: "Promote to q" })).toBeVisible();
    await expect(promotionModal.getByRole("button", { name: "Promote to r" })).toBeVisible();
    await expect(promotionModal.getByRole("button", { name: "Promote to b" })).toBeVisible();
    await expect(promotionModal.getByRole("button", { name: "Promote to n" })).toBeVisible();

    // Pawn should not have moved yet — the modal gates the commit.
    await expect(c2.locator("img[alt='b p']")).toBeVisible();
    await expect(c1.locator("img")).toHaveCount(0);

    // Pick queen. The pawn gets replaced by a black queen on c1.
    await promotionModal.getByRole("button", { name: "Promote to q" }).click();

    await expect(promotionModal).not.toBeVisible();
    await expect(c1.locator("img[alt='b q']")).toBeVisible({ timeout: 5_000 });
    await expect(c2.locator("img")).toHaveCount(0);

    // Qc1 delivers mate against Ka1 (a2 covered by Ka3, b1 and b2 by the
    // queen). The game-over modal should show the Checkmate result and
    // an "Another game?" CTA.
    await expect(page.getByText("Checkmate")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: "Another game?" })).toBeVisible();
  });
});
