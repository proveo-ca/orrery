/**
 * Checks whether the browser supports the features needed for the in-browser
 * chess engines.
 *
 * Stockfish is now the single-threaded build (`stockfish-18-lite-single.js`),
 * which uses ordinary wasm memory and has no SAB / pthread requirement. The
 * remaining hard requirement is Maia/lc0, which still uses SharedArrayBuffer
 * + WASM threads (cross-origin isolation needed). When that's unavailable
 * we'd still want to surface a clear "this browser can't play AI moves"
 * message before the user enters the screen.
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

  // Maia/lc0 needs WASM threads; probe with a 1-page (64 KB) shared
  // allocation so we just confirm the capability without consuming real
  // memory budget.
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
