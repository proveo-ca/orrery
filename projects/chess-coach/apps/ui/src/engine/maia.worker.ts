/// <reference lib="webworker" />

let lc0Ready = false;
let lc0Loaded = false;
const uciChannel = new BroadcastChannel("lc0-uci");

class AsyncQueue {
  private messages: string[] = [];
  private resolvers: ((value: string) => void)[] = [];
  push(msg: string) {
    if (this.resolvers.length > 0) this.resolvers.shift()!(msg);
    else this.messages.push(msg);
  }
  get(): Promise<string> {
    if (this.messages.length > 0) return Promise.resolve(this.messages.shift()!);
    return new Promise((resolve) => this.resolvers.push(resolve));
  }
}
const mainQueue = new AsyncQueue();

// Pending weights data — written to VFS once the runtime is ready.
let pendingWeightsFile: string | null = null;
let pendingWeightsData: Uint8Array | null = null;

var Module: any = {
  // Point Emscripten to our clean wrapper file for its pthreads
  mainScriptUrlOrBlob: "/chess/web-engine/lc0-wrapper.js",
  locateFile: (path: string) => {
    if (path?.endsWith(".wasm")) return "/chess/web-engine/lc0.wasm";
    if (path?.endsWith(".worker.js")) return `/chess/web-engine/${path}`;
    return path;
  },
  print: (text: string) => postMessage(text),
  printErr: (text: string) => {
    if (!text.includes("|_") && !text.includes("|   _") && !text.includes("       _")) {
      console.error("[Maia Worker Err]", text);
    }
  },
  queue: mainQueue,
  onRuntimeInitialized: () => {
    console.log(`[Maia Worker] onRuntimeInitialized: file=${pendingWeightsFile}, size=${pendingWeightsData?.length}`);
    if (pendingWeightsFile && pendingWeightsData) {
      Module.FS.writeFile(pendingWeightsFile, pendingWeightsData);
      console.log(`[Maia Worker] Wrote ${pendingWeightsData.length} bytes to VFS as ${pendingWeightsFile}`);
      pendingWeightsFile = null;
      pendingWeightsData = null;
    }
    lc0Ready = true;
    postMessage("readyok");
  },
};

(self as any).Module = Module;

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "INIT") {
    try {
      const fetchUrl = `/chess/web-engine/${msg.weightsFile}`;
      console.log(`[Maia Worker] Fetching weights from: ${fetchUrl}`);

      const response = await fetch(fetchUrl);
      console.log(`[Maia Worker] Fetch response: status=${response.status}, content-type=${response.headers.get("content-type")}, content-encoding=${response.headers.get("content-encoding")}, content-length=${response.headers.get("content-length")}`);

      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const magic = bytes.length >= 2 ? `0x${bytes[0].toString(16).padStart(2, "0")} 0x${bytes[1].toString(16).padStart(2, "0")}` : "too short";
      const first16 = Array.from(bytes.slice(0, 16)).map(b => `0x${b.toString(16).padStart(2, "0")}`).join(" ");
      const clHeader = response.headers.get("content-length");
      console.log(`[Maia Worker] Content-Length header: ${clHeader}, actual arrayBuffer size: ${buffer.byteLength}, match: ${clHeader === String(buffer.byteLength)}`);
      console.log(`[Maia Worker] Weights loaded: ${buffer.byteLength} bytes, magic=${magic} (expect 0x1f 0x8b for gzip)`);
      console.log(`[Maia Worker] First 16 bytes: ${first16}`);

      // Detect if we got HTML back (SPA fallback)
      if (bytes[0] === 0x3c) {
        const text = new TextDecoder().decode(bytes.slice(0, 200));
        console.error(`[Maia Worker] ERROR: Got HTML instead of weights! First 200 chars: ${text}`);
        throw new Error("Received HTML instead of weight file — likely SPA fallback");
      }

      // Pre-decompress gzip so lc0 receives raw protobuf — avoids
      // parsing issues in lc0's gzip reader across pthread/SAB boundaries.
      let finalBytes = bytes;
      let finalName = msg.weightsFile;
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        console.log(`[Maia Worker] Decompressing gzipped weights...`);
        const ds = new DecompressionStream("gzip");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(bytes);
        writer.close();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLen = chunks.reduce((s, c) => s + c.length, 0);
        finalBytes = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          finalBytes.set(c, offset);
          offset += c.length;
        }
        // Use .pb extension so lc0 treats it as raw protobuf
        finalName = msg.weightsFile.replace(/\.gz$/, "");
        console.log(`[Maia Worker] Decompressed: ${bytes.length} → ${finalBytes.length} bytes, VFS name: ${finalName}`);
      }

      if (lc0Loaded && Module.FS) {
        // lc0.js already loaded — just swap the weights in VFS
        console.log(`[Maia Worker] lc0 already loaded, swapping weights to ${finalName}`);
        Module.FS.writeFile(finalName, finalBytes);
        console.log(`[Maia Worker] Wrote ${finalBytes.length} bytes to VFS as ${finalName}`);
        lc0Ready = true;
        postMessage("readyok");
      } else {
        pendingWeightsFile = finalName;
        pendingWeightsData = finalBytes;

        console.log(`[Maia Worker] Loading lc0.js...`);
        importScripts("/chess/web-engine/lc0.js");
        lc0Loaded = true;
        console.log(`[Maia Worker] lc0.js loaded, waiting for onRuntimeInitialized...`);
      }
    } catch (err) {
      console.error("[Maia Worker] Init failed:", err);
    }
  } else if (typeof msg === "string" && lc0Ready) {
    mainQueue.push(msg);
    uciChannel.postMessage(msg);
  }
};
