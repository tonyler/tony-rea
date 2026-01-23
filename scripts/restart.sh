#!/bin/bash

echo "🔄 Restarting Tony & Rea server..."
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Stop server
"$SCRIPT_DIR/stop.sh"

echo ""

# Start server
"$SCRIPT_DIR/start.sh"
