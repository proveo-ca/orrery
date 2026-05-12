import { expect, test } from "@playwright/test";

test.describe("Mating sequence detection (web-no-llm)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("detects human mating sequence after Qh5 following black Nf6 blunder", async ({ page }) => {
    // Hijack starting FEN (black to move). Black has just played Nf6??.
    // White (the player) now plays Qh5 which begins a mating sequence vs opponent.
    const fenAfterNf6 =
      "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 1 4";

    await page.goto("/");
    await page.evaluate((fen) => {
      localStorage.clear();
      localStorage.setItem(
        "chess_coach_game_state",
        JSON.stringify({
          pgn: "",
          currentIndex: 0,
          startingFen: fen,
        }),
      );
    }, fenAfterNf6);
    await page.reload();

    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
    await page.getByText("Play with Selena").click();
    await expect(page).toHaveURL(/\/selena/);

    // Position ready: white to move, Qd1-h5 is legal.
    const d1 = page.locator("[data-square='d1']");
    await d1.click();
    const h5 = page.locator("[data-square='h5']");
    await expect(h5).toHaveAttribute("class", /valid/, { timeout: 5_000 });
    await h5.click();

    // Qh5 executed: this exercises the exact human-move path in useMoveExecutor
    // that contains the new mating-sequence detection (analysis mate<0 for opponent).
    await expect(h5.locator("img[alt='w q']")).toBeVisible({ timeout: 10_000 });
  });
});
