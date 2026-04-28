import { Chess } from "chess.js";
import { type Page, expect, test } from "@playwright/test";

// Hits the PWA preview server (npm run preview → wrangler dev :8787) so
// the real service worker, precache and Cloudflare-worker COOP/COEP headers
// are in the loop. Runs across all configured browser projects — the WebKit
// project is what gives us the Safari assertion.
test.use({ baseURL: "http://localhost:8787/chess/" });

test.describe("PWA · offline play", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      localStorage.clear();
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      if (regs) await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    });
  });

  test("warm cache online, go offline, play + hint + play again", async ({ page, context }) => {
    // ── 1. ONLINE: load and wait for the SW to take control. ──
    await page.goto("/");
    // First visit installs the SW; reload so the SW is *controlling* the page
    // and subsequent fetches actually go through it.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(
      () => navigator.serviceWorker?.controller != null,
      undefined,
      { timeout: 30_000 },
    );
    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });

    // Navigate to coach and play e2 → e4 so Stockfish + Maia are exercised
    // (their wasm/weight fetches go through the SW and land in the cache).
    await page.getByText("Play with Selena").click();
    await expect(page).toHaveURL(/\/selena/);
    await playMove(page, "e2", "e4");
    await waitForSelenaResponse(page, 1);

    // Capture Selena's first reply SAN so we can replay state into chess.js.
    const blackFirstSan = await readSan(page, 1);

    // ── 2. GO OFFLINE + reload. The SW must serve everything from cache. ──
    await context.setOffline(true);
    // `page.reload()` errors out in Webkit when offline (Playwright issue);
    // navigating fresh to the same URL exercises the same code path and
    // avoids the internal-error.
    await page.goto("/");
    await expect(page.getByText("Play with Selena")).toBeVisible({ timeout: 15_000 });
    await page.getByText("Play with Selena").click();
    await expect(page).toHaveURL(/\/selena/);

    // The board should rehydrate the saved game state (1.e4 + Selena's reply).
    await expect(page.locator("[data-square='e4']").locator("img[alt='w p']")).toBeVisible({
      timeout: 15_000,
    });

    // ── 3. Play e5-equivalent: pick the best legal pawn push for white. ──
    // After 1.e4 + Selena's reply, white's d-pawn push (d2-d4) is almost
    // always legal regardless of what Selena chose. We use that as our
    // "play another move offline" assertion that AI moves still work.
    const fenAfterBlackFirst = new Chess();
    fenAfterBlackFirst.move("e4");
    fenAfterBlackFirst.move(blackFirstSan); // throws if SAN invalid
    const whiteSecond = fenAfterBlackFirst.moves().includes("d4") ? "d4" : "Nf3";
    const whiteSecondMove = fenAfterBlackFirst.move(whiteSecond);
    await playMove(page, whiteSecondMove.from, whiteSecondMove.to);
    await waitForSelenaResponse(page, 3);

    // ── 4. Click hint, read the suggested SAN, play it. ──
    const blackSecondSan = await readSan(page, 3);
    fenAfterBlackFirst.move(blackSecondSan);
    const positionForHint = fenAfterBlackFirst.fen();

    await page.getByRole("button", { name: "Get a hint" }).first().click();

    const adviceLine = page.getByText(/Try moving \S+\./);
    await expect(adviceLine).toBeVisible({ timeout: 30_000 });
    const adviceText = await adviceLine.textContent();
    const hintSan = adviceText?.match(/Try moving (\S+?)\./)?.[1];
    expect(hintSan, "hint advice should contain a SAN").toBeTruthy();

    const hintGame = new Chess(positionForHint);
    const hintMove = hintGame.move(hintSan!);
    expect(hintMove, `hinted SAN '${hintSan}' should be legal`).not.toBeNull();
    await playMove(page, hintMove.from, hintMove.to);

    // ── 5. Selena responds to the hinted move, fully offline. ──
    await waitForSelenaResponse(page, 5);
  });
});

/** Click `from`, then click `to`. Asserts the destination ends up populated. */
async function playMove(page: Page, from: string, to: string): Promise<void> {
  const fromSq = page.locator(`[data-square='${from}']`);
  const toSq = page.locator(`[data-square='${to}']`);
  await fromSq.click();
  await expect(toSq).toHaveAttribute("class", /(valid|capture)/, { timeout: 5_000 });
  await toSq.click();
  await expect(toSq.locator("img")).toBeVisible({ timeout: 5_000 });
}

const GAME_STATE_KEY = "chess_coach_game_state";

/** Tokens of `pgn` with move-number markers ("1.", "2..") stripped out. */
function pgnPlies(pgn: string): string[] {
  return pgn
    .trim()
    .split(/\s+/)
    .filter((tok) => tok && !/^\d+\.+$/.test(tok));
}

/**
 * CoachScreen has no MoveList in the DOM, so we read the persisted game state
 * (the same key seeded by other specs) instead of querying rendered ply cells.
 */
async function waitForSelenaResponse(page: Page, ply: number): Promise<void> {
  // ply is 0-indexed; ply=1 means at least 2 plies recorded in the PGN.
  await page.waitForFunction(
    ([key, target]) => {
      const raw = localStorage.getItem(key as string);
      if (!raw) return false;
      try {
        const { pgn } = JSON.parse(raw) as { pgn?: string };
        if (!pgn) return false;
        const plies = pgn
          .trim()
          .split(/\s+/)
          .filter((t) => t && !/^\d+\.+$/.test(t));
        return plies.length >= (target as number) + 1;
      } catch {
        return false;
      }
    },
    [GAME_STATE_KEY, ply],
    { timeout: 30_000 },
  );
}

async function readSan(page: Page, ply: number): Promise<string> {
  const pgn = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).pgn as string | undefined) : undefined;
  }, GAME_STATE_KEY);
  if (!pgn) throw new Error(`no persisted game state at '${GAME_STATE_KEY}'`);
  const san = pgnPlies(pgn)[ply];
  if (!san) throw new Error(`PGN '${pgn}' has no ply ${ply}`);
  return san;
}
