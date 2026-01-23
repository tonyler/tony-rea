#!/bin/bash

# Start Discord Bot Script
# This script starts the Discord knowledge bot

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DISCORD_BOT_DIR="$PROJECT_ROOT/discord-bot"

echo "Starting Discord Knowledge Bot..."

# Check if .env exists
if [ ! -f "$DISCORD_BOT_DIR/.env" ]; then
    echo "Error: .env file not found in discord-bot directory"
    echo "Copy .env.example to .env and configure it"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$DISCORD_BOT_DIR/node_modules" ]; then
    echo "Installing dependencies..."
    cd "$DISCORD_BOT_DIR"
    npm install
fi

# Check if shared package is built
if [ ! -d "$PROJECT_ROOT/shared/dist" ]; then
    echo "Building shared package..."
    cd "$PROJECT_ROOT/shared"
    npm install
    npm run build
fi

# Start the bot
cd "$DISCORD_BOT_DIR"

if [ "$1" = "--dev" ]; then
    echo "Starting in development mode..."
    npm run dev
else
    echo "Starting in production mode..."
    npm run build
    npm start
fi
