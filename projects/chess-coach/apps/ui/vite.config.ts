import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import oxlintPlugin from "vite-plugin-oxlint";
import { VitePWA } from "vite-plugin-pwa";
import solid from "vite-plugin-solid";

const target = process.env.VITE_TARGET;
const isWebTarget = target === "web-full" || target === "web-no-llm";
const hasLlm = target === "web-full";

// Web targets run two Stockfish workers in the browser (main-thread for
// hint/blunder + orchestrator-thread for AI move planning) and compete for
// the same per-origin SharedArrayBuffer budget. The single-threaded build
// avoids that contention. Desktop mode runs the orchestrator server-side,
// so the browser only has one Stockfish and the threaded build is fine.
const stockfishVariant = isWebTarget ? "stockfish-18-lite-single" : "stockfish-18-lite";
const stockfishOther = isWebTarget ? "stockfish-18-lite" : "stockfish-18-lite-single";

export default defineConfig({
  base: "/chess/",
  build: {
    outDir: "dist/chess",
  },
  // Statically replaced at build time. The orchestrator worker uses this to
  // gate the dynamic import of WebLlmClient — `web-no-llm` and `desktop`
  // builds get the dead-branch eliminated and never bundle @mlc-ai/web-llm.
  define: {
    __HAS_LLM__: JSON.stringify(hasLlm),
    __STOCKFISH_VARIANT__: JSON.stringify(stockfishVariant),
  },
  // ES-module workers so top-level await + dynamic imports work inside
  // `?worker` files (used by `orchestrator.worker.ts` to lazy-load WebLLM).
  worker: {
    format: "es",
  },
  plugins: [
    solid(),
    oxlintPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Default globPatterns misses the `pieces/` SVGs. Spell out the full
        // set explicitly so every piece-set asset (~42 KB total across 4
        // sets × 12 pieces) lands in the precache and the board renders
        // offline from the very first PWA install.
        globPatterns: ["**/*.{js,css,html,ico,svg,png,webp,woff,woff2,webmanifest,wasm}"],
        // The chosen Stockfish build (~7 MB wasm) is precached so the app
        // works fully offline. That's the only non-engine asset above the
        // workbox default 2 MiB cap.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globIgnores: [
          // Heavy chess-engine binaries — runtime-cached on first use instead
          // of bloating the SW install download.
          "**/models/**",
          "**/web-engine/**",
          "**/*.worker-*.js",
          // The WebLLM chunk is ~6 MB and only loaded in `web-full` builds.
          // Skip precache; the orchestrator imports it lazily on first use.
          "**/WebLlmClient-*.js",
          // Exclude the Stockfish variant we DON'T ship for this target.
          `${stockfishOther}.js`,
          `${stockfishOther}.wasm`,
        ],
        // Don't run the SPA navigate-fallback for engine/binary URLs.
        navigateFallbackDenylist: [/\/(web-engine|models)\//, /stockfish-18-lite/, /\.wasm$/],
        runtimeCaching: [
          {
            urlPattern: /\/(web-engine|models)\//,
            handler: "CacheFirst",
            options: {
              cacheName: "engine-model-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\.worker-[^/]+\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "worker-cache",
              expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: "Selena Chess Coach",
        short_name: "Chess Coach",
        description: "AI-powered chess coach",
        start_url: "/chess/",
        scope: "/chess/",
        display: "standalone",
        background_color: "#1a1a2e",
        theme_color: "#1a1a2e",
        icons: [
          { src: "/chess/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/chess/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
    {
      name: "isolate-and-debug",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

          // Prevent Vite from adding content-encoding: gzip to .pb.gz weight files.
          // These are gzip DATA (not transfer-encoding); the browser would silently
          // decompress them, breaking lc0's internal gzip reader.
          if (req.url?.match(/\/web-engine\/.*\.gz$/)) {
            const origSetHeader = res.setHeader.bind(res);
            res.setHeader = (name: string, value: any) => {
              if (name.toLowerCase() === "content-encoding") return res;
              return origSetHeader(name, value);
            };
            res.removeHeader("Content-Encoding");
          }

          // Redirect old WebLLM cache requests to the new MLC format
          if (req.url?.includes("ndarray-cache.json")) {
            req.url = req.url.replace("ndarray-cache.json", "tensor-cache.json");
          }

          next();
        });
      },
    },
    {
      name: "strip-web-engine",
      closeBundle() {
        if (!isWebTarget) {
          const webEnginesDir = path.resolve(__dirname, "dist/chess/web-engine");
          if (fs.existsSync(webEnginesDir)) {
            fs.rmSync(webEnginesDir, { recursive: true, force: true });
            console.log("🗑️  Removed web-engines directory for Docker build.");
          }
        }
      },
    },
    {
      name: "strip-unused-stockfish",
      closeBundle() {
        const distDir = path.resolve(__dirname, "dist/chess");
        for (const ext of ["js", "wasm"]) {
          const fullPath = path.join(distDir, `${stockfishOther}.${ext}`);
          if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath);
            console.log(`🗑️  Removed unused ${stockfishOther}.${ext}`);
          }
        }
      },
    },
  ],
  resolve: {
    dedupe: ["chess.js"],
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "@chess-coach/engine-core": fileURLToPath(
        new URL("../../packages/engine-core/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
