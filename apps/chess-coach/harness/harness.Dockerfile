# --- Stage 1: Build harness ---
FROM eclipse-temurin:25-jdk-alpine AS builder
RUN apk add --no-cache bash
WORKDIR /app

COPY gradlew .
COPY gradle gradle/
COPY build.gradle.kts .
COPY settings.gradle.kts .
COPY src src/

RUN chmod +x gradlew && ./gradlew installDist --no-daemon

# --- Stage 2: Build lc0 v0.29.0 ---
FROM ubuntu:20.04 AS lc0-builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    g++ meson ninja-build git python3 libopenblas-dev pkg-config protobuf-compiler

WORKDIR /build
RUN git clone -b release/0.29 --recurse-submodules https://github.com/LeelaChessZero/lc0.git lc0-src

WORKDIR /build/lc0-src
RUN ./build.sh -Dgtest=false

# --- Stage 3: Final runtime ---
FROM eclipse-temurin:25-jdk-noble

RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y universe && \
    apt-get update && \
    apt-get install -y bash curl wget stockfish libopenblas0 zlib1g libstdc++6 libgcc-s1 p7zip-full && \
    rm -rf /var/lib/apt/lists/*

# Ubuntu installs games to /usr/games, which is not in the default PATH
RUN ln -s /usr/games/stockfish /usr/local/bin/stockfish

WORKDIR /app

# Copy the compiled lc0 binary
COPY --from=lc0-builder /build/lc0-src/build/release/lc0 /usr/local/bin/lc0
RUN ldconfig

# Download Maia weights
RUN mkdir -p /app/weights && \
    curl -fL -o /app/weights/maia-1100.pb.gz https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-1100.pb.gz && \
    curl -fL -o /app/weights/maia-1600.pb.gz https://github.com/CSSLab/maia-chess/releases/download/v1.0/maia-1600.pb.gz && \
    curl -fL -o /app/weights/maia-2200.pb.gz "https://github.com/CallOn84/LeelaNets/raw/main/Nets/Maia%202200/maia-2200.pb.gz" && \
    curl -fL -o /tmp/perfect.7z "https://github.com/gmcheems-org/free-opening-books/raw/main/books/multi/Perfect%202021.7z" && \
    7z e /tmp/perfect.7z "*.bin" -o/app/weights/ -r && \
    mv /app/weights/*.bin /app/weights/openings.bin && \
    rm /tmp/perfect.7z

# Download 3-4-5 piece Syzygy tablebases (approx 1GB)
RUN mkdir -p /app/syzygy && \
    wget -q -r -np -nd -A "*.rtbw,*.rtbz" https://tablebase.lichess.ovh/tables/standard/3-4-5/ -P /app/syzygy/

ENV SYZYGY_PATH="/app/syzygy"

# Copy built harness distribution
COPY --from=builder /app/build/install/chess-coach-harness ./harness

# Copy Skills directory for Context Injection
COPY skills ./skills

CMD ["./harness/bin/chess-coach-harness", "daemon"]
