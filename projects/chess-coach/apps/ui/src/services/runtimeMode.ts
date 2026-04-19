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
