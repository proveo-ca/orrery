import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173/chess/",
    headless: true,
  },
  // Two servers run in parallel:
  //   :5173 — `vite dev` for the fast e2e specs (no SW).
  //   :8787 — `wrangler dev` against the production build, so the PWA spec
  //           can exercise the real service worker + offline cache pipeline.
  webServer: [
    {
      command: "npm run dev:web-no-llm:vite",
      cwd: "../ui",
      url: "http://localhost:5173/chess/",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run preview",
      cwd: "../ui",
      url: "http://localhost:8787/chess/",
      reuseExistingServer: true,
      // `preview` runs the full vite build before booting wrangler dev.
      timeout: 180_000,
    },
  ],
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
    { name: "firefox", use: { browserName: "firefox" } },
    {
      name: "brave",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--disable-features=BraveShieldsV2"],
        },
      },
    },
  ],
});
