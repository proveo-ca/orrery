export type PromptType = "standard" | "explanation";
export type PromptSide = "White" | "Black";
export type PromptActor = "human" | "bot";
export type PromptTag =
  | "Book"
  | "Best"
  | "Good"
  | "Inaccuracy"
  | "Mistake"
  | "Blunder"
  | "Brilliant";

export type PromptFields = {
  language: string;
  langCode: string;
  type: PromptType;
  fen: string;
  moveSan: string;
  side: PromptSide;
  actor: PromptActor;
  gender: "male" | "female" | "neutral";
  tag: PromptTag;
  bestAlt?: string;
  cp: string;
  name?: string;
};

export type EvalLike = {
  cp: number;
  isMate: boolean;
  mateIn: number;
  bestMove?: string;
};

export type MoveAnalysis = {
  fenBefore: string;
  fenAfter: string;
  moveSan: string;
  side: PromptSide;
  actor: PromptActor;
  gender: "male" | "female" | "neutral";
  tag: PromptTag;
  bestAlt: string;
  bestAltMatchesMove: boolean;
  cpBefore: number;
  cpAfter: number;
  name?: string;
};

/**
 * Canonical commentary system prompt. This is the single source of truth shared
 * by the browser orchestrator and the Bun server (see _spec/api/behavior.md §5.1).
 * It includes the SAN sentence so both backends send the identical system message.
 */
export const SYSTEM_PROMPT =
  "Generate professional chess commentary in the specified language. Always use Standard Algebraic Notation (SAN) for moves (e.g., Nf3, e4). For Type=standard use 30–40 words. For Type=explanation, explain the best move briefly (≤50 words). Return exactly: Commentary, Predicted ELO, Verified Classification.";

/** Behaviour-defining chess constants shared across backends (behavior.md §5.6). */
export const MATE_SCORE_FOR_PROMPT = 9999;
export const DEFAULT_EVAL_DEPTH = 15;

/**
 * Exact model-card field order for chess-gemma-commentary:
 * LanguageL
 * LangCode
 * Type
 * FEN
 * MoveSAN
 * Side
 * Actor
 * Name (optional)
 * Gender
 * Tag
 * BestAlt
 * CP
 */
export const PROMPT_FIELD_ORDER = [
  "LanguageL",
  "LangCode",
  "Type",
  "FEN",
  "MoveSAN",
  "Side",
  "Actor",
  "Name",
  "Gender",
  "Tag",
  "BestAlt",
  "CP",
] as const;

