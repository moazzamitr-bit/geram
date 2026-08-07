#!/bin/zsh
# Fix stuck Next.js on port 3000 for Gram
set -e
cd "$(dirname "$0")/.."
echo "Stopping processes on :3000 and :3020..."
for port in 3000 3020; do
  pids=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1
rm -rf .next
echo "Starting clean dev server on http://127.0.0.1:3000 ..."
npm run dev -- --port 3000 --hostname 127.0.0.1
