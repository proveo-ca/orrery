/// <reference lib="webworker" />

let lc0Ready = false;
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
    lc0Ready = true;
    postMessage("readyok");
  },
};

(self as any).Module = Module;

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "INIT") {
    try {
      const response = await fetch(`/chess/web-engine/${msg.weightsFile}`);
      const buffer = await response.arrayBuffer();

      Module.preRun = [
        () => {
          Module.FS.writeFile(msg.weightsFile, new Uint8Array(buffer));
        },
      ];

      importScripts("/chess/web-engine/lc0.js");
    } catch (err) {
      console.error("[Maia Worker] Init failed:", err);
    }
  } else if (typeof msg === "string" && lc0Ready) {
    mainQueue.push(msg);
    uciChannel.postMessage(msg);
  }
};
