import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["public/**/*", ".vite", "lint/**"],
  // Local architecture plugin (alpha JS-plugin API). See lint/architecture.ts.
  jsPlugins: ["./lint/architecture.ts"],
  rules: {
    "sort-imports": "off",
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["../*", "./*"],
            message:
              "Use absolute alias paths (~/...) instead of relative paths to prevent Vite module duplication and reactivity loss.",
          },
        ],
      },
    ],
    // Component architecture rules (see lint/architecture.ts):
    // 1+2: primitives must be presentational; side-effecting → atoms/ or features/.
    "proveo-ui/pure-primitive": "error",
    // 3: <Route> targets in src/index.tsx must live in screens/.
    "proveo-ui/route-target-in-screens": "error",
    // 4+5: a component may only import its own same-named *.module.css.
    "proveo-ui/own-css-module": "error",
    // Types shared across folders (or any component type) must live in ~/types/.
    "proveo-ui/no-cross-module-types": "error",
    // All Stockfish work must route through the enginePool singleton.
    "proveo-ui/engine-pool-only": "error",
    // Only screens may mutate the capabilities Policy Object.
    "proveo-ui/capabilities-set-in-screens-only": "error",
  },
});
