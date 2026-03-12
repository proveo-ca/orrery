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

# Copy root Gradle wrapper and settings
COPY gradle/ ./gradle/
COPY gradlew gradlew.bat settings.gradle.kts ./

# Copy subprojects
COPY harness/ ./harness/
COPY api/ ./api/

# Build both projects together
RUN chmod +x gradlew && ./gradlew :api:installDist :harness:installDist --no-daemon

# --- Stage 3: Build lc0 v0.29.0 ---
FROM ubuntu:20.04 AS lc0-builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    g++ meson ninja-build git python3 libopenblas-dev pkg-config protobuf-compiler

WORKDIR /build
# Clone with submodules to fix the protobuf parsing error!
RUN git clone -b release/0.29 --recurse-submodules https://github.com/LeelaChessZero/lc0.git lc0-src

WORKDIR /build/lc0-src
RUN ./build.sh -Dgtest=false

# --- Stage 4: Final Runtime ---
FROM eclipse-temurin:25-jdk-noble
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y universe && \
    apt-get update && \
    apt-get install -y bash curl stockfish libopenblas0 zlib1g libstdc++6 libgcc-s1 p7zip-full && \
    rm -rf /var/lib/apt/lists/*

# Ubuntu installs games to /usr/games, which is not in the default PATH
RUN ln -s /usr/games/stockfish /usr/local/bin/stockfish

WORKDIR /app

# Copy the compiled lc0 binary
COPY --from=lc0-builder /build/lc0-src/build/release/lc0 /usr/local/bin/lc0
RUN ldconfig

RUN mkdir -p /app/weights && \
    curl -fL -o /app/weights/maia-1100.pb.gz https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-1100.pb.gz && \
    curl -fL -o /app/weights/maia-1600.pb.gz https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-1600.pb.gz && \
    curl -fL -o /app/weights/maia-2200.pb.gz "https://github.com/CallOn84/LeelaNets/raw/main/Nets/Maia%202200/maia-2200.pb.gz" && \
    curl -fL -o /tmp/perfect.7z "https://github.com/gmcheems-org/free-opening-books/raw/main/books/multi/Perfect%202021.7z" && \
    7z e /tmp/perfect.7z "*.bin" -o/app/weights/ -r && \
    mv /app/weights/*.bin /app/weights/openings.bin && \
    rm /tmp/perfect.7z

# Copy Kotlin binaries
COPY --from=kt-builder /workspace/harness/build/install/harness ./harness
COPY --from=kt-builder /workspace/api/build/install/api ./api

# Copy Skills directory for Context Injection
COPY harness/skills ./skills

# Copy compiled UI to the 'static' folder for Ktor to serve
COPY --from=ui-builder /ui/dist ./static

EXPOSE 8080

# Run the API (which now serves the UI too)
CMD ["./api/bin/api"]
