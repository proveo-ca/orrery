import { type Page, expect, test } from "@playwright/test";

/**
 * Serverless LAN multiplayer (WebRTC host-hub). These drive two independent
 * browser contexts and connect them peer-to-peer over loopback host ICE
 * candidates — no STUN/TURN, mirroring the Tailscale design. Chromium only:
 * WebRTC datachannel + local-candidate behaviour is the most consistent there,
 * and the real cross-device Tailscale path is validated separately via the
 * public/lan-spike.html device check.
 */
test.describe("LAN multiplayer (serverless WebRTC)", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "WebRTC loopback e2e runs on Chromium only",
  );

  async function openLanViaMenu(page: Page, name: string) {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await page.getByRole("button", { name: "Play LAN" }).click();
    await expect(page).toHaveURL(/\/lan/);
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

  test("two browsers connect, pick colors, start, and relay moves", async ({ browser }) => {
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

  test("players can swap colors in the lobby", async ({ browser }) => {
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
