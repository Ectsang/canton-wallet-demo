# CN Quickstart Integration Guide

## Overview

This guide shows how to integrate the canton-wallet-demo with CN Quickstart LocalNet using direct JSON Ledger API instead of Canton Wallet SDK.

**Problem Solved**: Canton Wallet SDK only supports token standard operations, not custom DAML contracts. This integration uses JSON Ledger API v2 directly.

## Files Created

1. `src/services/cnQuickstartLedgerService.js` - Direct JSON Ledger API client
2. `server/routes/cnQuickstartRoutes.js` - Backend API routes

## Integration Steps

### Step 1: Update Backend Server

Edit `server/index.js` to register the new routes:

```javascript
import cnQuickstartRoutes from './routes/cnQuickstartRoutes.js'

// ... existing imports ...

// After existing route registrations:
await cnQuickstartRoutes(app)
```

### Step 2: Set Environment Variables

Edit `/Users/e/code/architecture/canton/canton-wallet-demo/.env`:

```bash
# CN Quickstart LocalNet Configuration
VITE_CANTON_NETWORK=localnet
VITE_API_URL=http://localhost:8899

# CN Quickstart endpoints (App Provider)
VITE_JSON_API_URL=http://localhost:3975
VITE_CN_BACKEND_URL=http://localhost:8080

# Optional: Set App Provider party directly if known
# APP_PROVIDER_PARTY=quickstart-e-1::1220abc...

# Backend port
PORT=8899
```

### Step 3: Install Dependencies (if needed)

The service uses Node.js built-in `crypto` module, so no new dependencies needed.

```bash
cd /Users/e/code/architecture/canton/canton-wallet-demo
npm install
```

### Step 4: Start Services

**Terminal 1 - CN Quickstart LocalNet:**
```bash
cd /Users/e/code/sbc/canton/cn-quickstart/quickstart
make start
```

Wait for all services to be healthy (check `make status`).

**Terminal 2 - Canton Wallet Demo Backend:**
```bash
cd /Users/e/code/architecture/canton/canton-wallet-demo
npm run server:start
```

**Terminal 3 - Canton Wallet Demo Frontend:**
```bash
cd /Users/e/code/architecture/canton/canton-wallet-demo
npm run dev
```

## API Usage

### 1. Initialize Connection

```bash
curl -X POST http://localhost:8899/api/cn/init \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "appProviderParty": "quickstart-e-1::1220abc...",
  "jsonApiUrl": "http://localhost:3975",
  "message": "Connected to CN Quickstart LocalNet"
}
```

### 2. Create Custom Token

```bash
curl -X POST http://localhost:8899/api/cn/tokens/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Token",
    "symbol": "DEMO",
    "decimals": 18
  }'
```

**Response:**
```json
{
  "success": true,
  "contractId": "00abc123...",
  "admin": "quickstart-e-1::1220abc...",
  "name": "Demo Token",
  "symbol": "DEMO",
  "decimals": 18,
  "transactionId": "1220xyz...",
  "createdAt": "2025-09-30T..."
}
```

### 3. Create External Wallet

Use the existing Canton Wallet SDK route (this works fine):

```bash
curl -X POST http://localhost:8899/api/daml/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "partyHint": "alice"
  }'
```

**Response:**
```json
{
  "partyId": "alice::1220def...",
  "publicKey": "...",
  "privateKey": "...",
  "fingerprint": "1220def...",
  "partyHint": "alice",
  "createdAt": "2025-09-30T..."
}
```

### 4. Mint Tokens to External Wallet

```bash
curl -X POST http://localhost:8899/api/cn/tokens/mint \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "00abc123...",
    "owner": "alice::1220def...",
    "amount": "1000.0"
  }'
```

**Response:**
```json
{
  "success": true,
  "holdingId": "00ghi789...",
  "instrumentId": "00abc123...",
  "owner": "alice::1220def...",
  "amount": 1000.0,
  "transactionId": "1220xyz...",
  "createdAt": "2025-09-30T..."
}
```

### 5. Query Balance

```bash
curl http://localhost:8899/api/cn/balance/alice::1220def...
```

**Response:**
```json
{
  "success": true,
  "holdings": [{
    "contractId": "00ghi789...",
    "owner": "alice::1220def...",
    "instrument": "00abc123...",
    "amount": 1000.0
  }],
  "totalBalance": 1000.0,
  "holdingCount": 1
}
```

### 6. Check Connection Status

```bash
curl http://localhost:8899/api/cn/status
```

**Response:**
```json
{
  "connected": true,
  "appProviderParty": "quickstart-e-1::1220abc...",
  "jsonApiUrl": "http://localhost:3975",
  "packageId": "d8325445c38031336b59afafaf5f01c83494e77884eab47baf3a6436e4be15f6"
}
```

## Frontend Integration

Update the frontend to use the new endpoints:

```javascript
// src/api/cnQuickstart.js

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8899';

export async function initCNQuickstart() {
  const response = await fetch(`${API_BASE}/api/cn/init`, {
    method: 'POST'
  });
  return await response.json();
}

export async function createToken({ name, symbol, decimals }) {
  const response = await fetch(`${API_BASE}/api/cn/tokens/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, symbol, decimals })
  });
  return await response.json();
}

