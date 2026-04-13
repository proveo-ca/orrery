import type { AdviceRequest, ExplainRequest } from "~/services/api";

type StreamFn<TReq> = (
  req: TReq,
  onChunk: (chunk: string) => void,
  opts?: { signal?: AbortSignal },
) => Promise<void>;

export interface AccumulateOptions {
  signal?: AbortSignal;
  /** Prepended to every onUpdate call — e.g. `"Try moving e4. "`. */
  prefix?: string;
}

/**
 * Runs an LLM stream, accumulates chunks, and calls onUpdate with the full
 * in-progress text (with optional prefix).
 *
 * On the first chunk the accumulator is reset once, so any caller-set
 * placeholder text is cleared on the first real token without the call site
 * having to manage that state itself.
 *
 * Returns the final un-prefixed accumulated string, for callers that need
 * to inspect the full response (e.g. blunder detection).
 */
export async function accumulateStream<TReq extends AdviceRequest | ExplainRequest>(
  stream: StreamFn<TReq>,
  req: TReq,
  onUpdate: (text: string) => void,
  opts?: AccumulateOptions,
): Promise<string> {
  let full = "";
  let receivedFirstChunk = false;
  const prefix = opts?.prefix ?? "";

  await stream(
    req,
    (chunk) => {
      if (!receivedFirstChunk) {
        full = "";
        receivedFirstChunk = true;
      }
      full += chunk;
      onUpdate(prefix + full);
    },
    opts?.signal ? { signal: opts.signal } : undefined,
  );

  return full;
}
