# --- Stage 1: Build UI ---
FROM node:22-alpine AS ui-builder
WORKDIR /ui
COPY ui/package.json ./

RUN npm install
COPY ui/ ./

ENV VITE_DEBUG=true
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

# --- Stage 3: Build lc0 v0.29.0 ---
FROM ubuntu:20.04 AS lc0-builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    curl g++ meson ninja-build git python3 libopenblas-dev pkg-config

WORKDIR /build
# Downgrade to v0.29.0 (last version to support Maia's v1 network architecture)
RUN curl -L -o lc0.tar.gz https://api.github.com/repos/LeelaChessZero/lc0/tarball/release/0.29 && \
    mkdir lc0-src && tar -xzf lc0.tar.gz -C lc0-src --strip-components=1

WORKDIR /build/lc0-src
RUN ./build.sh -Dgtest=false

# --- Stage 4: Final Runtime ---
FROM eclipse-temurin:25-jdk-noble
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y universe && \
    apt-get update && \
    apt-get install -y bash curl stockfish libopenblas0 zlib1g libstdc++6 libgcc-s1 && \
    rm -rf /var/lib/apt/lists/*

# Ubuntu installs games to /usr/games, which is not in the default PATH
RUN ln -s /usr/games/stockfish /usr/local/bin/stockfish

WORKDIR /app

# Copy the compiled lc0 binary
COPY --from=lc0-builder /build/lc0-src/build/release/lc0 /usr/local/bin/lc0
# Copy the zlib shared library that lc0 was linked against during the build
COPY --from=lc0-builder /build/lc0-src/build/release/subprojects/zlib-1.2.11/libz.so* /usr/lib/
RUN ldconfig

RUN mkdir -p /app/weights && \
    curl -fL -o /app/weights/maia-1100.pb.gz https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-1100.pb.gz && \
    curl -fL -o /app/weights/maia-1600.pb.gz https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-1600.pb.gz && \
    curl -fL -o /app/weights/maia-2200.pb.gz "https://github.com/CallOn84/LeelaNets/raw/main/Nets/Maia%202200/maia-2200.pb.gz"

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
