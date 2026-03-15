// Define the async queue that lc0's pthread expects
self.Module = {
  queue: {
    messages: [],
    resolvers: [],
    push(msg) {
      if (this.resolvers.length > 0) this.resolvers.shift()(msg);
      else this.messages.push(msg);
    },
    get() {
      if (this.messages.length > 0) return Promise.resolve(this.messages.shift());
      return new Promise(r => this.resolvers.push(r));
    }
  }
};

// Listen for UCI commands from the main worker
const bc = new BroadcastChannel('lc0-uci');
bc.onmessage = (e) => {
  self.Module.queue.push(e.data);
};

// Load the actual engine
importScripts('/chess/web-engine/lc0.js');
