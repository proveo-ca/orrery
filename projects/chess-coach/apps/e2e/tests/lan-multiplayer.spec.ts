import { type Browser, type Page, expect, test } from "@playwright/test";

/**
 * Serverless LAN multiplayer (WebRTC host-hub). These drive two independent
 * browser contexts and connect them peer-to-peer over loopback host ICE
 * candidates — no STUN/TURN, mirroring the Tailscale design.
 *
 * Runs on Chromium + WebKit (the full handshake, move relay, and color-swap all
 * work). Firefox is exercised for the lobby/invite path but skips the live
 * handshake: it assigns per-context mDNS (.local) ICE candidates that don't
 * resolve between two contexts over loopback, so the DataChannel can't open in
 * this single-machine test. Real cross-device play uses routable Tailscale
 * 100.x candidates (validated separately via the public/lan-spike.html check).
 */
const FIREFOX_LOOPBACK_SKIP =
  "Firefox per-context mDNS (.local) ICE candidates don't resolve between two " +
  "contexts over loopback, so the DataChannel can't open here. Real cross-device " +
  "play uses routable Tailscale 100.x candidates (see public/lan-spike.html).";

test.describe("LAN multiplayer (serverless WebRTC)", () => {
  // The Tailscale checklist gates the room setup (step 3). Its in-browser probe
  // only auto-detects the tailnet when the OS actually has Tailscale up AND the
  // browser exposes the 100.x host candidate — Safari/Firefox hide host
  // candidates behind mDNS *.local names, so the probe can't see it. The
  // always-available manual override clears the gate; click it when present (on
  // an auto-verified browser it never appears, so this is a no-op).
  async function dismissTailscaleChecklist(page: Page) {
    await page
      .getByRole("button", { name: "I'm connected — continue" })
      .click({ timeout: 8000 })
      .catch(() => {});
  }

  async function openLanViaMenu(page: Page, name: string) {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.getByRole("button", { name: "Play LAN" }).click();
    await expect(page).toHaveURL(/\/lan/);
    await dismissTailscaleChecklist(page);
    await page.getByPlaceholder("Your name").fill(name);
  }

  async function readLink(page: Page, testId: string): Promise<string> {
    const box = page.getByTestId(testId);
    await expect(box).toBeVisible({ timeout: 15_000 });
    await expect(box).toContainText("#", { timeout: 15_000 });
    return ((await box.textContent()) ?? "").trim();
  }

  /** Drive the full create → invite → answer → admit → connected handshake. */
  async function connect(host: Page, guest: Page) {
    await openLanViaMenu(host, "Alice");
    await host.getByRole("button", { name: "Create room", exact: true }).click();
    const invite = await readLink(host, "invite-link");

    await guest.goto(invite);
    await dismissTailscaleChecklist(guest);
    await guest.getByPlaceholder("Your name").fill("Bob");
    await guest.getByRole("button", { name: "Join game" }).click();
    const answer = await readLink(guest, "answer-link");

    await host.getByPlaceholder("Paste their reply here").fill(answer);
    await host.getByRole("button", { name: "Admit", exact: true }).click();

    // Both ends see two players once the DataChannel opens + hello arrives.
    await expect(host.getByText(/2\/2 players/)).toBeVisible({ timeout: 25_000 });
    await expect(guest.getByText(/2\/2 players/)).toBeVisible({ timeout: 25_000 });
  }

  /** connect → host White / guest Black → both Start → boards live. */
  async function startGame(host: Page, guest: Page) {
    await connect(host, guest);
    await host.getByRole("button", { name: "Take White" }).click();
    await guest.getByRole("button", { name: "Take Black" }).click();
    await host.getByRole("button", { name: "Start Game" }).click();
    await guest.getByRole("button", { name: "Start Game" }).click();
    await expect(host.locator("[data-square='e2']")).toBeVisible({ timeout: 15_000 });
    await expect(guest.locator("[data-square='e2']")).toBeVisible({ timeout: 15_000 });
  }

  /** Click-select the from-square, then the to-square (the board's move UI). */
  async function move(page: Page, from: string, to: string) {
    await page.locator(`[data-square='${from}']`).click();
    await page.locator(`[data-square='${to}']`).click();
  }

  /** Spin up two browser contexts, run a started game, then tear them down. */
  async function withStartedGame(
    browser: Browser,
    run: (host: Page, guest: Page) => Promise<void>,
  ) {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();
    try {
      await startGame(host, guest);
      await run(host, guest);
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  }

  // The sidebar "Draw" button (mobile-nav twin is display:none on desktop, so
  // it's out of the a11y tree and this stays a single match).
  const drawButton = (page: Page) => page.getByRole("button", { name: "Draw", exact: true });
  const offerBubble = (page: Page) => page.getByTestId("draw-offer-bubble");
  const rejectBubble = (page: Page) => page.getByTestId("draw-reject-bubble");

  test("host renders a lobby and produces an invite link", async ({ page }) => {
    await openLanViaMenu(page, "Alice");
    await page.getByRole("button", { name: "Create room", exact: true }).click();
    const invite = await readLink(page, "invite-link");
    expect(invite).toContain("/chess/lan#o=");
  });

  test("two browsers connect, pick colors, start, and relay moves", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName === "firefox", FIREFOX_LOOPBACK_SKIP);
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    try {
      await connect(host, guest);

      // Pick colors (none assigned by default).
      await host.getByRole("button", { name: "Take White" }).click();
      await guest.getByRole("button", { name: "Take Black" }).click();

      // Both press Start — the host gates on two distinct colors + both ready.
      await host.getByRole("button", { name: "Start Game" }).click();
      await guest.getByRole("button", { name: "Start Game" }).click();

      // Boards appear on both ends.
      await expect(host.locator("[data-square='e2']")).toBeVisible({ timeout: 15_000 });
      await expect(guest.locator("[data-square='e2']")).toBeVisible({ timeout: 15_000 });

      // White (host) plays e4 — it must relay to the guest.
      await host.locator("[data-square='e2']").click();
      await host.locator("[data-square='e4']").click();
      await expect(host.locator("[data-square='e4'] img[alt='w p']")).toBeVisible({ timeout: 10_000 });
      await expect(guest.locator("[data-square='e4'] img[alt='w p']")).toBeVisible({ timeout: 10_000 });

      // Black (guest) replies e5 — it must relay back to the host.
      await guest.locator("[data-square='e7']").click();
      await guest.locator("[data-square='e5']").click();
      await expect(guest.locator("[data-square='e5'] img[alt='b p']")).toBeVisible({ timeout: 10_000 });
      await expect(host.locator("[data-square='e5'] img[alt='b p']")).toBeVisible({ timeout: 10_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test("players can swap colors in the lobby", async ({ browser, browserName }) => {
    test.skip(browserName === "firefox", FIREFOX_LOOPBACK_SKIP);
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    try {
      await connect(host, guest);

      await host.getByRole("button", { name: "Take White" }).click();
      await guest.getByRole("button", { name: "Take Black" }).click();

      // Host starts on White…
      await expect(host.getByTestId("seat-w")).toContainText("Alice (you)");
      await expect(host.getByTestId("seat-b")).toContainText("Bob");

      // …then swaps. Both ends should reflect the exchange.
      await host.getByRole("button", { name: "Swap" }).click();
      await expect(host.getByTestId("seat-b")).toContainText("Alice (you)", { timeout: 15_000 });
      await expect(host.getByTestId("seat-w")).toContainText("Bob", { timeout: 15_000 });
      await expect(guest.getByTestId("seat-w")).toContainText("Bob (you)", { timeout: 15_000 });
      await expect(guest.getByTestId("seat-b")).toContainText("Alice", { timeout: 15_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  // ── Draw offers ───────────────────────────────────────────────────────────

  test("offering a draw floats a 🤝 bubble on both ends", async ({ browser, browserName }) => {
    test.skip(browserName === "firefox", FIREFOX_LOOPBACK_SKIP);
    await withStartedGame(browser, async (host, guest) => {
      await drawButton(host).click();
      // 🤝 on the offerer's king, relayed to the opponent. No ⚔️ yet.
      await expect(offerBubble(host)).toBeVisible({ timeout: 10_000 });
      await expect(offerBubble(guest)).toBeVisible({ timeout: 10_000 });
      await expect(rejectBubble(host)).toHaveCount(0);
      await expect(rejectBubble(guest)).toHaveCount(0);
    });
  });

  test("a pending offer persists across several moves", async ({ browser, browserName }) => {
    test.skip(browserName === "firefox", FIREFOX_LOOPBACK_SKIP);
    await withStartedGame(browser, async (host, guest) => {
      await drawButton(host).click();
      await expect(offerBubble(guest)).toBeVisible({ timeout: 10_000 });

      // Three plies pass; an unanswered offer must stay on the board.
      await move(host, "e2", "e4");
      await expect(guest.locator("[data-square='e4'] img[alt='w p']")).toBeVisible({ timeout: 10_000 });
      await move(guest, "e7", "e5");
      await expect(host.locator("[data-square='e5'] img[alt='b p']")).toBeVisible({ timeout: 10_000 });
      await move(host, "g1", "f3");
      await expect(guest.locator("[data-square='f3'] img[alt='w n']")).toBeVisible({ timeout: 10_000 });

      await expect(offerBubble(host)).toBeVisible();
      await expect(offerBubble(guest)).toBeVisible();
    });
  });

  test("accepting an offer ends the game as a draw", async ({ browser, browserName }) => {
    test.skip(browserName === "firefox", FIREFOX_LOOPBACK_SKIP);
    await withStartedGame(browser, async (host, guest) => {
      await drawButton(host).click();
      await expect(offerBubble(guest)).toBeVisible({ timeout: 10_000 });

      // Recipient opens the modal by tapping the 🤝 bubble, then accepts.
      await offerBubble(guest).click();
      await guest.getByRole("button", { name: "Yes" }).click();

      const draw = (page: Page) => page.getByRole("heading", { name: "Draw", exact: true });
      await expect(draw(host)).toBeVisible({ timeout: 10_000 });
      await expect(draw(guest)).toBeVisible({ timeout: 10_000 });

      // Agreed → 🤝 on BOTH kings (mutual handshake), on both ends.
      for (const page of [host, guest]) {
        await expect(offerBubble(page)).toBeVisible();
        await expect(page.getByTestId("draw-agree-bubble")).toBeVisible();
      }
    });
  });

  test("declining shows ⚔️, and the next move clears both bubbles", async ({
    browser,
    browserName,
  }) => {
    test.skip(browserName === "firefox", FIREFOX_LOOPBACK_SKIP);
    await withStartedGame(browser, async (host, guest) => {
      await drawButton(host).click();
      await expect(offerBubble(guest)).toBeVisible({ timeout: 10_000 });

      // Recipient declines via the sidebar button → ⚔️ on the refuser's king,
      // both bubbles now showing on both ends.
      await drawButton(guest).click();
      await guest.getByRole("button", { name: "No" }).click();
      await expect(rejectBubble(guest)).toBeVisible({ timeout: 10_000 });
      await expect(rejectBubble(host)).toBeVisible({ timeout: 10_000 });
      await expect(offerBubble(host)).toBeVisible();
      await expect(offerBubble(guest)).toBeVisible();

      // The next move clears both 🤝 and ⚔️ everywhere.
      await move(host, "e2", "e4");
      await expect(guest.locator("[data-square='e4'] img[alt='w p']")).toBeVisible({ timeout: 10_000 });
      await expect(offerBubble(host)).toHaveCount(0, { timeout: 10_000 });
      await expect(rejectBubble(host)).toHaveCount(0);
      await expect(offerBubble(guest)).toHaveCount(0, { timeout: 10_000 });
      await expect(rejectBubble(guest)).toHaveCount(0);
    });
  });

  test("the offering player can cancel their own offer", async ({ browser, browserName }) => {
    test.skip(browserName === "firefox", FIREFOX_LOOPBACK_SKIP);
    await withStartedGame(browser, async (host, guest) => {
      await drawButton(host).click();
      await expect(offerBubble(host)).toBeVisible({ timeout: 10_000 });
      await expect(offerBubble(guest)).toBeVisible({ timeout: 10_000 });

      // Re-opening as the offerer shows the waiting state with a Cancel action.
      await drawButton(host).click();
      const cancel = host.getByRole("button", { name: "Cancel offer" });
      await expect(cancel).toBeVisible();
      await cancel.click();

      await expect(offerBubble(host)).toHaveCount(0, { timeout: 10_000 });
      await expect(offerBubble(guest)).toHaveCount(0, { timeout: 10_000 });
    });
  });

  // ── Time control ────────────────────────────────────────────────────────

  test("default time control follows the last Selena difficulty", async ({ page }) => {
    const cases: [string, string][] = [
      ["intermediate", "600"], // 10 min
      ["advanced", "300"], //     5 min
      ["expert", "180"], //       3 min
    ];
    for (const [diff, sec] of cases) {
      await page.goto("/");
      await page.evaluate((d) => {
        localStorage.clear();
        localStorage.setItem("chess_coach_settings_state", JSON.stringify({ difficulty: d }));
      }, diff);
      await page.goto("lan");
      await dismissTailscaleChecklist(page);
      await expect(page.getByTestId("time-control")).toHaveValue(sec);
    }
  });

  test("the time control is shown when joining a room", async ({ browser }) => {
    // No live handshake needed — the joiner reads the time control straight from
    // the invite link, so this runs on every browser (incl. Firefox).
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();
    try {
      await openLanViaMenu(host, "Alice"); // cleared storage → intermediate → 10 min
      await host.getByRole("button", { name: "Create room", exact: true }).click();
      const invite = await readLink(host, "invite-link");

      await guest.goto(invite);
      await dismissTailscaleChecklist(guest);
      const banner = guest.getByTestId("join-time-control");
      await expect(banner).toContainText("Rapid Chess");
      await expect(banner).toContainText("10 min");
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });

  test("a player loses when their clock runs out", async ({ browser, browserName }) => {
    test.skip(browserName === "firefox", FIREFOX_LOOPBACK_SKIP);
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();
    try {
      // Host on a 3-second clock (deep-link override) so White flags quickly.
      await host.goto("/");
      await host.evaluate(() => localStorage.clear());
      await host.goto("lan?clock=3");
      await dismissTailscaleChecklist(host);
      await host.getByPlaceholder("Your name").fill("Alice");
      await host.getByRole("button", { name: "Create room", exact: true }).click();
      const invite = await readLink(host, "invite-link");

      await guest.goto(invite);
      await dismissTailscaleChecklist(guest);
      await guest.getByPlaceholder("Your name").fill("Bob");
      await guest.getByRole("button", { name: "Join game" }).click();
      const answer = await readLink(guest, "answer-link");
      await host.getByPlaceholder("Paste their reply here").fill(answer);
      await host.getByRole("button", { name: "Admit", exact: true }).click();
      await expect(host.getByText(/2\/2 players/)).toBeVisible({ timeout: 25_000 });

      await host.getByRole("button", { name: "Take White" }).click();
      await guest.getByRole("button", { name: "Take Black" }).click();
      await host.getByRole("button", { name: "Start Game" }).click();
      await guest.getByRole("button", { name: "Start Game" }).click();
      await expect(host.locator("[data-square='e2']")).toBeVisible({ timeout: 15_000 });

      // White (host) never moves; its 3s clock drains → Black wins on time.
      await expect(host.getByText("White ran out of time.")).toBeVisible({ timeout: 15_000 });
      await expect(guest.getByText("White ran out of time.")).toBeVisible({ timeout: 15_000 });
    } finally {
      await hostCtx.close();
      await guestCtx.close();
    }
  });
});
