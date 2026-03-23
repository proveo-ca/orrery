import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// --- ULTIMATE DEBUG INTERCEPTOR ---
const originalJson = Response.prototype.json;
Response.prototype.json = async function () {
  const text = await this.clone().text();
  if (text.trim().toLowerCase().startsWith("<!doctype")) {
    console.error(`🚨 FATAL: WebLLM tried to parse HTML as JSON from URL: ${this.url}`);
  }
  return originalJson.call(this);
};
// ----------------------------------

// A handler that resides in the worker thread
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent) => {
  handler.onmessage(msg);
};
