import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173/chess/",
    headless: true,
  },
  webServer: {
    command: "VITE_TARGET=web npm run dev:web",
    cwd: "../ui",
    url: "http://localhost:5173/chess/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
