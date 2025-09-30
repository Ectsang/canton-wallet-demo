#!/bin/bash

# Configure CN Quickstart LocalNet for proper DAML JSON API authentication
# This script addresses the 401 Unauthorized issues with JWT tokens

echo "🔧 Configuring CN Quickstart LocalNet Authentication..."

# Check if CN Quickstart is running
if ! curl -s http://localhost:2975/v2/health > /dev/null; then
    echo "❌ CN Quickstart LocalNet is not running on port 2975"
    echo "Please start CN Quickstart first with: make up"
    exit 1
fi

echo "✅ CN Quickstart LocalNet is running"

# Test current authentication status
echo "🔍 Testing current authentication status..."

# Test with a simple query to see what authentication is expected
echo "🔍 Testing query endpoint to understand authentication requirements..."
QUERY_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:2975/v2/query \
  -H "Content-Type: application/json" \
  -d '{"templateIds": []}' 2>&1)
echo "Query response: $QUERY_RESPONSE"

echo "🔧 Authentication configuration analysis complete."
echo "📋 Next steps:"
echo "1. Check CN Quickstart configuration files for JWT secret"
echo "2. Verify participant ID and ledger ID match"
echo "3. Consider using daml json-api command to generate proper tokens"
echo "4. Check if unsafe mode is properly enabled"