function assertNonEmpty(value: string, fieldName: string): void {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required prompt field: ${fieldName}`);
  }
}

function validatePromptFields(fields: PromptFields): void {
  assertNonEmpty(fields.language, "LanguageL");
  assertNonEmpty(fields.langCode, "LangCode");
  assertNonEmpty(fields.type, "Type");
  assertNonEmpty(fields.fen, "FEN");
  assertNonEmpty(fields.moveSan, "MoveSAN");
  assertNonEmpty(fields.side, "Side");
  assertNonEmpty(fields.actor, "Actor");
  assertNonEmpty(fields.gender, "Gender");
  assertNonEmpty(fields.tag, "Tag");
  assertNonEmpty(fields.cp, "CP");
}

export function sideToMoveFromFen(fen: string): PromptSide {
  const activeColor = fen.split(" ")[1] || "w";
  return activeColor === "w" ? "White" : "Black";
}

export function scoreForPrompt(evalResult: EvalLike, mateScore: number): number {
  if (!evalResult.isMate) return evalResult.cp;
  return evalResult.mateIn > 0 ? mateScore : -mateScore;
}

export function formatCpTransition(beforeScore: number, afterScore: number): string {
  const delta = beforeScore - afterScore;
  return `${beforeScore}->${afterScore} (Δ=${delta})`;
}

export function classifyMoveTag(
  beforeScore: number,
  afterScore: number,
  isForcedBlunder: boolean = false,
): PromptTag {
  if (isForcedBlunder) return "Blunder";

  const delta = Math.abs(afterScore - beforeScore);
  if (delta < 20) return "Best";
  if (delta > 200) return "Mistake";
  if (delta > 100) return "Inaccuracy";
  return "Good";
}

export function createMoveAnalysis(params: {
  fenBefore: string;
  fenAfter: string;
  moveSan: string;
  evalBefore: EvalLike;
  evalAfter: EvalLike;
  actor: PromptActor;
  gender: "male" | "female" | "neutral";
  mateScore: number;
  isForcedBlunder?: boolean;
  name?: string;
  bestAltMatchesMove?: boolean;
}): MoveAnalysis {
  const cpBefore = scoreForPrompt(params.evalBefore, params.mateScore);
  const cpAfter = scoreForPrompt(params.evalAfter, params.mateScore);

  return {
    fenBefore: params.fenBefore,
    fenAfter: params.fenAfter,
    moveSan: params.moveSan,
    side: sideToMoveFromFen(params.fenBefore),
    actor: params.actor,
    gender: params.gender,
    tag: classifyMoveTag(cpBefore, cpAfter, params.isForcedBlunder || false),
    bestAlt: params.evalBefore.bestMove || "",
    bestAltMatchesMove: params.bestAltMatchesMove || false,
    cpBefore,
    cpAfter,
    name: params.name,
  };
}

export function buildStructuredPrompt(fields: PromptFields): string {
  validatePromptFields(fields);

  const lines = [
    `LanguageL: ${fields.language}`,
    `LangCode: ${fields.langCode}`,
    `Type: ${fields.type}`,
    `FEN: ${fields.fen}`,
    `MoveSAN: ${fields.moveSan}`,
    `Side: ${fields.side}`,
    `Actor: ${fields.actor}`,
  ];

  if (fields.name && fields.name.trim() !== "") {
    lines.push(`Name: ${fields.name.trim()}`);
  }

  lines.push(`Gender: ${fields.gender}`);
  lines.push(`Tag: ${fields.tag}`);
  lines.push(`BestAlt: ${fields.bestAlt?.trim() ?? ""}`);
  lines.push(`CP: ${fields.cp}`);

  return lines.join("\n");
}

/**
 * Tag-specific explanation instruction appended to "explanation" prompts.
 * Ported verbatim from the Kotlin harness (LlmPromptFormat.kt) — see
 * _spec/api/behavior.md §5.4. Standard prompts get no instruction.
 */
export function buildExplanationInstruction(tag: PromptTag): string {
  switch (tag) {
    case "Blunder":
      return "Instruction: Write the commentary in future tense. Explain why the played move will be a serious error that will allow tactical or positional punishment, and explain why the best alternative will be clearly stronger. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense.";
    case "Mistake":
    case "Inaccuracy":
      return "Instruction: Write the commentary in future tense. Explain why the played move will be less accurate or less efficient than the best alternative, and explain what the best alternative will improve. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense.";
    default:
      return "Instruction: Write the commentary in future tense. Explain why the played move itself will be strong, useful, and beneficial in the position. Focus on the move’s strategic or tactical value. Do not describe the move as inferior, and do not suggest an alternative move unless it is clearly necessary. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense.";
  }
}

export function buildPromptFromAnalysis(
  analysis: MoveAnalysis,
  language: string,
  langCode: string,
  type: PromptType,
): string {
  const prompt = buildStructuredPrompt({
    language,
    langCode,
    type,
    fen: analysis.fenBefore,
    moveSan: analysis.moveSan,
    side: analysis.side,
    actor: analysis.actor,
    name: analysis.name,
    gender: analysis.gender,
    tag: analysis.tag,
    bestAlt: analysis.bestAlt,
    cp: formatCpTransition(analysis.cpBefore, analysis.cpAfter),
  });

  return type === "explanation" ? `${prompt}\n${buildExplanationInstruction(analysis.tag)}` : prompt;
}

export function extractCommentary(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  const commentaryMatch = normalized.match(
    /(?:^|\n)Commentary:\s*(.+?)(?:\n(?:Predicted ELO|Verified Classification):|\n*$)/is,
  );
  if (commentaryMatch) {
    return commentaryMatch[1].trim();
  }

  const firstMeaningfulLine = normalized
    .split("\n")
    .map((line) => line.trim())
    .find(
      (line) =>
        line !== "" &&
        !line.toLowerCase().startsWith("predicted elo:") &&
        !line.toLowerCase().startsWith("verified classification:"),
    );

  return firstMeaningfulLine || "";
}
