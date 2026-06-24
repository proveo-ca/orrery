plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "ca.proveo.chess.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "ca.proveo.chess.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        ndk { abiFilters += "arm64-v8a" } // tsnet + embedded web build → keep one ABI
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildTypes { getByName("release") { isMinifyEnabled = false } }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-ktx:1.13.1")
    // gomobile-generated AAR (see gomobileBind task below)
    implementation(files("../gomobile/build/thinserver.aar"))
}

// ─── Build pipeline: buildWeb → syncWeb → gomobileBind → preBuild ───
// The web build must exist before `gomobile bind` because the Go server
// //go:embed's it. Requires `gomobile`, Go, and the Android NDK on PATH.
val uiDir = file("../../ui")
val gomobileDir = file("../gomobile")

val buildWeb by tasks.registering(Exec::class) {
    workingDir = uiDir
    commandLine("npm", "run", "build:web-full")
}

val syncWeb by tasks.registering(Sync::class) {
    dependsOn(buildWeb)
    from(uiDir.resolve("dist/chess"))
    into(gomobileDir.resolve("thinserver/webroot"))
}

val gomobileBind by tasks.registering(Exec::class) {
    dependsOn(syncWeb)
    workingDir = gomobileDir
    commandLine(
        "gomobile", "bind",
        "-target=android", "-androidapi", "26",
        "-javapkg=ca.proveo.chess",
        "-o", "build/thinserver.aar",
        "./thinserver",
    )
}

tasks.named("preBuild") { dependsOn(gomobileBind) }
