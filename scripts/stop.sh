#!/bin/bash

echo "🛑 Stopping Tony & Rea server..."
echo ""

# Check if PID file exists
if [ ! -f tony-rea.pid ]; then
    echo "⚠️  No PID file found. Server may not be running."
    exit 0
fi

# Read PID
PID=$(cat tony-rea.pid)

# Check if process is running
if ! ps -p $PID > /dev/null 2>&1; then
    echo "⚠️  Process $PID is not running"
    echo "🧹 Cleaning up PID file..."
    rm tony-rea.pid
    exit 0
fi

# Kill process
echo "▶️  Stopping process $PID..."
kill $PID

# Wait for process to stop
for i in {1..10}; do
    if ! ps -p $PID > /dev/null 2>&1; then
        echo "✅ Server stopped successfully"
        rm tony-rea.pid
        exit 0
    fi
    sleep 1
done

# Force kill if still running
if ps -p $PID > /dev/null 2>&1; then
    echo "⚠️  Process didn't stop gracefully, forcing..."
    kill -9 $PID
    sleep 1
fi

# Clean up
rm tony-rea.pid
echo "✅ Server stopped"
