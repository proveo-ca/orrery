// Standalone Android Gradle build — intentionally separate from the (deleted)
// JVM root build. Requires the Android SDK + NDK and `gomobile` on PATH.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "chess-coach-android"
include(":app")
