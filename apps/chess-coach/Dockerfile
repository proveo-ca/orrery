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

# --- Stage 3: Build lc0 with ONNX ---
FROM ubuntu:24.04 AS lc0-builder
ARG TARGETARCH
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    curl g++ meson ninja-build git python3 libopenblas-dev pkg-config

WORKDIR /build
# Download ONNX Runtime C++ libraries based on architecture
RUN if [ "$TARGETARCH" = "arm64" ]; then \
        curl -L -o onnxruntime.tgz https://github.com/microsoft/onnxruntime/releases/download/v1.17.1/onnxruntime-linux-aarch64-1.17.1.tgz && \
        tar -xzf onnxruntime.tgz && \
        mv onnxruntime-linux-aarch64-1.17.1 /build/onnxruntime; \
    else \
        curl -L -o onnxruntime.tgz https://github.com/microsoft/onnxruntime/releases/download/v1.17.1/onnxruntime-linux-x64-1.17.1.tgz && \
        tar -xzf onnxruntime.tgz && \
        mv onnxruntime-linux-x64-1.17.1 /build/onnxruntime; \
    fi

# Download lc0 0.32
RUN curl -L -o lc0.tar.gz https://api.github.com/repos/LeelaChessZero/lc0/tarball/release/0.32 && \
    mkdir lc0-src && tar -xzf lc0.tar.gz -C lc0-src --strip-components=1

WORKDIR /build/lc0-src
# Build lc0 with ONNX support linked (Ubuntu 24.04 uses GCC 13 which supports std::format)
RUN ./build.sh -Dgtest=false -Donnx_include=/build/onnxruntime/include -Donnx_libdir=/build/onnxruntime/lib

# --- Stage 4: Final Runtime ---
FROM eclipse-temurin:25-jdk-noble
RUN apt-get update && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y universe && \
    apt-get update && \
    apt-get install -y bash curl stockfish libopenblas0 zlib1g && \
    rm -rf /var/lib/apt/lists/*

# Ubuntu installs games to /usr/games, which is not in the default PATH
RUN ln -s /usr/games/stockfish /usr/local/bin/stockfish

WORKDIR /app

# Copy the compiled lc0 binary and the ONNX runtime shared libraries
COPY --from=lc0-builder /build/lc0-src/build/release/lc0 /usr/local/bin/lc0
COPY --from=lc0-builder /build/onnxruntime/lib/libonnxruntime.so* /usr/lib/
RUN ldconfig

RUN mkdir -p /app/weights && \
    curl -fL -o /app/weights/maia-1100.onnx https://huggingface.co/shermansiu/maia-1100/resolve/main/model.onnx && \
    curl -fL -o /app/weights/maia-1600.onnx https://huggingface.co/shermansiu/maia-1600/resolve/main/model.onnx && \
    curl -fL -o /app/weights/maia-2200.onnx https://huggingface.co/shermansiu/maia-2200/resolve/main/model.onnx && \
    for f in /app/weights/*.onnx; do \
        size=$(wc -c < "$f"); \
        if [ "$size" -lt 1000000 ]; then \
            echo "Error: $f is too small ($size bytes). Likely an HTML page or LFS pointer."; \
            cat "$f"; \
            exit 1; \
        fi; \
    done

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
