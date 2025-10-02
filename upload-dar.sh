#!/bin/bash
# Upload MinimalToken DAR to Canton app-provider

set -e

DAR_PATH="daml/minimal-token/minimal-token.dar"

echo "📦 Uploading $DAR_PATH to app-provider participant..."

# Generate JWT for app-provider party
PARTY="app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad"
PAYLOAD='{"sub":"'"$PARTY"'","aud":"https://canton.network.global"}'
HEADER='{"alg":"HS256","typ":"JWT"}'

# Create JWT
HEADER_B64=$(echo -n "$HEADER" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
PAYLOAD_B64=$(echo -n "$PAYLOAD" | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
SIGNATURE=$(echo -n "${HEADER_B64}.${PAYLOAD_B64}" | openssl dgst -sha256 -hmac "unsafe" -binary | base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n')
JWT="${HEADER_B64}.${PAYLOAD_B64}.${SIGNATURE}"

echo "🔑 Generated JWT for party: ${PARTY:0:50}..."

# Upload DAR via JSON API
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  "http://localhost:3975/v2/packages/upload" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@$DAR_PATH")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')

echo "📋 Response code: $HTTP_CODE"
echo "📋 Response body: $BODY"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
  echo "✅ DAR uploaded successfully!"

  # Extract package ID from manifest
  PACKAGE_ID=$(unzip -p "$DAR_PATH" META-INF/MANIFEST.MF | grep "Main-Dalf:" | awk '{print $2}' | cut -d'-' -f5)
  echo "📦 Package ID: $PACKAGE_ID"
  echo ""
  echo "⚠️  Update this package ID in src/services/cnQuickstartLedgerService.js"
else
  echo "❌ Upload failed!"
  exit 1
fi
