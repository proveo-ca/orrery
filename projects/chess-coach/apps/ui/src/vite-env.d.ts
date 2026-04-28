/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Replaced at build time by the `define` in vite.config.ts.
// `true` only for `VITE_TARGET=web-full` builds; `false` everywhere else.
declare const __HAS_LLM__: boolean;

// Replaced at build time. Either "stockfish-18-lite-single" (web targets,
// single-threaded, no SAB) or "stockfish-18-lite" (desktop, threaded).
declare const __STOCKFISH_VARIANT__: string;
