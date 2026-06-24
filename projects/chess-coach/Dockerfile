# --- Stage 1: Build UI (desktop target → HttpCoachService) ---
FROM node:22-alpine AS ui-builder
# Mirror the repo layout so the Vite/tsconfig alias
# `@chess-coach/engine-core` → ../../packages/engine-core/src resolves.
WORKDIR /work/apps/ui
COPY apps/ui/package.json ./
RUN npm install
COPY apps/ui/ ./
COPY packages/ /work/packages/
RUN npm run build:desktop

# --- Stage 2: Build lc0 v0.29.0 ---
FROM ubuntu:20.04 AS lc0-builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    g++ meson ninja-build git python3 libopenblas-dev pkg-config protobuf-compiler

WORKDIR /build
# Clone with submodules to fix the protobuf parsing error!
RUN git clone -b release/0.29 --recurse-submodules https://github.com/LeelaChessZero/lc0.git lc0-src

WORKDIR /build/lc0-src
RUN ./build.sh -Dgtest=false

# --- Stage 3: Final Runtime (Bun + native engines) ---
FROM ubuntu:24.04 AS runtime
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y universe && \
    apt-get update && \
    apt-get install -y bash curl wget stockfish libopenblas0 zlib1g libstdc++6 libgcc-s1 p7zip-full ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Ubuntu installs games to /usr/games, which is not in the default PATH
RUN ln -s /usr/games/stockfish /usr/local/bin/stockfish

# Bun runtime (the server runs TypeScript directly; no build/install step,
# the server has no runtime npm dependencies).
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun

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

# Download 3-4-5 piece Syzygy tablebases (approx 1GB)
RUN mkdir -p /app/syzygy && \
    wget -q -r -np -nd -A "*.rtbw" https://tablebase.lichess.ovh/tables/standard/3-4-5-wdl/ -P /app/syzygy/ && \
    wget -q -r -np -nd -A "*.rtbz" https://tablebase.lichess.ovh/tables/standard/3-4-5-dtz/ -P /app/syzygy/

ENV SYZYGY_PATH="/app/syzygy"

# Bun server (in-process orchestrator) + shared engine-core. Preserve the
# ../../packages/engine-core relative layout that server/tsconfig.json paths expect.
COPY apps/server/package.json apps/server/tsconfig.json ./server/
COPY apps/server/src ./server/src
COPY packages ./packages

# Compiled UI → /app/static/chess (served by the Bun server under /chess/)
COPY --from=ui-builder /work/apps/ui/dist ./static

EXPOSE 8080

# Run the Bun server (serves the UI and orchestrates native Stockfish + Maia + Ollama)
CMD ["bun", "run", "/app/server/src/main.ts"]
