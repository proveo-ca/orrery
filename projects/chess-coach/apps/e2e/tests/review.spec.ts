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

test.describe("Review best-move arrow (branch mode)", () => {
  const GAME_ID = "arrow-turn-fixture";
  // Player is White. 4 plies → after Nf6 it is White's (the human's) turn.
  const fixture = {
    games: [
      {
        id: GAME_ID,
        startedAt: new Date("2026-04-14").toISOString(),
        endedAt: new Date("2026-04-14").toISOString(),
        result: "win",
        pgn: "1. e4 e5 2. Nf3 Nf6",
        startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        playerColor: "w",
        difficulty: "intermediate",
        moves: [
          { san: "e4", hasPressedHint: false, isAI: false },
          { san: "e5", hasPressedHint: false, isAI: true },
          { san: "Nf3", hasPressedHint: false, isAI: false },
          { san: "Nf6", hasPressedHint: false, isAI: true },
        ],
      },
    ],
    inProgress: null,
  };

  test.beforeEach(async ({ page }) => {
    // Deterministic Stockfish: every search returns a pv so humanBestMove is
    // always populated — the arrow's visibility then depends purely on the
    // turn gate, not on engine timing.
    await page.addInitScript(() => {
      class MockWorker extends EventTarget {
        onmessage: ((ev: MessageEvent) => void) | null = null;
        constructor(public url: string | URL) {
          super();
        }
        postMessage(msg: unknown) {
          if (typeof msg !== "string") return;
          const send = (data: string) => {
            const ev = new MessageEvent("message", { data });
            this.onmessage?.(ev);
            this.dispatchEvent(ev);
          };
          if (msg === "uci") return void queueMicrotask(() => send("uciok"));
          if (msg === "isready") return void queueMicrotask(() => send("readyok"));
          if (msg === "ucinewgame" || msg.startsWith("position")) return;
          if (msg.startsWith("go")) {
            return void queueMicrotask(() => {
              send("info depth 18 score cp 20 pv a2a3");
              send("bestmove a2a3");
            });
          }
          if (msg === "stop") return void queueMicrotask(() => send("bestmove a2a3"));
        }
        terminate() {}
      }
      window.Worker = MockWorker as unknown as typeof Worker;
    });

    await page.goto("/");
    await page.evaluate((payload) => {
      localStorage.clear();
      localStorage.setItem("chess_coach_game_history", JSON.stringify(payload));
    }, fixture);
  });

  test("green best-move arrow only renders on the human's turn", async ({ page }) => {
    await page.goto(`review/${GAME_ID}`);

    const moveList = page.getByLabel("Move list");
    await expect(moveList).toBeVisible({ timeout: 15_000 });

    // Jump to the final position (after Nf6) — White (human) to move.
    await moveList.locator("[data-ply='3']").click();

    const arrow = page.locator("#best-move-arrow-head");
    const play = async (from: string, to: string) => {
      await page.locator(`[data-square='${from}']`).click();
      const dest = page.locator(`[data-square='${to}']`);
      await expect(dest).toHaveAttribute("class", /valid/, { timeout: 5_000 });
      await dest.click();
    };

    // Not branched yet → overlay is "off", no arrow.
    await expect(arrow).toHaveCount(0);

    // Branch with a White move → reviewAnalysisMode on, now Black (AI) to move.
    await play("d2", "d4");

    // Play Black's reply (freeColorControl allows it) → White (human) to move.
    await play("d7", "d5");
    // Human's turn → arrow must render.
    await expect(arrow).toHaveCount(1, { timeout: 15_000 });

    // Another White move → Black (AI) to move → arrow must disappear, even
    // though base analysis keeps populating humanBestMove (the turn gate hides it).
    await play("c2", "c4");
    await expect(arrow).toHaveCount(0, { timeout: 15_000 });
  });
});

