#!/bin/bash
# Helper script to get the current app_provider party ID from Canton

echo "🔍 Fetching app_provider party ID from Canton LocalNet..."
echo ""

# Extract from Canton logs
PARTY_ID=$(docker logs canton 2>&1 | grep "app_provider_quickstart-e-1::" | tail -1 | grep -o "app_provider_quickstart-e-1::[a-f0-9]*" | head -1)

if [ -n "$PARTY_ID" ]; then
    echo "✅ Found app_provider party:"
    echo "   $PARTY_ID"
    echo ""
    echo "💡 To set as environment variable:"
    echo "   export APP_PROVIDER_PARTY=\"$PARTY_ID\""
else
    echo "❌ Could not find app_provider party in Canton logs"
    echo "⚠️  Make sure Canton LocalNet is running"
fi
