import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import oxlintPlugin from "vite-plugin-oxlint";
import solid from "vite-plugin-solid";

const isWebTarget = process.env.VITE_TARGET === "web";

export default defineConfig({
  base: "/chess/",
  build: {
    outDir: "dist/chess",
  },
  plugins: [
    solid(),
    oxlintPlugin(),
    {
      name: "isolate-and-debug",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");

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
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
});
