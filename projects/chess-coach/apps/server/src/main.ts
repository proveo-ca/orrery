import { createFetchHandler } from "./app.ts";
import { EngineBridge } from "./EngineBridge.ts";
import { Mutex } from "./http.ts";
import { OllamaLlmClient } from "./LlmClient.ts";
import { Orchestrator } from "./Orchestrator.ts";
import { StateManager } from "./StateManager.ts";

const HOST = process.env.HOST?.trim() || "0.0.0.0";
const PORT = Number(process.env.PORT) || 8080;

const stateManager = new StateManager();
const engineBridge = new EngineBridge();
const llmClient = new OllamaLlmClient();
const orchestrator = new Orchestrator(stateManager, engineBridge, llmClient);
const mutex = new Mutex();

await engineBridge.start();

Bun.serve({
  hostname: HOST,
  port: PORT,
  idleTimeout: 255, // long-lived LLM streams
  fetch: createFetchHandler({ orchestrator, stateManager, mutex }),
});

const publicHost = process.env.PUBLIC_HOST?.trim() || (HOST === "0.0.0.0" ? "localhost" : HOST);
const publicPort = Number(process.env.PUBLIC_PORT) || PORT;
console.error(`Frontend available at http://${publicHost}:${publicPort}/chess`);
