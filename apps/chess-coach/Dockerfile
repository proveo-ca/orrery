# --- Stage 1: Build UI ---
FROM node:22-alpine AS ui-builder
WORKDIR /ui
COPY ui/package.json ./
RUN npm install
COPY ui/ ./
RUN npm run build

# --- Stage 2: Build Kotlin ---
FROM eclipse-temurin:25-jdk-alpine AS kt-builder
RUN apk add --no-cache bash
WORKDIR /workspace
COPY harness/ ./harness/
WORKDIR /workspace/harness
RUN chmod +x gradlew && ./gradlew installDist --no-daemon

WORKDIR /workspace
COPY api/ ./api/
WORKDIR /workspace/api
RUN chmod +x gradlew && ./gradlew installDist --no-daemon

# --- Stage 3: Final Runtime ---
FROM eclipse-temurin:25-jdk-alpine
RUN apk add --no-cache bash && \
    apk add --no-cache stockfish --repository=http://dl-cdn.alpinelinux.org/alpine/edge/testing/

WORKDIR /app

# Copy Kotlin binaries
COPY --from=kt-builder /workspace/harness/build/install/chess-coach-harness ./harness
COPY --from=kt-builder /workspace/api/build/install/chess-coach-api ./api

# Copy Skills directory for Context Injection
COPY harness/skills ./skills

# Copy compiled UI to the 'static' folder for Ktor to serve
COPY --from=ui-builder /ui/dist ./static

EXPOSE 8080

# Run the API (which now serves the UI too)
CMD ["./api/bin/chess-coach-api"]
