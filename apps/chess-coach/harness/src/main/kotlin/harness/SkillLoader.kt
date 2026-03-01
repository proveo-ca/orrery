package harness

import java.io.File

class SkillLoader(private val skillsDir: String = "skills") {
    fun loadAllSkills(): String {
        val dir = File(skillsDir)
        if (!dir.exists() || !dir.isDirectory) return ""

        return buildString {
            dir.listFiles { file -> file.extension == "md" }?.forEach { file ->
                appendLine("--- ${file.name} ---")
                appendLine(file.readText().trim())
                appendLine()
            }
        }
    }
}
