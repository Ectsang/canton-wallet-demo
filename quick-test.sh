#!/bin/bash
# Quick connectivity test for Canton Wallet Demo

API="http://localhost:8899"

echo "🔍 Canton Wallet Demo - Quick Test"
echo ""

# Test 1: Backend health
echo "1. Backend health check..."
curl -sf "$API/api/health" | jq . || echo "❌ Backend not running (run: npm run server:start)"
echo ""

# Test 2: CN Quickstart status
echo "2. CN Quickstart connection status..."
curl -sf "$API/api/cn/status" | jq . || echo "❌ CN Quickstart not accessible"
echo ""

# Test 3: Initialize
echo "3. Initialize CN Quickstart..."
curl -sf -X POST "$API/api/cn/init" -H "Content-Type: application/json" -d '{}' | jq . || echo "❌ Initialization failed"
echo ""

echo "✅ Quick test complete!"
echo ""
echo "To run full flow test: ./test-flow.sh"