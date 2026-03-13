import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["public/**/*", ".vite"],
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
  },
});
