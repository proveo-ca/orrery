import { IS_DESKTOP, LLM } from "./target";

// Desktop target only: the commentary path (apps/server → /advice, /explain) is
// driven by a locally-run, OpenAI-compatible LLM. Verify it's reachable and the
// model is pulled, then warm it — so a missing model fails fast here with
// actionable guidance instead of surfacing as opaque stream timeouts mid-suite,
// and the first real request doesn't pay the cold-load (which can exceed the
// server's 60s request timeout). No-op for the web targets.
export default async function globalSetup(): Promise<void> {
  if (!IS_DESKTOP) return;

  const { baseUrl, model, apiKey } = LLM;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const hint =
    `\n  Desktop e2e needs a local LLM at ${baseUrl} serving "${model}".\n` +
    `  Start one and pull the model, e.g.:\n` +
    `      ollama serve\n` +
    `      ollama pull ${model}\n` +
    `  Or point the suite elsewhere via LLM_BASE_URL / LLM_COMMENTARY_MODEL.\n`;

  // 1. Reachable.
  let models: Array<{ id?: string }>;
  try {
    const res = await fetch(`${baseUrl}/models`, { headers });
    if (!res.ok) throw new Error(`GET ${baseUrl}/models → ${res.status}`);
    models = ((await res.json()) as { data?: Array<{ id?: string }> }).data ?? [];
  } catch (e) {
    throw new Error(`Local LLM not reachable: ${(e as Error).message}\n${hint}`);
  }

  // 2. Model present. Only enforced when the runtime can enumerate models —
  //    some OpenAI-compatible servers return an empty list, so don't false-fail.
  const available = models.map((m) => m.id).filter(Boolean) as string[];
  if (available.length > 0 && !available.includes(model)) {
    throw new Error(
      `Local LLM is up but model "${model}" is not pulled (have: ${available.join(", ")}).\n${hint}`,
    );
  }
  if (available.length === 0) {
    console.warn(`[e2e] LLM at ${baseUrl} returned no model list; skipping presence check.`);
  }

  // 3. Warm into memory (best-effort; non-fatal — the model is confirmed present).
  try {
    await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0,
      }),
    });
    console.log(`[e2e] local LLM "${model}" reachable and warmed at ${baseUrl}`);
  } catch (e) {
    console.warn(`[e2e] LLM warmup failed (continuing): ${(e as Error).message}`);
  }
}
