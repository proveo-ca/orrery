#!/bin/bash
set -e

echo "♟️ Welcome to Chess Coach!"

if ! command -v docker > /dev/null 2>&1; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

mkdir -p chess-coach-app && cd chess-coach-app

echo "📦 Downloading configuration..."
# Replace this URL with the Raw URL of the docker-compose.yml from your Gist!
curl -sSLO "https://gist.githubusercontent.com/schoettler/1f7b37e653a0cd4eb50454b9dca9c530/raw/43f26f47252a0ff49ac2f00abef09ea5d8db0f4d/docker-compose.yml"

echo "🚀 Starting Chess Coach..."
docker compose up -d

echo "✅ Chess Coach is starting up in the background!"
echo "🎮 Play here: http://localhost:8080"

TS_IP=$(tailscale ip -4 2>/dev/null || true)

if [ -z "$TS_IP" ]; then
  echo -e "\n❌ Tailscale is not running or not installed."
  echo -e "Please install it from https://tailscale.com/download/mac, log in, and try again.\n"
else
  echo -e "\n♟️  Chess Coach - Tailscale Secure Access"
  echo -e "========================================="
  echo -e "1. Install the 'Tailscale' app on your phone."
  echo -e "2. Log in with the EXACT SAME account you used on this Mac."
  echo -e "3. Ensure the VPN is 'Active' on your phone."
  echo -e "4. Scan this QR code with your phone's camera:\n"

  curl -s "https://qrenco.de/http://$TS_IP:8080"

  echo -e "\nOr manually open: http://$TS_IP:8080\n"
fi
