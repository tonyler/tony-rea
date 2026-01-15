#!/bin/bash

set -e

echo "🚀 Starting Tony & Rea server..."
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Run ./scripts/install.sh first"
    exit 1
fi

# Check if OPENAI_API_KEY is set
source .env
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    echo "❌ Error: OPENAI_API_KEY not configured in .env"
    echo "   Please edit .env and add your OpenAI API key"
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
echo "▶️  Starting server on port ${PORT:-3000}..."
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
    echo ""
    echo "   PID: $SERVER_PID"
    echo "   URL: http://localhost:${PORT:-3000}"
    echo "   Logs: ./logs/server.log"
    echo ""
    echo "Run ./scripts/stop.sh to stop the server"
    echo "Run ./scripts/logs.sh to view logs"
    echo ""
else
    echo "❌ Error: Server failed to start"
    echo "   Check logs/server.log for details"
    rm tony-rea.pid
    exit 1
fi
