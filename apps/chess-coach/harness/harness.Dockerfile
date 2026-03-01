FROM eclipse-temurin:25-jdk-alpine

# Install Stockfish (for EngineBridge) and bash (for gradlew)
RUN apk add --no-cache stockfish bash

WORKDIR /app

# Copy Gradle wrapper and build files first to maximize layer caching
COPY gradlew .
COPY gradle gradle/
COPY build.gradle.kts .
COPY settings.gradle.kts .

# Copy the actual source code
COPY src src/

# Build the application natively with JDK 25
RUN ./gradlew build --no-daemon

# Run the application
CMD ["./gradlew", "run", "--no-daemon"]