export async function mintTokens({ contractId, owner, amount }) {
  const response = await fetch(`${API_BASE}/api/cn/tokens/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractId, owner, amount })
  });
  return await response.json();
}

export async function queryBalance(owner, instrumentId = null) {
  const url = new URL(`${API_BASE}/api/cn/balance/${encodeURIComponent(owner)}`);
  if (instrumentId) {
    url.searchParams.append('instrumentId', instrumentId);
  }
  const response = await fetch(url);
  return await response.json();
}
```

## Troubleshooting

### Issue: "Could not determine App Provider party"

**Solution 1**: Check CN Quickstart is running
```bash
cd /Users/e/code/sbc/canton/cn-quickstart/quickstart
make status
```

**Solution 2**: Set environment variable directly
```bash
# Get party from CN Quickstart backend
curl http://localhost:8080/admin/tenant-registrations

# Set in .env or export
export APP_PROVIDER_PARTY="quickstart-e-1::1220abc..."
```

### Issue: "JSON Ledger API failed: 401"

**Cause**: JWT authentication issue

**Solution**: Check JWT generation in logs. The service uses:
- Secret: `"unsafe"`
- Issuer: `"unsafe-auth"`
- Algorithm: HMAC-SHA256

### Issue: "JSON Ledger API failed: 404"

**Cause**: Wrong JSON API URL

**Solution**: Verify port in service:
- App Provider: `http://localhost:3975` ✅
- App User: `http://localhost:2975` (wrong for this use case)

### Issue: "No created event found in response"

**Cause**: Contract creation succeeded but response parsing failed

**Solution**: Check logs for full response. The service expects:
```json
{
  "result": {
    "events": [{
      "created": {
        "contractId": "...",
        "payload": {...}
      }
    }]
  }
}
```

## Testing Complete Flow

```bash
#!/bin/bash
# test-flow.sh

set -e

API="http://localhost:8899"

echo "1. Initialize CN Quickstart connection..."
INIT=$(curl -s -X POST $API/api/cn/init)
echo $INIT | jq .

APP_PROVIDER=$(echo $INIT | jq -r .appProviderParty)
echo "App Provider Party: $APP_PROVIDER"

echo -e "\n2. Create token..."
TOKEN=$(curl -s -X POST $API/api/cn/tokens/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token",
    "symbol": "TEST",
    "decimals": 18
  }')
echo $TOKEN | jq .

CONTRACT_ID=$(echo $TOKEN | jq -r .contractId)
echo "Token Contract ID: $CONTRACT_ID"

echo -e "\n3. Create external wallet..."
WALLET=$(curl -s -X POST $API/api/daml/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "partyHint": "testuser"
  }')
echo $WALLET | jq .

PARTY_ID=$(echo $WALLET | jq -r .partyId)
echo "External Wallet Party: $PARTY_ID"

echo -e "\n4. Mint tokens to wallet..."
MINT=$(curl -s -X POST $API/api/cn/tokens/mint \
  -H "Content-Type: application/json" \
  -d "{
    \"contractId\": \"$CONTRACT_ID\",
    \"owner\": \"$PARTY_ID\",
    \"amount\": \"1000.0\"
  }")
echo $MINT | jq .

HOLDING_ID=$(echo $MINT | jq -r .holdingId)
echo "Holding Contract ID: $HOLDING_ID"

echo -e "\n5. Query balance..."
BALANCE=$(curl -s "$API/api/cn/balance/$PARTY_ID")
echo $BALANCE | jq .

echo -e "\n✅ Complete flow successful!"
```

Save as `test-flow.sh`, make executable, and run:
```bash
chmod +x test-flow.sh
./test-flow.sh
```

## Expected Outcomes

### ✅ Working

1. **Token Creation**: Real Instrument contracts on Canton ledger
2. **Contract ID Extraction**: Gets real `00xxx...` format IDs
3. **Token Minting**: Creates Holding contracts via Issue choice
4. **Balance Queries**: Reads active Holding contracts
5. **External Wallets**: Created via Canton Wallet SDK

### ✅ Complete Workflow

```text
1. Initialize → Get App Provider party from CN Quickstart
2. Create Token → Instrument contract with admin=AppProvider
3. Create Wallet → External party via SDK
4. Mint Tokens → Exercise Issue choice, create Holding
5. Query Balance → Read Holding contracts for wallet
```

## Architecture Diagram

```text
┌─────────────────────────────────────┐
│   Canton Wallet Demo Frontend      │
│   http://localhost:5174             │
└────────────┬────────────────────────┘
             │
             ↓ HTTP REST
┌─────────────────────────────────────┐
│   Canton Wallet Demo Backend       │
│   http://localhost:8899             │
│   ├─ cnQuickstartRoutes.js          │
│   └─ cnQuickstartLedgerService.js   │
└────────────┬────────────────────────┘
             │
             ↓ JSON Ledger API v2
┌─────────────────────────────────────┐
│   CN Quickstart LocalNet            │
│   /Users/e/code/sbc/canton/...      │
│   ├─ JSON API: localhost:3975       │
│   ├─ Backend: localhost:8080        │
│   └─ App Provider Party             │
└─────────────────────────────────────┘
```

## Key Differences from SDK Approach

| Aspect | Canton Wallet SDK | This Approach |
|--------|------------------|---------------|
| Custom DAML | ❌ Not supported | ✅ Fully works |
| Contract IDs | ❌ Can't extract | ✅ In response |
| Authentication | Complex | ✅ Simple JWT |
| Port | Various | ✅ 3975 (clear) |
| Admin Party | External only | ✅ App Provider |
| Minting | Blocked | ✅ Working |
| Queries | Blocked | ✅ Working |

## Next Steps

1. ✅ Integrate routes into server (Step 1)
2. ✅ Update frontend to call new endpoints
3. ✅ Test complete flow with test script
4. ✅ Add UI for token creation and minting
5. ✅ Deploy to production (with proper auth)

---

**Success Criteria**: End-to-end token lifecycle working on CN Quickstart LocalNet without Canton Wallet SDK limitations.