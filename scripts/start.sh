#!/bin/bash

set -e

# Always run from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🚀 Starting Tony & Rea server..."
echo ""

# Resolve port early
PORT_TO_USE=${PORT:-3001}

# If something is already bound to the port, handle it gracefully
EXISTING_PID=$(ss -ltnp "sport = :$PORT_TO_USE" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -n 1)
if [ -n "$EXISTING_PID" ]; then
    EXISTING_CMD=$(ps -p "$EXISTING_PID" -o cmd=)
    if echo "$EXISTING_CMD" | grep -q "backend/dist/server.js"; then
        echo "⚠️  Server already running on port $PORT_TO_USE (PID: $EXISTING_PID)"
        echo "$EXISTING_PID" > tony-rea.pid
        exit 0
    else
        echo "❌ Error: Port $PORT_TO_USE is already in use by another process (PID: $EXISTING_PID)"
        exit 1
    fi
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Run ./scripts/install.sh first"
    exit 1
fi

# Check required API keys
source .env
if [ -z "$PERPLEXITY_API_KEY" ]; then
    echo "❌ Error: PERPLEXITY_API_KEY not configured in .env"
    echo "   Please edit .env and add your Perplexity API key"
    exit 1
fi
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY not configured in .env"
    echo "   Please edit .env and add your Anthropic API key"
    exit 1
fi

# Create logs directory
mkdir -p logs

# Check if already running
if [ -f tony-rea.pid ]; then
    OLD_PID=$(cat tony-rea.pid)
    if ps -p $OLD_PID > /dev/null 2>&1; then
        echo "⚠️  Server is already running (PID: $OLD_PID)"
        echo "   Run ./scripts/stop.sh to stop it first"
        exit 1
    else
        echo "🧹 Cleaning up stale PID file..."
        rm tony-rea.pid
    fi
fi

# Set NODE_ENV to production if not set
if [ -z "$NODE_ENV" ]; then
    export NODE_ENV=production
fi

# Start server in background
echo "▶️  Starting server on port ${PORT_TO_USE}..."
cd backend
nohup node dist/server.js > ../logs/server.log 2>&1 &
SERVER_PID=$!
cd ..

# Save PID
echo $SERVER_PID > tony-rea.pid

# Wait a moment for server to start
sleep 2

# Check if still running
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "✅ Server started successfully!"
    echo "   PID: $SERVER_PID"
    echo "   URL: http://localhost:${PORT:-3001}"
    echo "   Logs: ./logs/server.log"
else
    echo "❌ Error: Server failed to start"
    echo "   Check logs/server.log for details"
    rm tony-rea.pid
    exit 1
fi

# Start Discord bot in background
echo ""
echo "▶️  Starting Discord bot..."
cd discord-bot
nohup node dist/index.js > ../logs/discord-bot.log 2>&1 &
BOT_PID=$!
cd ..

# Save bot PID
echo $BOT_PID > discord-bot.pid

# Wait a moment for bot to start
sleep 2

# Check if bot is still running
if ps -p $BOT_PID > /dev/null 2>&1; then
    echo "✅ Discord bot started successfully!"
    echo "   PID: $BOT_PID"
    echo "   Logs: ./logs/discord-bot.log"
else
    echo "⚠️  Discord bot failed to start"
    echo "   Check logs/discord-bot.log for details"
    rm -f discord-bot.pid
fi

echo ""
echo "Run ./scripts/stop.sh to stop all services"
echo "Run ./scripts/logs.sh to view logs"
echo ""
