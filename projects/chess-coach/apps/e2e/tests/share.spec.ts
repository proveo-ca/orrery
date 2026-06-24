import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Share a recorded game by URL: a GameRecord is encoded into a URL hash
 * (`#g=…`, lz-string), and opening that link in a fresh browser decodes it,
 * imports it into localStorage, and lands on its Review page.
 *
 * The share URL is generated in-page via the app's own encoder
 * (`src/services/gameShare.ts`) so the test stays in lockstep with the wire
 * format instead of hard-coding a brittle payload string.
 */

const HISTORY_KEY = "chess_coach_game_history";
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// Served by the vite dev server; imported in-page so the test uses the app's
// real encoder. Kept as a variable so tsc treats `import(mod)` as dynamic
// (returns `any`) instead of trying to resolve the URL as a module.
const SHARE_MODULE = "/chess/src/services/gameShare.ts";

// A complete GameRecord (the `id` is intentionally bogus — it must be recomputed
// from the PGN on import, never trusted from the payload). The hint flag on Nf3
// (ply 2) and the player/opponent names exercise the lossless round-trip.
const SOURCE = {
  id: "should-be-ignored",
  startedAt: "2026-04-14T10:00:00.000Z",
  endedAt: "2026-04-14T10:05:00.000Z",
  result: "win",
  pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6",
  startingFen: STARTING_FEN,
  playerColor: "w",
  difficulty: "intermediate",
  moves: [
    { san: "e4", hasPressedHint: false, isAI: false },
    { san: "e5", hasPressedHint: false, isAI: true },
    { san: "Nf3", hasPressedHint: true, isAI: false },
    { san: "Nc6", hasPressedHint: false, isAI: true },
    { san: "Bb5", hasPressedHint: false, isAI: false },
    { san: "a6", hasPressedHint: false, isAI: true },
  ],
  playerName: "Juan",
  opponentName: "Selena",
  playerRace: "Human",
  opponentRace: "Cat",
} as const;

const emptyHistory = (page: Page) =>
  page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ games: [], inProgress: null })),
    HISTORY_KEY,
  );

const buildShareUrl = (page: Page) =>
  page.evaluate(
    async ({ record, mod }) => {
      const m = await import(mod);
      return m.buildShareUrl(record) as string;
    },
    { record: SOURCE, mod: SHARE_MODULE },
  );

const readHistory = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) || "{}"),
    HISTORY_KEY,
  );

test.describe("Share a game by link", () => {
  test("encode/decode round-trips losslessly and rejects junk payloads", async ({ page }) => {
    await page.goto("/");

    const r = await page.evaluate(
      async ({ record, mod }) => {
      const m = await import(mod);
      const url = m.buildShareUrl(record);
      const param = url.split("#g=")[1];
      const back = m.decodeGame(param);
      return {
        hasHashPath: url.includes("/chess/review#g="),
        urlSafe: /^[A-Za-z0-9+\-$]+$/.test(param),
        // id must be recomputed from the PGN, not echoed from the payload.
        idRecomputed: !!back && back.id !== record.id && back.id !== "0000000000000000",
        fieldsMatch:
          !!back &&
          back.pgn === record.pgn &&
          back.startingFen === record.startingFen &&
          back.playerColor === "w" &&
          back.result === "win" &&
          back.difficulty === "intermediate" &&
          back.playerName === "Juan" &&
          back.opponentName === "Selena" &&
          back.playerRace === "Human" &&
          back.opponentRace === "Cat" &&
          back.moves.length === 6 &&
          back.moves[2].san === "Nf3" &&
          back.moves[2].hasPressedHint === true &&
          back.moves[2].isAI === false,
        junkRejected: m.decodeGame("not-a-valid-payload-$$$") === null && m.decodeGame("") === null,
      };
      },
      { record: SOURCE, mod: SHARE_MODULE },
    );

    expect(r.hasHashPath).toBe(true);
    expect(r.urlSafe).toBe(true);
    expect(r.idRecomputed).toBe(true);
    expect(r.fieldsMatch).toBe(true);
    expect(r.junkRejected).toBe(true);
  });

  test("opening a share link imports the game and lands on its review", async ({ page }) => {
    await page.goto("/");
    await emptyHistory(page);

    const url = await buildShareUrl(page);
    await page.goto(url);

    // Redirects to the clean /review/:id (16-hex polyglot id, hash dropped).
    await expect(page).toHaveURL(/\/review\/[0-9a-f]{16}$/);

    // Header shows the sender's label and a Share control.
    await expect(page.getByText("Juan (White) vs Selena (Black)")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Share", exact: true })).toBeVisible();

    // Persisted into local history with the recomputed id and intact fields.
    const stored = await readHistory(page);
    expect(stored.games).toHaveLength(1);
    expect(stored.games[0].id).toMatch(/^[0-9a-f]{16}$/);
    expect(stored.games[0].playerName).toBe("Juan");
    expect(stored.games[0].moves[2].hasPressedHint).toBe(true);
    expect(stored.inProgress).toBeNull();

    // The hint badge survived the trip and renders on Nf3 (ply 2).
    const moveList = page.getByLabel("Move list");
    await expect(moveList).toBeVisible({ timeout: 15_000 });
    await expect(moveList.locator("[data-ply='2']").locator("[title='Hint used']").first()).toBeVisible();
  });

  test("an invalid share link shows an error and clears the hash", async ({ page }) => {
    await page.goto("/");
    await emptyHistory(page);

    await page.goto("review#g=this-is-not-a-valid-payload-$$$");

    await expect(page.getByText("This shared link is invalid or corrupted.")).toBeVisible({
      timeout: 15_000,
    });
    // Bad fragment is dropped so a reload won't retry it.
    await expect(page).toHaveURL(/\/review$/);
    const stored = await readHistory(page);
    expect(stored.games ?? []).toHaveLength(0);
  });

  test("re-opening the same link does not duplicate the game", async ({ page }) => {
    await page.goto("/");
    await emptyHistory(page);

    const url = await buildShareUrl(page);
    await page.goto(url);
    await expect(page).toHaveURL(/\/review\/[0-9a-f]{16}$/);
    await page.goto(url);
    await expect(page).toHaveURL(/\/review\/[0-9a-f]{16}$/);

    const stored = await readHistory(page);
    expect(stored.games).toHaveLength(1);
  });

  test("each history tile exposes a share control", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(
      ({ key, record }) => {
        localStorage.setItem(
          key,
          JSON.stringify({ games: [{ ...record, id: "tile-share-fixture" }], inProgress: null }),
        );
      },
      { key: HISTORY_KEY, record: SOURCE },
    );

    await page.goto("review");
    await expect(page.locator("[data-game-id='tile-share-fixture']")).toBeVisible({
      timeout: 15_000,
    });
    // The share button is a sibling of the tile link (not nested in the <a>).
    await expect(page.getByRole("button", { name: /share game/i }).first()).toBeVisible();
  });
});
