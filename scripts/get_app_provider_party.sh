#!/bin/bash
# Get app-provider party ID from Canton LocalNet via Ledger API
# Uses the proper gRPC PartyManagementService.ListKnownParties method
#
# This is the RELIABLE way to get the party ID, as recommended by Canton docs.
# Works on first startup without needing any prior transactions.

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

# Generate token
TOKEN=$(generate_jwt)

# Query known parties via gRPC Ledger API (port 3901 for app-provider participant)
# Returns JSON with party_details array
grpcurl -plaintext \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}' \
  localhost:3901 \
  com.daml.ledger.api.v2.admin.PartyManagementService/ListKnownParties 2>/dev/null \
  | grep -A 1 '"party": "app_provider_quickstart' \
  | grep '"party"' \
  | sed 's/.*"party": "\([^"]*\)".*/\1/' \
  | head -1
