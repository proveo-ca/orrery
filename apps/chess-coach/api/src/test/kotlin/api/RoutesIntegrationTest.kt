package api

import api.models.MoveRequest
import api.routes.configureRouting
import api.services.HarnessInvoker
import api.services.StateReader
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
        
        coEvery { mockInvoker.executeMove("e4", any(), any()) } returns HarnessInvoker.MoveResult(expectedFen, "e5")
        every { mockStateReader.readFen() } returns expectedFen

        testApplication {
            // Load the routing module with our mocks
            application {
                configureRouting(mockInvoker, mockStateReader)
            }

            // Act
            val response = client.post("/move") {
                contentType(ContentType.Application.Json)
                setBody(Json.encodeToString(MoveRequest(humanMoveSan = "e4", fenAfterHuman = "dummy_fen")))
            }

            // Assert
            response.status shouldBe HttpStatusCode.OK
            val responseBody = response.bodyAsText()
            (responseBody.contains(expectedFen)) shouldBe true
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
