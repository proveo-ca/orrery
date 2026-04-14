/**
 * Checks whether the browser supports the features needed for the in-browser
 * chess engines (Stockfish pthreads, lc0/Maia pthreads + SharedArrayBuffer).
 *
 * Call once on app load; the result never changes within a session.
 */
export function checkEngineSupport(): { supported: boolean; reason: string | null; debug: string } {
  const info: string[] = [
    `crossOriginIsolated: ${self.crossOriginIsolated}`,
    `isSecureContext: ${self.isSecureContext}`,
    `SharedArrayBuffer: ${typeof SharedArrayBuffer}`,
    `location: ${location.protocol}//${location.host}`,
    `userAgent: ${navigator.userAgent}`,
  ];

  if (typeof SharedArrayBuffer === "undefined") {
    return {
      supported: false,
      reason: self.crossOriginIsolated
        ? "SharedArrayBuffer is not available despite cross-origin isolation. Your browser may not support this feature."
        : "SharedArrayBuffer requires cross-origin isolation (COOP + COEP headers).",
      debug: info.join("\n"),
    };
  }

  if (!self.crossOriginIsolated) {
    return {
      supported: false,
      reason: "Cross-origin isolation is not enabled. The server must send COOP and COEP headers.",
      debug: info.join("\n"),
    };
  }

  try {
    const mem = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    info.push(`WASM shared memory: ${mem.buffer instanceof SharedArrayBuffer}`);
    if (!(mem.buffer instanceof SharedArrayBuffer)) {
      return {
        supported: false,
        reason: "WebAssembly shared memory is not supported in this browser.",
        debug: info.join("\n"),
      };
    }
  } catch (e: any) {
    info.push(`WASM shared memory error: ${e.message}`);
    return {
      supported: false,
      reason: "WebAssembly with threads is not supported in this browser.",
      debug: info.join("\n"),
    };
  }

  return { supported: true, reason: null, debug: info.join("\n") };
}
