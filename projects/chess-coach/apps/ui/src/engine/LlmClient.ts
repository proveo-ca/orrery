// SPEC: _spec/chess-coach/ui/components.puml
/**
 * Abstraction over the LLM used to produce coaching commentary.
 *
 * Implementations:
 *   - WebLlmClient (~/engine/WebLlmClient): runs @mlc-ai/web-llm in a
 *     WebWorker. Loaded lazily and only when `__HAS_LLM__` is true so
 *     `web-no-llm` builds don't bundle the @mlc-ai/web-llm graph.
 *   - NoopLlmClient: yields nothing. Combined with the capabilities-layer
 *     gate (`commentary: false`), the orchestrator's LLM paths are never
 *     reached in `web-no-llm` so this is effectively unused there too —
 *     but it keeps the worker module type-correct without a static import
 *     of WebLlmClient.
 */
export interface LlmClient {
  prompt(
    systemPrompt: string,
    userPrompt: string,
    temperature?: number,
    maxTokens?: number,
  ): Promise<string>;

  promptStream(
    systemPrompt: string,
    userPrompt: string,
    temperature?: number,
    maxTokens?: number,
  ): AsyncGenerator<string, void, unknown>;
}

export class NoopLlmClient implements LlmClient {
  async prompt(): Promise<string> {
    return "";
  }

  // eslint-disable-next-line require-yield
  async *promptStream(): AsyncGenerator<string, void, unknown> {
    return;
  }
}
