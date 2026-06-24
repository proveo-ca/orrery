import {
  BASE_HEADERS,
  errorResponse,
  json,
  type Mutex,
  serveStatic,
  streamResponse,
  withTimeout,
} from "./http.ts";
import type { Orchestrator } from "./Orchestrator.ts";
import type { StateManager } from "./StateManager.ts";

type MoveRequest = { humanMoveSan: string; fenAfterHuman: string; difficulty?: string };
type AdviceRequest = { humanMove: string; aiMove: string; fen: string };
type ExplainRequest = { fenBefore: string; fenAfter: string; isBlunder?: boolean; moveSan?: string };

export type AppDeps = {
  orchestrator: Orchestrator;
  stateManager: StateManager;
  mutex: Mutex;
};

/**
 * Builds the Bun.serve fetch handler. Dependencies are injected so the routes
 * can be integration-tested with fake engines (no native stockfish/lc0).
 * Implements the CoachService contract (_spec/api/behavior.md §2).
 */
export function createFetchHandler(deps: AppDeps): (req: Request) => Promise<Response> {
  const { orchestrator, stateManager, mutex } = deps;

  return async (req: Request): Promise<Response> => {
    const { pathname } = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: BASE_HEADERS });

    try {
      if (req.method === "GET" && pathname === "/") {
        return Response.redirect(new URL("/chess", req.url).toString(), 302);
      }

      if (req.method === "GET" && pathname === "/hello") {
        const phrases = await withTimeout(mutex.run(() => orchestrator.generateUiPhrases()));
        return json({
          model: process.env.LLM_MODEL ?? "",
          greeting: "Hey! I'm Selena. Let's play chess.",
          thinking: phrases.thinking,
          bestMove: phrases.bestMove,
        });
      }

      if (req.method === "POST" && pathname === "/move") {
        const body = (await req.json()) as MoveRequest;
        const result = await withTimeout(
          mutex.run(async () => {
            if (body.fenAfterHuman) stateManager.writeFen(body.fenAfterHuman);
            return orchestrator.executeTurn(body.humanMoveSan, body.difficulty ?? "intermediate");
          }),
        );
        return json({ fen: result.fen, move: result.move });
      }

      if (req.method === "POST" && pathname === "/advice") {
        const body = (await req.json()) as AdviceRequest;
        return streamResponse(
          mutex,
          orchestrator.generateAdviceStream(body.humanMove, body.aiMove, body.fen),
        );
      }

      if (req.method === "POST" && pathname === "/explain") {
        const body = (await req.json()) as ExplainRequest;
        return streamResponse(
          mutex,
          orchestrator.generateExplanationStream(
            body.fenBefore,
            body.fenAfter,
            body.isBlunder ?? true,
            body.moveSan ?? "",
          ),
        );
      }

      if (req.method === "POST" && pathname === "/new") {
        stateManager.resetGame();
        return json({ fen: stateManager.readFen() });
      }

      if (req.method === "GET") {
        const stat = await serveStatic(pathname);
        if (stat) return stat;
      }

      return json({ error: "Not found" }, 404);
    } catch (e) {
      return errorResponse(e);
    }
  };
}
