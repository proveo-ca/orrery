import { URL, fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import oxlintPlugin from "vite-plugin-oxlint";
import solid from "vite-plugin-solid";

export default defineConfig({
  base: "/chess/",
  build: {
    outDir: "dist/chess",
  },
  plugins: [
    solid(),
    oxlintPlugin(),
    {
      name: "isolate",
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
          res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
          next();
        });
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
