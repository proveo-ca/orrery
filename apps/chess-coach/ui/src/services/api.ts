export type MoveRequest = { move: string; fen: string; difficulty?: string };
export type MoveResponse = { fen: string; move: string };

export type AdviceRequest = { humanMove: string; aiMove: string; fen: string };
export type AdviceResponse = { advice: string };

export type HelloResponse = {
  model: string;
  greeting: string;
  thinking: string[];
  bestMove: string[];
};

export type NewGameResponse = { fen: string };

export async function postNewGame(apiUrl: string): Promise<NewGameResponse> {
  const response = await fetch(`${apiUrl}/new`, { method: 'POST' });
  if (!response.ok) {
    throw new Error('new game request failed');
  }
  return response.json();
}

export async function fetchHello(apiUrl: string): Promise<HelloResponse> {
  const response = await fetch(`${apiUrl}/hello`);
  if (!response.ok) {
    throw new Error('hello request failed');
  }
  return response.json();
}

export async function postMove(apiUrl: string, request: MoveRequest): Promise<MoveResponse> {
  const moveResponse = await fetch(`${apiUrl}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!moveResponse.ok) {
    throw new Error('move request failed');
  }

  return moveResponse.json();
}

export async function postAdvice(
  apiUrl: string,
  request: AdviceRequest,
  options?: { signal?: AbortSignal }
): Promise<AdviceResponse> {
  const adviceResponse = await fetch(`${apiUrl}/advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: options?.signal
  });

  if (!adviceResponse.ok) {
    throw new Error('advice request failed');
  }

  return adviceResponse.json();
}
