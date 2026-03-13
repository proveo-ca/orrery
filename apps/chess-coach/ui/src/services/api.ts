import type { Difficulty } from '../store/settingsState';

const TARGET = import.meta.env.VITE_TARGET;
const API_URL = import.meta.env.VITE_API_URL || window.location.origin;

/** fen is the position AFTER the human move has been applied client-side. */
export type MoveRequest = { humanMoveSan: string; fenAfterHuman: string; difficulty?: Difficulty };
export type MoveResponse = { fen: string; move: string; advice?: string };

export type AdviceRequest = { humanMove: string; aiMove: string; fen: string };
export type ExplainRequest = { fenBefore: string; fenAfter: string; isBlunder: boolean; moveSan: string };

export type HelloResponse = {
  model: string;
  greeting: string;
  thinking: string[];
  bestMove: string[];
};

export type NewGameResponse = { fen: string };

export interface CoachService {
  postNewGame(): Promise<NewGameResponse>;
  fetchHello(): Promise<HelloResponse>;
  postMove(request: MoveRequest): Promise<MoveResponse>;
  postAdviceStream(request: AdviceRequest, onChunk: (chunk: string) => void, options?: { signal?: AbortSignal }): Promise<void>;
  postExplainStream(request: ExplainRequest, onChunk: (chunk: string) => void, options?: { signal?: AbortSignal }): Promise<void>;
}

class HttpCoachService implements CoachService {
  async postNewGame(): Promise<NewGameResponse> {
    const response = await fetch(`${API_URL}/new`, { method: 'POST' });
    if (!response.ok) throw new Error('new game request failed');
    return response.json();
  }

  async fetchHello(): Promise<HelloResponse> {
    const response = await fetch(`${API_URL}/hello`);
    if (!response.ok) throw new Error('hello request failed');
    return response.json();
  }

  async postMove(request: MoveRequest): Promise<MoveResponse> {
    const moveResponse = await fetch(`${API_URL}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!moveResponse.ok) throw new Error('move request failed');
    return moveResponse.json();
  }

  async postAdviceStream(
    request: AdviceRequest,
    onChunk: (chunk: string) => void,
    options?: { signal?: AbortSignal }
  ): Promise<void> {
    const response = await fetch(`${API_URL}/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: options?.signal
    });
    if (!response.ok || !response.body) throw new Error('advice request failed');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (value) onChunk(decoder.decode(value, { stream: true }));
      if (done) break;
    }
  }

  async postExplainStream(
    request: ExplainRequest,
    onChunk: (chunk: string) => void,
    options?: { signal?: AbortSignal }
  ): Promise<void> {
    const response = await fetch(`${API_URL}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: options?.signal
    });
    if (!response.ok || !response.body) throw new Error('explain request failed');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (value) onChunk(decoder.decode(value, { stream: true }));
      if (done) break;
    }
  }
}

class WebWorkerCoachService implements CoachService {
  private workerPromise: Promise<Worker>;
  private msgId = 0;
  private pending = new Map<number, { resolve: Function; reject: Function; onChunk?: Function }>();

  constructor() {
    this.workerPromise = this.initWorker();
  }

  private async initWorker(): Promise<Worker> {
    const WorkerConstructor = (await import('../engine/orchestrator.worker.ts?worker')).default;
    const worker = new WorkerConstructor();
    
    worker.onmessage = (e) => {
      const { id, result, error, chunk, done } = e.data;
      const p = this.pending.get(id);
      if (!p) return;

      if (error) {
        p.reject(new Error(error));
        this.pending.delete(id);
      } else if (chunk !== undefined) {
        if (p.onChunk) p.onChunk(chunk);
      } else if (done) {
        p.resolve();
        this.pending.delete(id);
      } else if (result !== undefined) {
        p.resolve(result);
        this.pending.delete(id);
      }
    };
    return worker;
  }

  private async send<T>(type: string, payload?: any, onChunk?: Function): Promise<T> {
    const worker = await this.workerPromise;
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject, onChunk });
      worker.postMessage({ id, type, payload });
    });
  }

  async postNewGame(): Promise<NewGameResponse> {
    return this.send('NEW_GAME');
  }
  async fetchHello(): Promise<HelloResponse> {
    return this.send('HELLO');
  }
  async postMove(request: MoveRequest): Promise<MoveResponse> {
    return this.send('MOVE', request);
  }
  async postAdviceStream(request: AdviceRequest, onChunk: (chunk: string) => void, _options?: { signal?: AbortSignal }): Promise<void> {
    return this.send('ADVICE_STREAM', request, onChunk);
  }
  async postExplainStream(request: ExplainRequest, onChunk: (chunk: string) => void, _options?: { signal?: AbortSignal }): Promise<void> {
    return this.send('EXPLAIN_STREAM', request, onChunk);
  }
}

// If VITE_TARGET is explicitly 'web', use the 100% in-browser Web Worker engine.
// Otherwise, default to the Kotlin backend (Desktop/Docker mode).
const activeService: CoachService = TARGET === 'web' ? new WebWorkerCoachService() : new HttpCoachService();

// Export facade functions to maintain compatibility with existing UI imports
export const postNewGame = () => activeService.postNewGame();
export const fetchHello = () => activeService.fetchHello();
export const postMove = (req: MoveRequest) => activeService.postMove(req);
export const postAdviceStream = (req: AdviceRequest, onChunk: (chunk: string) => void, opts?: { signal?: AbortSignal }) => activeService.postAdviceStream(req, onChunk, opts);
export const postExplainStream = (req: ExplainRequest, onChunk: (chunk: string) => void, opts?: { signal?: AbortSignal }) => activeService.postExplainStream(req, onChunk, opts);
