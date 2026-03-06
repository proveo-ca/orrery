import type { Difficulty } from '../store/settingsState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

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

export async function postNewGame(): Promise<NewGameResponse> {
  const response = await fetch(`${API_URL}/new`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('new game request failed');
  }
  return response.json();
}

export async function fetchHello(): Promise<HelloResponse> {
  const response = await fetch(`${API_URL}/hello`);
  if (!response.ok) {
    throw new Error('hello request failed');
  }
  return response.json();
}

export async function postMove(request: MoveRequest): Promise<MoveResponse> {
  const moveResponse = await fetch(`${API_URL}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!moveResponse.ok) {
    throw new Error('move request failed');
  }

  return moveResponse.json();
}

export async function postAdviceStream(
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

  if (!response.ok || !response.body) {
    throw new Error('advice request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      onChunk(decoder.decode(value, { stream: true }));
    }
    if (done) break;
  }
}

export async function postExplainStream(
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

  if (!response.ok || !response.body) {
    throw new Error('explain request failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      onChunk(decoder.decode(value, { stream: true }));
    }
    if (done) break;
  }
}
