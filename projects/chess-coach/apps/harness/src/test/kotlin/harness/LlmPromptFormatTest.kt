package harness

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.assertFailsWith

class LlmPromptFormatTest {
    @Test
    fun `buildStructuredPrompt uses exact model-card field order`() {
        val prompt = buildStructuredPrompt(
            PromptFields(
                language = "English",
                langCode = "en",
                type = "standard",
                fen = "8/8/8/8/8/8/8/8 w - - 0 1",
                moveSan = "Nf3",
                side = "White",
                actor = "human",
                name = "Selena",
                gender = "female",
                tag = "Good",
                bestAlt = "g1f3",
                cp = "27->21 (Δ=6)"
            )
        )

        val lines = prompt.lines()
        assertEquals("LanguageL: English", lines[0])
        assertEquals("LangCode: en", lines[1])
        assertEquals("Type: standard", lines[2])
        assertEquals("FEN: 8/8/8/8/8/8/8/8 w - - 0 1", lines[3])
        assertEquals("MoveSAN: Nf3", lines[4])
        assertEquals("Side: White", lines[5])
        assertEquals("Actor: human", lines[6])
        assertEquals("Name: Selena", lines[7])
        assertEquals("Gender: female", lines[8])
        assertEquals("Tag: Good", lines[9])
        assertEquals("BestAlt: g1f3", lines[10])
        assertEquals("CP: 27->21 (Δ=6)", lines[11])
    }

    @Test
    fun `buildStructuredPrompt omits Name when blank`() {
        val prompt = buildStructuredPrompt(
            PromptFields(
                language = "English",
                langCode = "en",
                type = "explanation",
                fen = "8/8/8/8/8/8/8/8 b - - 0 1",
                moveSan = "Nf6",
                side = "Black",
                actor = "human",
                name = "",
                gender = "neutral",
                tag = "Best",
                bestAlt = "g8f6",
                cp = "10->8 (Δ=2)"
            )
        )

        assertFalse(prompt.contains("\nName:"))
        assertTrue(prompt.contains("Gender: neutral"))
    }

    @Test
    fun `buildStructuredPrompt requires non-empty required fields`() {
        assertFailsWith<IllegalArgumentException> {
            buildStructuredPrompt(
                PromptFields(
                    language = "",
                    langCode = "en",
                    type = "standard",
                    fen = "8/8/8/8/8/8/8/8 w - - 0 1",
                    moveSan = "e4",
                    side = "White",
                    actor = "human",
                    gender = "neutral",
                    tag = "Good",
                    bestAlt = "e2e4",
                    cp = "0->0 (Δ=0)"
                )
            )
        }
    }

    @Test
    fun `formatCpTransition uses spec format`() {
        assertEquals("27->21 (Δ=6)", formatCpTransition(27, 21))
        assertEquals("120->9999 (Δ=-9879)", formatCpTransition(120, 9999))
    }

    @Test
    fun `scoreForPrompt maps mate scores to configured sentinel values`() {
        val winningMate = EvalResult(
            bestMove = "e2e4",
            cp = 0,
            isMate = true,
            mateIn = 3,
            pv = ""
        )
        val losingMate = EvalResult(
            bestMove = "e7e5",
            cp = 0,
            isMate = true,
            mateIn = -2,
            pv = ""
        )
        val centipawnEval = EvalResult(
            bestMove = "g1f3",
            cp = 42,
            isMate = false,
            mateIn = 0,
            pv = ""
        )

        assertEquals(9999, scoreForPrompt(winningMate, 9999))
        assertEquals(-9999, scoreForPrompt(losingMate, 9999))
        assertEquals(42, scoreForPrompt(centipawnEval, 9999))
    }

    @Test
    fun `sideToMoveFromFen derives mover from pre-move fen`() {
        assertEquals("White", sideToMoveFromFen("8/8/8/8/8/8/8/8 w - - 0 1"))
        assertEquals("Black", sideToMoveFromFen("8/8/8/8/8/8/8/8 b - - 0 1"))
    }

    @Test
    fun `classifyMoveTag uses expected thresholds`() {
        assertEquals("Blunder", classifyMoveTag(20, 500, isForcedBlunder = true))
        assertEquals("Best", classifyMoveTag(30, 40))
        assertEquals("Good", classifyMoveTag(30, 90))
        assertEquals("Inaccuracy", classifyMoveTag(30, 170))
        assertEquals("Mistake", classifyMoveTag(30, 260))
    }

    @Test
    fun `extractCommentary returns only commentary line from structured response`() {
        val raw = """
            Commentary: Strong move controlling the center.
            Predicted ELO: 1820
            Verified Classification: Good Move
        """.trimIndent()

        assertEquals("Strong move controlling the center.", extractCommentary(raw))
    }

    @Test
    fun `extractCommentary falls back to first non-empty non-metadata line`() {
        val raw = """
            Strong move controlling the center.
            Predicted ELO: 1820
            Verified Classification: Good Move
        """.trimIndent()

        assertEquals("Strong move controlling the center.", extractCommentary(raw))
    }
}
