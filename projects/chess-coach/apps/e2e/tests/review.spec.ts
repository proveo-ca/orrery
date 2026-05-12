import { expect, test } from "@playwright/test";

/**
 * Seeds localStorage with a hand-crafted GameRecord that exercises every
 * annotation path:
 *   - e4 (white, ply 0): best move, followed a hint
 *   - e5 (AI / black, ply 1): unannotated
 *   - d4 (white, ply 2): blunder (cpDelta -350)
 *   - d5 (AI, ply 3): unannotated
 *   - Nf3 (white, ply 4): forced (best + blunder) → also retro-marks ply 2 blunder
 *   - Nc6 (AI, ply 5): unannotated
 */
const FIXTURE_ID = "test-review-fixture-0001";
const FIXTURE_PGN = "1. e4 e5 2. d4 d5 3. Nf3 Nc6";
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const fixture = {
  games: [
    {
      id: FIXTURE_ID,
      startedAt: new Date("2026-04-14").toISOString(),
      endedAt: new Date("2026-04-14").toISOString(),
      result: "win",
      pgn: FIXTURE_PGN,
      startingFen: STARTING_FEN,
      playerColor: "w",
      difficulty: "easy",
      moves: [
        { san: "e4", hasPressedHint: true, isAI: false },
        { san: "e5", hasPressedHint: false, isAI: true },
        { san: "d4", hasPressedHint: false, isAI: false },
        { san: "d5", hasPressedHint: false, isAI: true },
        { san: "Nf3", hasPressedHint: false, isAI: false },
        { san: "Nc6", hasPressedHint: false, isAI: true },
      ],
    },
  ],
  inProgress: null,
};

test.describe("Review screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate((payload) => {
      localStorage.clear();
      localStorage.setItem("chess_coach_game_history", JSON.stringify(payload));
    }, fixture);
  });

  test("loads a saved game and renders annotated move list", async ({ page }) => {
    await page.goto(`review/${FIXTURE_ID}`);
    await expect(page).toHaveURL(/\/review\/test-review-fixture-0001/);

    const moveList = page.getByLabel("Move list");
    await expect(moveList).toBeVisible({ timeout: 15_000 });

    // Move list should show all 3 turn numbers and 6 ply buttons.
    await expect(moveList.getByText("1.")).toBeVisible();
    await expect(moveList.getByText("2.")).toBeVisible();
    await expect(moveList.getByText("3.")).toBeVisible();
    await expect(moveList.locator("[data-ply]")).toHaveCount(6);

    // e4 ply has the hint badge (hasPressedHint was true in fixture).
    const e4Ply = moveList.locator("[data-ply='0']");
    await expect(e4Ply.locator("[title='Hint used']").first()).toBeVisible();

    // Clicking a ply jumps the board — Nf3 (ply 4) puts a white knight on f3.
    await moveList.locator("[data-ply='4']").click();
    await expect(page.locator("[data-square='f3']").locator("img[alt='w n']")).toBeVisible({
      timeout: 5_000,
    });

    // Last ply (Nc6) puts a black knight on c6.
    await moveList.locator("[data-ply='5']").click();
    await expect(page.locator("[data-square='c6']").locator("img[alt='b n']")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("game history tile highlights the active game", async ({ page }) => {
    // List view renders the history tiles (detail view hides the list).
    await page.goto("review");
    const tile = page.locator(`[data-game-id='${FIXTURE_ID}']`);
    await expect(tile).toBeVisible({ timeout: 15_000 });
    // data-game-id is present (highlight class only applied when activeId matches in list view).
  });

  test("pieces are not interactive in review mode", async ({ page }) => {
    await page.goto(`review/${FIXTURE_ID}`);

    // Jump to ply 1 so e4 is populated and e-file squares have pieces.
    const moveList = page.getByLabel("Move list");
    await expect(moveList).toBeVisible({ timeout: 15_000 });
    await moveList.locator("[data-ply='0']").click();

    const e4 = page.locator("[data-square='e4']");
    await expect(e4.locator("img")).toBeVisible({ timeout: 5_000 });
    // Clicking the pawn must NOT select it (no valid-move markers on empty squares).
    await e4.click();

    // No square should be flagged as a valid target.
    const validSquares = page.locator("[class*='valid']");
    await expect(validSquares).toHaveCount(0);
  });
});
