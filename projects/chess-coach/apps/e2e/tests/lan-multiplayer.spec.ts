import { type Page, expect, test } from "@playwright/test";

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
});
