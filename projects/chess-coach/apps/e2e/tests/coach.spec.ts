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

  test("blunder detection: hovering Qxf7 flags the move as a blunder", async ({ page }) => {
    // Pre-load a position where 1.e4 e5 2.Qh5 Nc6 has been played.
    // White queen on h5, white to move. Qxf7+ is a classic blunder —
    // queen captures a pawn but the undefended queen is lost to Kxf7.
    //
    // (Qc3 from the starting position isn't reachable by the queen in one move
    // and c3→f7 isn't a queen line, so this uses the chess-sensible equivalent.)
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem(
        "chess_coach_game_state",
        JSON.stringify({
          pgn: "1. e4 e5 2. Qh5 Nc6",
          currentIndex: 4,
          startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        }),
      );
    });
    await page.reload();

    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
    await page.getByText("Play with Selena").click();
    await expect(page).toHaveURL(/\/selena/);

    // Confirm the pre-loaded position: white queen on h5, black knight on c6.
    const h5 = page.locator("[data-square='h5']");
    const c6 = page.locator("[data-square='c6']");
    await expect(h5.locator("img[alt='w q']")).toBeVisible({ timeout: 15_000 });
    await expect(c6.locator("img[alt='b n']")).toBeVisible();

    // Tap the queen — f7 becomes a legal (capture) destination.
    await h5.click();
    const f7 = page.locator("[data-square='f7']");
    await expect(f7).toHaveAttribute("class", /capture/, { timeout: 5_000 });

    // Hover f7 — after the 150ms debounce and Stockfish eval, the coach
    // should flag the move as a blunder (shocked emotion + "blunder" advice).
    await f7.hover();
    await expect(page.getByText(/blunder/i)).toBeVisible({ timeout: 15_000 });
  });

  test("live game persists each move to history AND warms the analysis cache", async ({
    page,
  }) => {
    // Confirms the two CoachScreen persistence paths during a real game:
    //   1. useGameRecorder → createPersistedStore writes the in-progress game
    //      (PGN + moves) to localStorage["chess_coach_game_history"] per move.
    //   2. useLivePreAnalysis → analyzeGameToCache writes per-ply review
    //      analysis to localStorage["chess_coach_analysis_<in-progress id>"]
    //      at background priority — so Review opens warm.
    await page.goto("/");
    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
    await page.getByText("Play with Selena").click();
    await expect(page).toHaveURL(/\/selena/);

    // Play e2 → e4 (a real human move; player is white).
    const e2 = page.locator("[data-square='e2']");
    await expect(e2.locator("img")).toBeVisible({ timeout: 15_000 });
    await e2.click();
    const e4 = page.locator("[data-square='e4']");
    await expect(e4).toHaveAttribute("class", /valid/, { timeout: 5_000 });
    await e4.click();
    await expect(e4.locator("img")).toBeVisible({ timeout: 5_000 });

    const readHistory = () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("chess_coach_game_history");
        return raw ? JSON.parse(raw) : null;
      });

    // 1. History persistence: the human move lands in the in-progress record.
    await expect
      .poll(async () => (await readHistory())?.inProgress?.moves?.map((m: any) => m.san) ?? [], {
        timeout: 10_000,
      })
      .toContain("e4");

    const inProgressId = (await readHistory())?.inProgress?.id as string;
    expect(inProgressId).toBeTruthy();

    // 2. Analysis persistence: the live pre-analysis must write a cache entry
    //    keyed by the in-progress id, with the player ply (e4, ply 0) analyzed.
    //    Background priority + real depth-20 search → allow generous time.
    await expect
      .poll(
        async () =>
          await page.evaluate((id) => {
            const raw = localStorage.getItem(`chess_coach_analysis_${id}`);
            if (!raw) return "missing";
            const cache = JSON.parse(raw);
            return cache.analyzed?.[0] === true ? "analyzed" : "pending";
          }, inProgressId),
        { timeout: 90_000, intervals: [1_000] },
      )
      .toBe("analyzed");
  });
});
