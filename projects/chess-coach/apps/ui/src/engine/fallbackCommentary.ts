import fallbacks from "~/engine/fallbacks.json";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

export function fallbackAdvice(moveSan: string): string {
  return fmt(pick(fallbacks.advice), { moveSan });
}

export function fallbackExplanation(
  tag: string,
  bestMove: string,
  bestAltMatchesMove: boolean,
): string {
  const hasAlternative = bestMove.trim() !== "";
  const e = fallbacks.explanation;

  if (tag === "Blunder") {
    return fmt(pick(hasAlternative ? e.blunder.withAlternative : e.blunder.noAlternative), {
      bestMove,
    });
  }

  if (tag === "Mistake") {
    return fmt(pick(hasAlternative ? e.mistake.withAlternative : e.mistake.noAlternative), {
      bestMove,
    });
  }

  if (tag === "Inaccuracy") {
    return fmt(pick(hasAlternative ? e.inaccuracy.withAlternative : e.inaccuracy.noAlternative), {
      bestMove,
    });
  }

  if (
    bestAltMatchesMove ||
    tag === "Best" ||
    tag === "Good" ||
    tag === "Book" ||
    tag === "Brilliant"
  ) {
    return pick(e.strong);
  }

  return pick(e.default);
}
