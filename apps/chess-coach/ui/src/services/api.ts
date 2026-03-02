export type MoveRequest = { move: string; fen: string };
export type MoveResponse = { fen: string; move: string };

export type AdviceRequest = { humanMove: string; aiMove: string; fen: string };
export type AdviceResponse = { advice: string };

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
