#!/bin/bash

# Always run from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🛑 Stopping Tony & Rea services..."
echo ""

stop_process() {
    local PID_FILE=$1
    local NAME=$2
    local FALLBACK_PATTERN=$3

    if [ ! -f "$PID_FILE" ]; then
        if [ -n "$FALLBACK_PATTERN" ]; then
            PID=$(pgrep -f "$FALLBACK_PATTERN" | head -n 1)
            if [ -n "$PID" ]; then
                echo "⚠️  No PID file for $NAME, using detected PID $PID"
            else
                echo "⚠️  No PID file for $NAME"
                return 0
            fi
        else
            echo "⚠️  No PID file for $NAME"
            return 0
        fi
    else
        PID=$(cat "$PID_FILE")
    fi

    if ! ps -p $PID > /dev/null 2>&1; then
        if [ -n "$FALLBACK_PATTERN" ]; then
            FALLBACK_PID=$(pgrep -f "$FALLBACK_PATTERN" | head -n 1)
            if [ -n "$FALLBACK_PID" ]; then
                echo "⚠️  $NAME PID file is stale (PID $PID), using detected PID $FALLBACK_PID"
                PID=$FALLBACK_PID
            else
                echo "⚠️  $NAME (PID $PID) is not running"
                if [ -f "$PID_FILE" ]; then
                    rm "$PID_FILE"
                fi
                return 0
            fi
        else
            echo "⚠️  $NAME (PID $PID) is not running"
            if [ -f "$PID_FILE" ]; then
                rm "$PID_FILE"
            fi
            return 0
        fi
    fi

    echo "▶️  Stopping $NAME (PID $PID)..."
    kill $PID

    for i in {1..10}; do
        if ! ps -p $PID > /dev/null 2>&1; then
            echo "✅ $NAME stopped successfully"
            if [ -f "$PID_FILE" ]; then
                rm "$PID_FILE"
            fi
            return 0
        fi
        sleep 1
    done

    if ps -p $PID > /dev/null 2>&1; then
        echo "⚠️  $NAME didn't stop gracefully, forcing..."
        kill -9 $PID
        sleep 1
    fi

    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
    fi
    echo "✅ $NAME stopped"
}

# Stop Discord bot first
stop_process "discord-bot.pid" "Discord bot" "node .*discord-bot/dist/index.js"

# Stop main server
stop_process "tony-rea.pid" "Server" "node .*backend/dist/server.js"

echo ""
echo "✅ All services stopped"