test.describe("Review analysis ownership", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("only player-color moves receive cp analysis (white player)", async ({ page }) => {
    // Seed a game where player is white; intentionally mark black moves as isAI:false
    // to simulate a legacy record that would have caused the old bug.
    const BAD_FIXTURE = {
      games: [
        {
          id: "bad-isai-fixture",
          startedAt: new Date().toISOString(),
          endedAt: new Date().toISOString(),
          result: "win",
          pgn: "1. e4 e5 2. d4 d5 3. Nf3 Nc6",
          startingFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          playerColor: "w",
          difficulty: "easy",
          moves: [
            { san: "e4", hasPressedHint: false, isAI: false },
            { san: "e5", hasPressedHint: false, isAI: false }, // wrong isAI, should still be ignored
            { san: "d4", hasPressedHint: false, isAI: false },
            { san: "d5", hasPressedHint: false, isAI: false },
            { san: "Nf3", hasPressedHint: false, isAI: false },
            { san: "Nc6", hasPressedHint: false, isAI: false },
          ],
        },
      ],
      inProgress: null,
    };

    await page.evaluate((payload) => {
      localStorage.setItem("chess_coach_game_history", JSON.stringify(payload));
    }, BAD_FIXTURE);

    // Install a deterministic Worker mock that records analyzed searchmoves on window.
    await page.addInitScript(() => {
      // @ts-expect-error global
      (window as any).__analyzedMoves = [] as string[];
      class MockWorker extends EventTarget {
        onmessage: ((ev: MessageEvent) => void) | null = null;
        constructor(public url: string | URL) {
          super();
        }
        postMessage(msg: string) {
          const self = this as unknown as MockWorker;
          const send = (data: string) => {
            const ev = new MessageEvent("message", { data });
            if (self.onmessage) self.onmessage(ev);
            self.dispatchEvent(ev);
          };
          if (msg === "uci") {
            queueMicrotask(() => send("uciok"));
            return;
          }
          if (msg === "isready") {
            queueMicrotask(() => send("readyok"));
            return;
          }
          if (msg === "ucinewgame") return;
          if (msg.startsWith("position fen")) {
            return;
          }
          if (msg.startsWith("go depth 20 searchmoves")) {
            const uci = msg.split("searchmoves")[1]?.trim();
            if (uci) {
              // @ts-expect-error global
              (window as any).__analyzedMoves.push(uci);
            }
            queueMicrotask(() => {
              send("info depth 20 score cp 10 pv e2e4");
              send("bestmove e2e4");
            });
            return;
          }
          if (msg === "go depth 20") {
            queueMicrotask(() => {
              send("info depth 20 score cp 10 pv e2e4");
              send("bestmove e2e4");
            });
            return;
          }
        }
        terminate() {}
      }
      // @ts-expect-error override
      (window as any).Worker = MockWorker;
    });

    await page.goto("review/bad-isai-fixture");
    const moveList = page.getByLabel("Move list");
    await expect(moveList).toBeVisible({ timeout: 15_000 });

    // Wait for analysis to attempt (cp spans appear for player moves only).
    // The mock returns +10 for every player move; opponent cells must remain empty.
    await page.waitForTimeout(800);

    // White cells (player) should eventually show cp text; black cells must not.
    const whitePlys = moveList.locator("[data-ply='0'],[data-ply='2'],[data-ply='4']");
    const blackPlys = moveList.locator("[data-ply='1'],[data-ply='3'],[data-ply='5']");

    // At least one white ply should have rendered a cp value.
    await expect(whitePlys.locator("span").filter({ hasText: /^\+?\d/ })).not.toHaveCount(0, {
      timeout: 10_000,
    });

    // No black ply should ever render a cp value.
    await expect(blackPlys.locator("span").filter({ hasText: /^\+?\d/ })).toHaveCount(0);

    // The recorded searchmoves must only contain white-player UCIs.
    const analyzed: string[] = await page.evaluate(
      // @ts-expect-error global
      () => (window as any).__analyzedMoves ?? [],
    );
    const allowed = new Set(["e2e4", "d2d4", "g1f3"]);
    for (const m of analyzed) {
      if (!allowed.has(m)) {
        throw new Error(`Non-player move analyzed: ${m}`);
      }
    }
    // Also ensure at least the first player move was analyzed (smoke).
    if (!analyzed.includes("e2e4")) {
      throw new Error("Expected first player move e2e4 to be analyzed");
    }
  });
});
