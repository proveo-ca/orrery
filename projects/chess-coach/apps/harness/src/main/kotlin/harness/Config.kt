package harness

object EngineConfig {
    object Llm {
        const val SYSTEM_PROMPT =
            "Generate professional chess commentary in the specified language. Always use Standard Algebraic Notation (SAN) for moves (e.g., Nf3, e4). For Type=standard use 30–40 words. For Type=explanation, explain the best move briefly (≤50 words). Return exactly: Commentary, Predicted ELO, Verified Classification."

        const val DEFAULT_TEMPERATURE = 0.7
        const val DEFAULT_MAX_TOKENS = 256
        const val EXPLANATION_TEMPERATURE = 0.7
        const val EXPLANATION_MAX_TOKENS = 256

        const val DEFAULT_LANGUAGE = "English"
        const val DEFAULT_LANG_CODE = "en"
        const val DEFAULT_ACTOR = "human"
        const val DEFAULT_GENDER = "neutral"
        const val DEFAULT_NAME = ""
    }

    object Chess {
        const val DEFAULT_EVAL_DEPTH = 15
        const val MATE_SCORE_FOR_PROMPT = 9999
    }
}
