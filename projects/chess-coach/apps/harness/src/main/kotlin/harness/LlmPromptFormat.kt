package harness

data class PromptFields(
    val language: String,
    val langCode: String,
    val type: String,
    val fen: String,
    val moveSan: String,
    val side: String,
    val actor: String,
    val gender: String,
    val tag: String,
    val bestAlt: String? = null,
    val cp: String,
    val name: String? = null
)

data class MoveAnalysis(
    val fenBefore: String,
    val fenAfter: String,
    val moveSan: String,
    val side: String,
    val actor: String,
    val gender: String,
    val tag: String,
    val bestAlt: String,
    val cpBefore: Int,
    val cpAfter: Int,
    val name: String? = null
)

/*
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
val PROMPT_FIELD_ORDER = listOf(
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
    "CP"
)

private fun assertNonEmpty(value: String, fieldName: String) {
    require(value.isNotBlank()) { "Missing required prompt field: $fieldName" }
}

private fun validatePromptFields(fields: PromptFields) {
    assertNonEmpty(fields.language, "LanguageL")
    assertNonEmpty(fields.langCode, "LangCode")
    assertNonEmpty(fields.type, "Type")
    assertNonEmpty(fields.fen, "FEN")
    assertNonEmpty(fields.moveSan, "MoveSAN")
    assertNonEmpty(fields.side, "Side")
    assertNonEmpty(fields.actor, "Actor")
    assertNonEmpty(fields.gender, "Gender")
    assertNonEmpty(fields.tag, "Tag")
    assertNonEmpty(fields.cp, "CP")
}

fun sideToMoveFromFen(fen: String): String {
    val activeColor = fen.split(" ").getOrNull(1) ?: "w"
    return if (activeColor == "w") "White" else "Black"
}

fun scoreForPrompt(evalResult: EngineBridge.EvalResult, mateScore: Int): Int {
    if (!evalResult.isMate) return evalResult.cp
    return if (evalResult.mateIn > 0) mateScore else -mateScore
}

fun formatCpTransition(beforeScore: Int, afterScore: Int): String {
    val delta = beforeScore - afterScore
    return "$beforeScore->$afterScore (Δ=$delta)"
}

fun classifyMoveTag(beforeScore: Int, afterScore: Int, isForcedBlunder: Boolean = false): String {
    if (isForcedBlunder) return "Blunder"

    val delta = kotlin.math.abs(afterScore - beforeScore)
    return when {
        delta < 20 -> "Best"
        delta > 200 -> "Mistake"
        delta > 100 -> "Inaccuracy"
        else -> "Good"
    }
}

fun createMoveAnalysis(
    fenBefore: String,
    fenAfter: String,
    moveSan: String,
    evalBefore: EngineBridge.EvalResult,
    evalAfter: EngineBridge.EvalResult,
    actor: String,
    gender: String,
    mateScore: Int,
    isForcedBlunder: Boolean = false,
    name: String? = null
): MoveAnalysis {
    val cpBefore = scoreForPrompt(evalBefore, mateScore)
    val cpAfter = scoreForPrompt(evalAfter, mateScore)

    return MoveAnalysis(
        fenBefore = fenBefore,
        fenAfter = fenAfter,
        moveSan = moveSan,
        side = sideToMoveFromFen(fenBefore),
        actor = actor,
        gender = gender,
        tag = classifyMoveTag(cpBefore, cpAfter, isForcedBlunder),
        bestAlt = evalBefore.bestMove,
        cpBefore = cpBefore,
        cpAfter = cpAfter,
        name = name
    )
}

fun buildStructuredPrompt(fields: PromptFields): String {
    validatePromptFields(fields)

    val lines = mutableListOf(
        "LanguageL: ${fields.language}",
        "LangCode: ${fields.langCode}",
        "Type: ${fields.type}",
        "FEN: ${fields.fen}",
        "MoveSAN: ${fields.moveSan}",
        "Side: ${fields.side}",
        "Actor: ${fields.actor}"
    )

    if (!fields.name.isNullOrBlank()) {
        lines.add("Name: ${fields.name.trim()}")
    }

    lines.add("Gender: ${fields.gender}")
    lines.add("Tag: ${fields.tag}")
    lines.add("BestAlt: ${fields.bestAlt?.trim().orEmpty()}")
    lines.add("CP: ${fields.cp}")

    return lines.joinToString("\n")
}

private fun buildExplanationInstruction(tag: String): String {
    return when (tag) {
        "Blunder" ->
            "Instruction: Write the commentary in future tense. Explain why the played move will be a serious error that will allow tactical or positional punishment, and explain why the best alternative will be clearly stronger. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense."
        "Mistake", "Inaccuracy" ->
            "Instruction: Write the commentary in future tense. Explain why the played move will be less accurate or less efficient than the best alternative, and explain what the best alternative will improve. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense."
        else ->
            "Instruction: Write the commentary in future tense. Explain why the played move itself will be strong, useful, and beneficial in the position. Focus on the move’s strategic or tactical value. Do not describe the move as inferior, and do not suggest an alternative move unless it is clearly necessary. Keep the explanation brief, concrete, and chess-specific. Do not use past tense or present tense."
    }
}

fun buildPromptFromAnalysis(
    analysis: MoveAnalysis,
    language: String,
    langCode: String,
    type: String
): String {
    val prompt = buildStructuredPrompt(
        PromptFields(
            language = language,
            langCode = langCode,
            type = type,
            fen = analysis.fenBefore,
            moveSan = analysis.moveSan,
            side = analysis.side,
            actor = analysis.actor,
            gender = analysis.gender,
            tag = analysis.tag,
            bestAlt = analysis.bestAlt,
            cp = formatCpTransition(analysis.cpBefore, analysis.cpAfter),
            name = analysis.name
        )
    )

    return if (type == "explanation") {
        "$prompt\n${buildExplanationInstruction(analysis.tag)}"
    } else {
        prompt
    }
}

fun extractCommentary(raw: String): String {
    val normalized = raw.replace("\r\n", "\n").trim()
    if (normalized.isEmpty()) return ""

    val commentaryRegex = Regex(
        """(?:^|\n)Commentary:\s*(.+?)(?:\n(?:Predicted ELO|Verified Classification):|\n*$)""",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
    )
    val commentaryMatch = commentaryRegex.find(normalized)
    if (commentaryMatch != null) {
        return commentaryMatch.groupValues[1].trim()
    }

    return normalized
        .lineSequence()
        .map { it.trim() }
        .firstOrNull { it.isNotEmpty() && !it.startsWith("Predicted ELO:", ignoreCase = true) && !it.startsWith("Verified Classification:", ignoreCase = true) }
        ?: ""
}
