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

  // Desktop: not running as 'web' and a backend URL is configured.
  if (target !== "web" && apiUrl) {
    return { kind: "desktop", apiUrl };
  }

  // Web: web-llm commentary is currently disabled (temporary kill-switch).
  // Flip to `{ kind: "web-full" }` to re-enable once quality improves.
  return { kind: "web-no-llm" };
}
