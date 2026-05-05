// SPEC: _spec/chess-coach/ui/components.puml
/**
 * Central resolution of the app's runtime mode.
 *
 * This is the ONLY place that reads VITE_TARGET / VITE_API_URL. Everything
 * downstream (services, orchestrator) branches on the returned discriminated
 * union instead of re-reading env vars.
 *
 * To re-enable web-llm in the future, either:
 *   - flip the fallback return to `{ kind: "web-full" }`, or
 *   - gate on a new flag such as VITE_ENABLE_WEB_LLM.
 */
export type RuntimeMode =
  | { kind: "desktop"; apiUrl: string }
  | { kind: "web-full" }
  | { kind: "web-no-llm" };

export function resolveMode(): RuntimeMode {
  const target = import.meta.env.VITE_TARGET;
  const apiUrl = import.meta.env.VITE_API_URL;

  // Desktop: no web target and a backend URL is configured.
  if (target !== "web-full" && target !== "web-no-llm" && apiUrl) {
    return { kind: "desktop", apiUrl };
  }

  if (target === "web-full") {
    return { kind: "web-full" };
  }

  return { kind: "web-no-llm" };
}

/**
 * Coarse mobile-device detection. We use this to ratchet down WASM workload
 * on phones/tablets where the per-renderer memory ceiling is much lower —
 * dual-Stockfish web builds reliably trip an `unreachable` trap there at
 * `go depth 12` (OOM / search-stack overflow inside Stockfish).
 *
 * `pointer: coarse` is the most reliable signal across Android Chrome,
 * iOS Safari, and PWA standalone display modes; UA sniffing is unreliable
 * post-Chrome 100. The window check guards against worker contexts.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/**
 * Depth cap for the main-thread Stockfish (hover-eval + base analysis).
 *
 *   - desktop runtime: orchestrator runs server-side, browser holds only
 *     one Stockfish → full depth 12.
 *   - web-* runtime on a desktop browser: two Stockfishes share the
 *     renderer, but plenty of memory → depth 10 keeps things safe.
 *   - web-* runtime on mobile: aggressive cap (depth 8) to stay well
 *     under the Android Chrome WASM memory ceiling.
 *
 * The orchestrator's own Stockfish (used for AI move planning) is not
 * affected by this — its depth is set inside `orchestrator.worker.ts`.
 */
export function getAnalysisDepth(): number {
  const mode = resolveMode();
  if (mode.kind === "desktop") return 12;
  return isMobileDevice() ? 8 : 10;
}
