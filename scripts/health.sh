#!/bin/bash

# Always run from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load .env to get PORT
if [ -f .env ]; then
    source .env
fi

PORT=${PORT:-3000}

echo "🏥 Checking server health..."
echo ""

# Make health check request
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:$PORT/api/health)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "Response:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Server is healthy (HTTP $HTTP_CODE)"
    exit 0
else
    echo "❌ Server is unhealthy (HTTP $HTTP_CODE)"
    exit 1
fi
