package api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

class HarnessInvoker(private val harnessCommand: String = "./harness/bin/chess-coach-harness") {
    
    suspend fun executeMove(move: String, fen: String): String = withContext(Dispatchers.IO) {
        println("Invoking harness for move: $move")
        
        val process = ProcessBuilder(harnessCommand, "move", move, fen)
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        
        println("Harness execution finished with exit code: ${process.exitValue()}")
        
        // In a fully integrated setup, the harness would output a structured JSON 
        // or write the advice to a specific file. For now, we return the raw stdout.
        output.trim()
    }

    suspend fun executeHint(): List<String> = withContext(Dispatchers.IO) {
        println("Invoking harness for hints")
        
        val process = ProcessBuilder(harnessCommand, "hint")
            .redirectError(ProcessBuilder.Redirect.INHERIT)
            .start()
        
        val output = process.inputStream.bufferedReader().readText()
        process.waitFor()
        
        println("Harness hint execution finished with exit code: ${process.exitValue()}")
        
        // Assuming the harness outputs hints separated by newlines
        output.lines().filter { it.isNotBlank() }
    }
}
