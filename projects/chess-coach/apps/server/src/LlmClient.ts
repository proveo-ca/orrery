/**
 * Commentary LLM transport. Mirrors the Kotlin LlmClient
 * (_spec/api/behavior.md §6): OpenAI-compatible POST {base}/chat/completions,
 * unary + SSE streaming, optional bearer auth.
 */
export interface LlmClient {
  readonly commentaryModel: string;
  prompt(
    systemPrompt: string,
    userPrompt: string,
    model?: string,
    temperature?: number,
    maxTokens?: number,
  ): Promise<string>;
  promptStream(
    systemPrompt: string,
    userPrompt: string,
    model?: string,
    temperature?: number,
    maxTokens?: number,
  ): AsyncGenerator<string, void, unknown>;
}

type ChatCompletion = { choices?: Array<{ message?: { content?: string } }> };
type ChatChunk = { choices?: Array<{ delta?: { content?: string } }> };

export class OllamaLlmClient implements LlmClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  readonly generalModel: string;
  readonly commentaryModel: string;

  constructor() {
    this.baseUrl =
      process.env.LLM_BASE_URL ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
    this.apiKey = process.env.LLM_API_KEY || undefined;
    this.generalModel = process.env.LLM_GENERAL_MODEL ?? process.env.LLM_MODEL ?? "qwen2.5:7b";
    this.commentaryModel = process.env.LLM_COMMENTARY_MODEL ?? this.generalModel;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["Authorization"] = `Bearer ${this.apiKey}`;
    return h;
  }

  async prompt(
    systemPrompt: string,
    userPrompt: string,
    model: string = this.commentaryModel,
    temperature = 0.7,
    maxTokens?: number,
  ): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
    const data = (await res.json()) as ChatCompletion;
    return data.choices?.[0]?.message?.content ?? "";
  }

  async *promptStream(
    systemPrompt: string,
    userPrompt: string,
    model: string = this.commentaryModel,
    temperature = 0.7,
    maxTokens?: number,
  ): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok || !res.body) throw new Error(`LLM stream failed: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (line.startsWith("data: ") && line !== "data: [DONE]") {
          try {
            const chunk = JSON.parse(line.slice(6)) as ChatChunk;
            const content = chunk.choices?.[0]?.delta?.content ?? "";
            if (content) yield content;
          } catch {
            // ignore partial/malformed chunk
          }
        }
      }
    }
  }
}
