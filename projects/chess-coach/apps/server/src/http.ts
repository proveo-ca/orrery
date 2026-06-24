import { UciTimeoutError } from "./UciDriver.ts";

/** Headers applied to every response: cross-origin isolation + permissive CORS. */
export const BASE_HEADERS: Record<string, string> = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, PATCH, DELETE",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * StatusPages-equivalent error mapping (_spec/api/behavior.md §2):
 * timeout → 504, bad input → 400, everything else → 500.
 */
export function errorResponse(e: unknown): Response {
  const msg = e instanceof Error ? e.message : "Unexpected error";
  if (e instanceof UciTimeoutError || (e instanceof Error && e.name === "TimeoutError")) {
    return json({ error: "Harness request timed out" }, 504);
  }
  if (e instanceof SyntaxError) {
    return json({ error: msg || "Bad request" }, 400);
  }
  return json({ error: msg || "Internal error" }, 500);
}

/** Serializes all engine access — engines are single subprocesses (cf. Kotlin daemonMutex). */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

const REQUEST_TIMEOUT_MS = Number(process.env.HARNESS_REQUEST_TIMEOUT_MS ?? "60000") || 60_000;

/** Per-request timeout for unary ops → maps to 504 via errorResponse. */
export function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const e = new Error("Harness request timed out");
      e.name = "TimeoutError";
      reject(e);
    }, REQUEST_TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Stream an async generator as a chunked text/plain body, serialized through
 * the mutex. Drains the generator after a client abort instead of stopping it
 * (parity with the Ktor route's keep-collecting-after-disconnect behavior).
 */
export function streamResponse(mutex: Mutex, gen: AsyncGenerator<string, void, unknown>): Response {
  let aborted = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await mutex.run(async () => {
          for await (const chunk of gen) {
            if (aborted) continue; // keep draining, stop writing
            controller.enqueue(encoder.encode(chunk));
          }
        });
      } catch (e) {
        if (!aborted) controller.error(e as Error);
        return;
      }
      if (!aborted) controller.close();
    },
    cancel() {
      aborted = true;
    },
  });
  return new Response(stream, {
    headers: { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

const STATIC_DIR = process.env.STATIC_DIR ?? "static";

/** Serve the desktop UI build under /chess/ with SPA fallback to index.html. */
export async function serveStatic(pathname: string): Promise<Response | null> {
  if (pathname !== "/chess" && !pathname.startsWith("/chess/")) return null;

  const filePath = `${STATIC_DIR}${pathname}`;
  const file = Bun.file(filePath);
  if (pathname !== "/chess" && pathname !== "/chess/" && (await file.exists())) {
    return new Response(file, { headers: BASE_HEADERS });
  }

  const index = Bun.file(`${STATIC_DIR}/chess/index.html`);
  if (await index.exists()) {
    return new Response(index, { headers: { ...BASE_HEADERS, "Content-Type": "text/html; charset=utf-8" } });
  }
  return null;
}
