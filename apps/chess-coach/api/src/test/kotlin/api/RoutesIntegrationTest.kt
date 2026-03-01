package api

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class RoutesIntegrationTest : StringSpec({

    val mockInvoker = mockk<HarnessInvoker>()
    val mockStateReader = mockk<StateReader>()

    "POST /move should execute harness and return updated state" {
        // Arrange
        val expectedAdvice = "Great move! Controlling the center."
        val expectedFen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
        
        coEvery { mockInvoker.executeMove("e4", any()) } returns expectedAdvice
        every { mockStateReader.readFen() } returns expectedFen

        testApplication {
            // Load the routing module with our mocks
            application {
                configureRouting(mockInvoker, mockStateReader)
            }

            // Act
            val response = client.post("/move") {
                contentType(ContentType.Application.Json)
                setBody(Json.encodeToString(MoveRequest(move = "e4", fen = "dummy_fen")))
            }

            // Assert
            response.status shouldBe HttpStatusCode.OK
            val responseBody = response.bodyAsText()
            (responseBody.contains(expectedAdvice)) shouldBe true
            (responseBody.contains(expectedFen)) shouldBe true
        }
    }

    "GET /hint should return a list of hints" {
        // Arrange
        val expectedHints = listOf("e4 (+0.5)", "d4 (+0.4)")
        coEvery { mockInvoker.executeHint() } returns expectedHints

        testApplication {
            application {
                configureRouting(mockInvoker, mockStateReader)
            }

            // Act
            val response = client.get("/hint")

            // Assert
            response.status shouldBe HttpStatusCode.OK
            val responseBody = response.bodyAsText()
            (responseBody.contains("e4 (+0.5)")) shouldBe true
        }
    }

    "POST /new should reset the game and return the starting FEN" {
        // Arrange
        val startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        every { mockStateReader.resetGame() } returns Unit
        every { mockStateReader.readFen() } returns startingFen

        testApplication {
            application {
                configureRouting(mockInvoker, mockStateReader)
            }

            // Act
            val response = client.post("/new")

            // Assert
            response.status shouldBe HttpStatusCode.OK
            val responseBody = response.bodyAsText()
            (responseBody.contains(startingFen)) shouldBe true
        }
    }
})
