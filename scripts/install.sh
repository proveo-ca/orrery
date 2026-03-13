#!/bin/bash
set -e

echo "♟️ Welcome to Chess Coach!"

if ! command -v docker > /dev/null 2>&1; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

mkdir -p chess-coach-app && cd chess-coach-app

OS="$(uname -s)"
MODEL_COMMENTARY="hf.co/NAKSTStudio/chess-gemma-commentary:Q8_0"

if [ "$OS" = "Darwin" ]; then
    echo "🍎 macOS detected. Configuring native Ollama for Metal GPU acceleration..."
    
    if ! command -v ollama > /dev/null 2>&1; then
        echo "📥 Installing Ollama for macOS..."
        curl -fsSL https://ollama.com/install.sh | sh
    fi

    # Ensure Ollama is running
    if ! curl -s http://localhost:11434/api/tags > /dev/null; then
        echo "🚀 Starting Ollama server in the background..."
        ollama serve > /dev/null 2>&1 &
        sleep 5
    fi

    echo "📥 Pulling LLM models natively: $MODEL_COMMENTARY (this may take a while)..."
    ollama pull $MODEL_COMMENTARY

    echo "📦 Generating macOS-optimized docker-compose.yml..."
    cat <<EOF > docker-compose.yml
services:
  app:
    build:
      context: ../projects/chess-coach
      dockerfile: Dockerfile
    container_name: chess_coach
    ports:
      - "8080:8080"
    environment:
      - OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
      - LLM_GENERAL_MODEL=$MODEL_GENERAL
      - LLM_COMMENTARY_MODEL=$MODEL_COMMENTARY
      - CHESS_STATE_DIR=/data
    volumes:
      - chess_state:/data
    restart: unless-stopped

volumes:
  chess_state:
EOF

else
    echo "🐧 Linux/Windows detected. Configuring Dockerized Ollama with NVIDIA GPU passthrough..."
    
    echo "📦 Generating standard docker-compose.yml..."
    cat <<EOF > docker-compose.yml
services:
  llm:
    image: ollama/ollama:latest
    container_name: gemma_llm
    ports:
      - "11434:11434"
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - LLM_GENERAL_MODEL=$MODEL_GENERAL
      - LLM_COMMENTARY_MODEL=$MODEL_COMMENTARY
    volumes:
      - ollama_data:/root/.ollama
    entrypoint: ["/bin/sh", "-c"]
    command: ["ollama serve & sleep 5 && ollama pull \$\$LLM_GENERAL_MODEL && ollama pull \$\$LLM_COMMENTARY_MODEL && touch /tmp/models_ready && wait"]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "test -f /tmp/models_ready || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 15s

  app:
    build:
      context: ../projects/chess-coach
      dockerfile: Dockerfile
    container_name: chess_coach
    ports:
      - "8080:8080"
    environment:
      - OLLAMA_BASE_URL=http://gemma_llm:11434/v1
      - LLM_GENERAL_MODEL=$MODEL_GENERAL
      - LLM_COMMENTARY_MODEL=$MODEL_COMMENTARY
      - CHESS_STATE_DIR=/data
    volumes:
      - chess_state:/data
    depends_on:
      llm:
        condition: service_healthy
    restart: unless-stopped

volumes:
  ollama_data:
  chess_state:
EOF
fi

echo "🚀 Starting Chess Coach..."
docker compose up -d --build

echo "✅ Chess Coach is starting up in the background!"
echo "🎮 Play here: http://localhost:8080"

TS_IP=$(tailscale ip -4 2>/dev/null || true)

if [ -z "$TS_IP" ]; then
  echo -e "\n📱 Want to play from your phone?"
  echo -e "Tailscale is not running or not installed."
  echo -e "If you want secure remote access to play on your mobile device, install it from https://tailscale.com/download, log in, and run this script again.\n"
else
  echo -e "\n♟️  Chess Coach - Tailscale Secure Access"
  echo -e "========================================="
  echo -e "1. Install the 'Tailscale' app on your phone."
  echo -e "2. Log in with the EXACT SAME account you used on this machine."
  echo -e "3. Ensure the VPN is 'Active' on your phone."
  echo -e "4. Scan this QR code with your phone's camera:\n"

  curl -s "https://qrenco.de/http://$TS_IP:8080"

  echo -e "\nOr manually open: http://$TS_IP:8080\n"
fi
