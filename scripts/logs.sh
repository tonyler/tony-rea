#!/bin/bash

# Always run from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

LOG_FILE="logs/server.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log file not found: $LOG_FILE"
    echo "   Server may not have been started yet"
    exit 1
fi

echo "📋 Tailing logs from $LOG_FILE"
echo "   (Press Ctrl+C to stop)"
echo ""

tail -f "$LOG_FILE"
