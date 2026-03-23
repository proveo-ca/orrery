function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function dedupeAdjacentWords(text: string): string {
  return text.replace(/\b(\w+)(\s+\1\b)+/gi, "$1");
}

function stripLeadingLabels(text: string): string {
  return text.replace(/^(Question|Hint|Explanation|The move)\s*:\s*/i, "").trim();
}

function truncateAtRepeatedPhrase(text: string): string {
  const words = text.split(/\s+/);
  const seen = new Set<string>();

  for (let size = 1; size <= 6; size++) {
    seen.clear();
    for (let i = 0; i <= words.length - size; i++) {
      const phrase = words
        .slice(i, i + size)
        .join(" ")
        .toLowerCase();
      if (seen.has(phrase)) {
        return words.slice(0, i).join(" ");
      }
      seen.add(phrase);
    }
  }

  return text;
}

function keepFirstSentence(text: string): string {
  const match = text.match(/^(.+?[.!?])(?:\s|$)/);
  if (match) return match[1].trim();
  return text;
}

function capWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}.`;
}

function stripTrailingBrokenQuotes(text: string): string {
  return text.replace(/['"`]+$/g, "").trim();
}

function tokenFrequencies(words: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }
  return freq;
}

function hasDominantRepeatedToken(words: string[]): boolean {
  if (words.length < 8) return false;
  const freq = tokenFrequencies(words);
  let maxCount = 0;

  for (const count of freq.values()) {
    if (count > maxCount) maxCount = count;
  }

  return maxCount / words.length > 0.6;
}

function hasLongSingleWordLoop(text: string): boolean {
  return /^(\b[\p{L}\p{N}_'-]+\b)(\s+\1){5,}$/iu.test(text.trim());
}

function hasSingleLetterTokenLoop(words: string[]): boolean {
  let runLength = 0;

  for (const word of words) {
    if (/^[a-z]$/i.test(word)) {
      runLength++;
      if (runLength >= 6) return true;
    } else {
      runLength = 0;
    }
  }

  return false;
}

function hasRepeatedSequence(
  words: string[],
  maxPatternSize: number = 4,
  minRepeats: number = 3,
): boolean {
  for (let size = 1; size <= maxPatternSize; size++) {
    for (let start = 0; start <= words.length - size * minRepeats; start++) {
      const pattern = words
        .slice(start, start + size)
        .join(" ")
        .toLowerCase();
      let repeats = 1;
      let index = start + size;

      while (index + size <= words.length) {
        const nextPattern = words
          .slice(index, index + size)
          .join(" ")
          .toLowerCase();
        if (nextPattern !== pattern) break;
        repeats++;
        index += size;
      }

      if (repeats >= minRepeats) return true;
    }
  }

  return false;
}

function isSanLikeToken(word: string): boolean {
  return /^(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?[+#]?)$/i.test(word);
}

function hasTooManyWeirdTokens(words: string[]): boolean {
  let weirdCount = 0;

  for (const word of words) {
    const clean = word.replace(/[.,!?;:()"']/g, "");
    if (!clean) continue;
    if (isSanLikeToken(clean)) continue;
    if (/^[a-h][1-8]$/.test(clean)) continue;
    if (
      /^(bishop|knight|rook|queen|king|pawn|center|central|develops?|development|pressure|initiative|space|control|active|position|move|good|best|strong|improves?)$/i.test(
        clean,
      )
    )
      continue;
    if (/^[a-z]{3,}$/i.test(clean)) continue;
    if (/[0-9]/.test(clean) && !isSanLikeToken(clean)) {
      weirdCount++;
      continue;
    }
    if (!/[aeiou]/i.test(clean) && clean.length >= 3) {
      weirdCount++;
      continue;
    }
    if (/[a-h]x[a-z]{3,}/i.test(clean)) {
      weirdCount++;
      continue;
    }
  }

  return weirdCount >= 2;
}

function hasBrokenEnding(normalized: string): boolean {
  return /\b(this is|it is|because|which is|and|or|but)\.$/i.test(normalized);
}

function hasCorruptedChessTerms(normalized: string): boolean {
  return /\b(church|moveing|biship|knite|quean|kign)\b/i.test(normalized);
}

function hasBodyPartNonsense(normalized: string): boolean {
  return /\b(hand|leg|arm|foot)\b/i.test(normalized);
}

function isBareMoveInstruction(normalized: string): boolean {
  return /^(try moving|play|move)\s+(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O(?:-O)?[+#]?)\.$/i.test(
    normalized,
  );
}

function hasChessReasonVocabulary(normalized: string): boolean {
  return /\b(center|central|develop|development|pressure|control|initiative|space|active|activity|piece|pieces|king|queen|rook|bishop|knight|pawn|diagonal|square|squares|attack|defend|defense|coordinate|coordination|open|file|files|tempo|safety)\b/i.test(
    normalized,
  );
}

export function sanitizeExplanationText(text: string): string {
  let result = text;
  result = normalizeWhitespace(result);
  result = stripLeadingLabels(result);
  result = dedupeAdjacentWords(result);
  result = truncateAtRepeatedPhrase(result);
  result = keepFirstSentence(result);
  result = capWords(result, 18);
  result = stripTrailingBrokenQuotes(result);
  result = normalizeWhitespace(result);

  if (result && !/[.!?]$/.test(result)) {
    result += ".";
  }

  return result;
}

export function isLowQualityLlmOutput(text: string): boolean {
  const normalized = normalizeWhitespace(text).toLowerCase();
  if (!normalized) return true;
  if (normalized.length < 12) return true;
  if ((normalized.match(/:/g) || []).length > 1) return true;
  if (/(better better|more more|damage damage|question:)/i.test(text)) return true;
  if (/(christian|king'|queen'|bishop'|rook'|knight'|pawn')/i.test(text)) return true;
  if (/(takes the black|takes the white)/i.test(normalized)) return true;
  if (hasLongSingleWordLoop(text)) return true;
  if (hasBrokenEnding(normalized)) return true;
  if (hasCorruptedChessTerms(normalized)) return true;
  if (hasBodyPartNonsense(normalized)) return true;
  if (isBareMoveInstruction(normalized)) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  if (hasSingleLetterTokenLoop(words)) return true;
  if (hasDominantRepeatedToken(words)) return true;
  if (hasRepeatedSequence(words)) return true;
  if (hasTooManyWeirdTokens(words)) return true;

  const unique = new Set(words);
  const uniqueRatio = unique.size / words.length;
  if (uniqueRatio < 0.55) return true;

  if (words.length < 7 && !hasChessReasonVocabulary(normalized)) return true;
  if (!hasChessReasonVocabulary(normalized)) return true;

  return false;
}
