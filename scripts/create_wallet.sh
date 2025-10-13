#!/bin/bash
set -e

PARTY_HINT="$1"

# Generate JWT token for authentication
generate_jwt() {
  node -e "
const crypto = require('crypto');
const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  sub:'ledger-api-user',
  aud:'https://canton.network.global',
  exp:Math.floor(Date.now()/1000)+3600,
  iat:Math.floor(Date.now()/1000)
})).toString('base64url');
const sig = crypto.createHmac('sha256','unsafe').update(header+'.'+payload).digest('base64url');
console.log(header+'.'+payload+'.'+sig);
"
}

TOKEN=$(generate_jwt)

echo "=== Step 1: Allocate Party via JSON Ledger API ===" >&2

# Allocate party via JSON Ledger API on app-user participant (port 2975)
PARTY_RESPONSE=$(curl -s -X POST http://localhost:2975/v2/parties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"partyIdHint\":\"${PARTY_HINT}\",\"identityProviderId\":\"\"}")

PARTY_ID=$(echo "$PARTY_RESPONSE" | grep -o "\"party\":\"${PARTY_HINT}::[^\"]*" | sed 's/"party":"//')

if [ -z "$PARTY_ID" ]; then
  echo "Failed to allocate party. Response: $PARTY_RESPONSE" >&2
  exit 1
fi

echo "Party allocated: $PARTY_ID" >&2

echo "=== Step 2: Grant actAs Rights ===" >&2

# Grant actAs rights via gRPC User Management Service
grpcurl -plaintext \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"user_id\":\"ledger-api-user\",\"rights\":[{\"can_act_as\":{\"party\":\"${PARTY_ID}\"}}]}" \
  localhost:2901 \
  com.daml.ledger.api.v2.admin.UserManagementService/GrantUserRights >/dev/null 2>&1

echo "actAs rights granted" >&2

echo "=== Step 3: Grant readAs Rights for Admin Party ===" >&2

# Get admin party ID
ADMIN_PARTY=$(bash scripts/get_app_provider_party.sh)
echo "Admin party: $ADMIN_PARTY" >&2

# Grant readAs rights for admin party
grpcurl -plaintext \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"user_id\":\"ledger-api-user\",\"rights\":[{\"can_read_as\":{\"party\":\"${ADMIN_PARTY}\"}}]}" \
  localhost:2901 \
  com.daml.ledger.api.v2.admin.UserManagementService/GrantUserRights >/dev/null 2>&1

echo "readAs rights granted for admin" >&2

echo "=== Success ===" >&2
echo "$PARTY_ID"
