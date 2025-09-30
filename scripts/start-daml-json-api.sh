#!/bin/bash

# Start DAML JSON API proxy for Canton Quickstart LocalNet
# This handles JWT authentication automatically

echo "🚀 Starting DAML JSON API proxy..."

# Check if Canton Quickstart is running
if ! curl -s http://localhost:2975/v1/query > /dev/null 2>&1; then
    echo "❌ Canton Quickstart LocalNet is not running on port 2975"
    echo "Please start CN Quickstart first with: make up"
    exit 1
fi

echo "✅ Canton Quickstart LocalNet is running"

# Kill any existing daml json-api processes
pkill -f "daml json-api" || true

# Start daml json-api proxy
echo "🔧 Starting daml json-api proxy on port 7575..."
echo "This will proxy to Canton Quickstart on localhost:2975"

# Use daml json-api with unsafe auth for development
daml json-api \
  --ledger-host localhost \
  --ledger-port 2975 \
  --http-port 7575 \
  --allow-insecure-tokens \
  --auth-jwt-hs256-unsafe=unsafe &

DAML_API_PID=$!

echo "🔧 DAML JSON API proxy started with PID: $DAML_API_PID"
echo "📋 Proxy running on: http://localhost:7575"
echo "📋 Proxying to: http://localhost:2975"

# Wait a moment for startup
sleep 3

# Test the proxy
echo "🔍 Testing DAML JSON API proxy..."
if curl -s http://localhost:7575/v1/query -X POST -H "Content-Type: application/json" -d '{"templateIds": []}' > /dev/null; then
    echo "✅ DAML JSON API proxy is working!"
else
    echo "❌ DAML JSON API proxy test failed"
    kill $DAML_API_PID 2>/dev/null || true
    exit 1
fi

echo "🎉 DAML JSON API proxy is ready!"
echo "📋 Use http://localhost:7575 for DAML JSON API calls"
echo "📋 To stop: kill $DAML_API_PID"

# Keep the script running
wait $DAML_API_PID
