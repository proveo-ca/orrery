import { URL, fileURLToPath } from "node:url";

import solidPlugin from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
      "@chess-coach/engine-core": fileURLToPath(
        new URL("../../packages/engine-core/src/index.ts", import.meta.url),
      ),
    },
  },
  define: {
    __STOCKFISH_VARIANT__: JSON.stringify("stockfish-18-lite"),
    __HAS_LLM__: JSON.stringify(false),
  },
  test: {
    environment: "jsdom",
    globals: true,
    isolate: false,
  },
});
