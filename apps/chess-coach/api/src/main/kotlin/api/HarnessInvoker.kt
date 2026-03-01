package api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class HarnessInvoker(private val harnessCommand: String = "./harness/bin/chess-coach-harness") {
    
    suspend fun executeMove(move: String, fen: String): String = withContext(Dispatchers.IO) {
        println("Invoking harness for move: $move")
        
        val commandList = harnessCommand.split(Regex("\\s+")) + listOf("move", move, fen)
        val process = ProcessBuilder(commandList)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        
        println("Harness execution finished with exit code: ${process.exitValue()}")
        
        // In a fully integrated setup, the harness would output a structured JSON 
        // or write the advice to a specific file. For now, we return the raw stdout.
        output.trim()
    }

    suspend fun executeAdvice(humanMove: String, aiMove: String, fen: String): String = withContext(Dispatchers.IO) {
        println("Invoking harness for advice")
        
        val commandList = harnessCommand.split(Regex("\\s+")) + listOf("advice", humanMove, aiMove, fen)
        val process = ProcessBuilder(commandList)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        
        println("Harness advice execution finished with exit code: ${process.exitValue()}")
        output.trim()
    }

    suspend fun executeHint(): List<String> = withContext(Dispatchers.IO) {
        println("Invoking harness for hints")
        
        val commandList = harnessCommand.split(Regex("\\s+")) + listOf("hint")
        val process = ProcessBuilder(commandList)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        
        println("Harness hint execution finished with exit code: ${process.exitValue()}")
        
        // Assuming the harness outputs hints separated by newlines
        output.lines().filter { it.isNotBlank() }
    }
}
