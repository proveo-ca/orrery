// SPEC: _spec/chess-coach/ui/components.puml
import { CreateWebWorkerMLCEngine, type MLCEngineInterface, type AppConfig } from "@mlc-ai/web-llm";

import { ENGINE_CONFIG } from "~/engine/config";
import type { LlmClient } from "~/engine/LlmClient";

/**
 * WebLLM-backed LlmClient. Lives in its own module so `web-no-llm` builds
 * can dead-eliminate the import (and the heavy `@mlc-ai/web-llm` graph it
 * pulls in) via the `__HAS_LLM__` define in `vite.config.ts`.
 */
export class WebLlmClient implements LlmClient {
  private engine: MLCEngineInterface | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initEngine();
  }

  private async initEngine() {
    console.log(`[LlmClient] Initializing WebLLM with model: ${ENGINE_CONFIG.llm.modelId}`);

    // Use absolute path with origin to prevent URL construction errors
    // Weights are inside resolve/main/
    const modelPath = new URL(
      `/chess/models/${ENGINE_CONFIG.llm.modelId}/resolve/main/`,
      self.location.href,
    ).href;

    // WASM is at the root of the model folder
    const wasmPath = new URL(
      `/chess/models/${ENGINE_CONFIG.llm.modelId}/${ENGINE_CONFIG.llm.wasmUrl}`,
      self.location.href,
    ).href;

    console.log("[LlmClient] Resolved model path:", modelPath);
    console.log("[LlmClient] Resolved wasm path:", wasmPath);

    // Configure WebLLM to find our locally hosted model weights and the local WASM.
    // This model uses sliding-window attention, and WebLLM requires only one of
    // context_window_size or sliding_window_size to be positive.
    const appConfig: AppConfig = {
      model_list: [
        {
          model_id: ENGINE_CONFIG.llm.modelId,
          // Provide both new and old keys to support all WebLLM versions
          model: modelPath,
          model_url: modelPath,
          model_lib: wasmPath,
          model_lib_url: wasmPath,
          overrides: {
            context_window_size: -1,
            attention_sink_size: 0,
          },
        } as any,
      ],
    };

    console.log("[LlmClient] AppConfig model_id:", ENGINE_CONFIG.llm.modelId);

    // We use a WebWorker engine so the heavy WebGPU computation doesn't freeze the main thread
    this.engine = await CreateWebWorkerMLCEngine(
      new Worker(new URL("./llm.worker.ts", import.meta.url), { type: "module" }),
      ENGINE_CONFIG.llm.modelId,
      {
        appConfig,
        initProgressCallback: (progress) => {
          const pct = Math.round(progress.progress * 100);
          console.log(`[LlmClient] Loading model: ${pct}% - ${progress.text}`);
          postMessage({ type: "LLM_PROGRESS", progress: pct, text: progress.text });
        },
      },
    );
    console.log("[LlmClient] WebLLM initialization complete.");
  }

  async prompt(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = ENGINE_CONFIG.llm.defaultTemperature,
    maxTokens: number = ENGINE_CONFIG.llm.defaultMaxTokens,
  ): Promise<string> {
    await this.initPromise;
    if (!this.engine) throw new Error("LLM Engine not initialized");

    console.log(`[LlmClient] Prompting model: ${ENGINE_CONFIG.llm.modelId}`);

    const reply = await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    return reply.choices[0]?.message?.content || "";
  }

  async *promptStream(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = ENGINE_CONFIG.llm.defaultTemperature,
    maxTokens: number = ENGINE_CONFIG.llm.defaultMaxTokens,
  ): AsyncGenerator<string, void, unknown> {
    await this.initPromise;
    if (!this.engine) throw new Error("LLM Engine not initialized");

    console.log(`[LlmClient] Streaming prompt to model: ${ENGINE_CONFIG.llm.modelId}`);

    const chunks = await this.engine.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of chunks) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        yield content;
      }
    }
  }
}
