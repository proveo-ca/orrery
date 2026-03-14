import { CreateWebWorkerMLCEngine, type MLCEngineInterface } from "@mlc-ai/web-llm";

export class LlmClient {
  private engine: MLCEngineInterface | null = null;
  private initPromise: Promise<void> | null = null;

  // We use a smaller, fast model suitable for browser inference
  private modelId = "gemma-2-2b-it-q4f32_1-MLC";

  constructor() {
    this.initPromise = this.initEngine();
  }

  private async initEngine() {
    console.log(`[LlmClient] Initializing WebLLM with model: ${this.modelId}`);

    // We use a WebWorker engine so the heavy WebGPU computation doesn't freeze the main thread
    this.engine = await CreateWebWorkerMLCEngine(
      new Worker(new URL("~/engine/llm.worker.ts", import.meta.url), { type: "module" }),
      this.modelId,
      {
        initProgressCallback: (progress) => {
          const pct = Math.round(progress.progress * 100);
          console.log(`[LlmClient] Loading model: ${pct}%`);
          postMessage({ type: "LLM_PROGRESS", progress: pct, text: progress.text });
        },
      },
    );
    console.log("[LlmClient] WebLLM initialization complete.");
  }

  async prompt(
    systemPrompt: string,
    userPrompt: string,
    temperature: number = 0.7,
    maxTokens: number = 150,
  ): Promise<string> {
    await this.initPromise;
    if (!this.engine) throw new Error("LLM Engine not initialized");

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
    temperature: number = 0.7,
    maxTokens: number = 150,
  ): AsyncGenerator<string, void, unknown> {
    await this.initPromise;
    if (!this.engine) throw new Error("LLM Engine not initialized");

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
