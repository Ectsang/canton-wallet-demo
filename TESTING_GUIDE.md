# Testing Guide

## Integration Status

**✅ COMPLETE** - All routes integrated, services implemented, ready for testing.

The CN Quickstart integration routes are registered in `server/index.js:51` and use the gRPC service implementation.

## Prerequisites

1. **CN Quickstart LocalNet** must be running
2. **Backend server** must be running on port 8899
3. **jq** installed for JSON parsing (optional but recommended)

## Quick Start

### Step 1: Start CN Quickstart LocalNet

```bash
cd /Users/e/code/sbc/canton/cn-quickstart/quickstart
make start

# Verify services are healthy
make status
```

Wait until all services show as "healthy".

### Step 2: Start Backend Server

```bash
cd /Users/e/code/architecture/canton/canton-wallet-demo
npm run server:start
```

Backend will start on http://localhost:8899

### Step 3: Run Quick Test

```bash
./quick-test.sh
```

This tests:
- Backend health
- CN Quickstart connectivity
- Initialization

### Step 4: Run Full Flow Test

```bash
./test-flow.sh
```

This tests the complete workflow:
1. Initialize connection
2. Create custom token
3. Create external wallet
4. Mint tokens
5. Query balance

## Manual Testing

### 1. Check Backend Health

```bash
curl http://localhost:8899/api/health | jq
```

Expected output:
```json
{
  "status": "ok",
  "sdk": "not-initialized",
  "time": "2025-09-30T..."
}
```

### 2. Initialize CN Quickstart Connection

```bash
curl -X POST http://localhost:8899/api/cn/init | jq
```

Expected output:
```json
{
  "success": true,
  "appProviderParty": "quickstart-e-1::1220abc...",
  "jsonApiUrl": "http://localhost:3975",
  "message": "Connected to CN Quickstart LocalNet"
}
```

### 3. Check Connection Status

```bash
curl http://localhost:8899/api/cn/status | jq
```

Expected output:
```json
{
  "connected": true,
  "appProviderParty": "quickstart-e-1::1220abc...",
  "jsonApiUrl": "http://localhost:3975",
  "packageId": "d8325445c38031336b59afafaf5f01c83494e77884eab47baf3a6436e4be15f6"
}
```

### 4. Create Custom Token

```bash
curl -X POST http://localhost:8899/api/cn/tokens/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Token",
    "symbol": "MYT",
    "decimals": 18
  }' | jq
```

Expected output:
```json
{
  "success": true,
  "contractId": "00abc123...",
  "admin": "quickstart-e-1::1220abc...",
  "name": "My Token",
  "symbol": "MYT",
  "decimals": 18,
  "transactionId": "1220xyz...",
  "createdAt": "2025-09-30T..."
}
```

Save the `contractId` for the next steps!

### 5. Create External Wallet

```bash
curl -X POST http://localhost:8899/api/daml/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "partyHint": "alice"
  }' | jq
```

Expected output:
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

Save the `partyId` for minting!

### 6. Mint Tokens

Replace `CONTRACT_ID` and `PARTY_ID` with values from previous steps:

```bash
curl -X POST http://localhost:8899/api/cn/tokens/mint \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "CONTRACT_ID",
    "owner": "PARTY_ID",
    "amount": "1000.0"
  }' | jq
```

Expected output:
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

### 7. Query Balance

Replace `PARTY_ID` with your wallet's party ID:

```bash
curl http://localhost:8899/api/cn/balance/PARTY_ID | jq
```

Expected output:
```json
{
  "success": true,
  "holdings": [
    {
      "contractId": "00ghi789...",
      "owner": "alice::1220def...",
      "instrument": "00abc123...",
      "amount": 1000.0
    }
  ],
  "totalBalance": 1000.0,
  "holdingCount": 1
}
```

## Frontend Testing

### Start Frontend Dev Server

```bash
npm run dev
```

Open http://localhost:5174 in your browser.

### Expected UI Flow

1. **Connect** - Click "Connect to Canton Network"
2. **Initialize** - App connects to CN Quickstart
3. **Create Token** - Enter name, symbol, decimals
4. **Create Wallet** - Enter party hint (e.g., "alice")
5. **Mint Tokens** - Enter amount and mint
6. **View Balance** - See token holdings

## API Documentation

Once the backend is running, view full API docs at:

http://localhost:8899/docs

This provides interactive Swagger UI for all endpoints.

## Troubleshooting

### Backend won't start

```bash
# Kill any existing processes on port 8899
npm run server:stop

# Start fresh
npm run server:start
```

### CN Quickstart not accessible

```bash
cd /Users/e/code/sbc/canton/cn-quickstart/quickstart

# Check status
make status

# If not running, start it
make start

# Check logs
make logs
```

### "Could not determine App Provider party"

This means the backend can't find the CN Quickstart App Provider party.

**Solution 1**: Ensure CN Quickstart is fully started (all services healthy)

**Solution 2**: Check CN Quickstart backend is accessible:
```bash
curl http://localhost:8080/admin/tenant-registrations | jq
```

### "401 Unauthorized" or JWT errors

This indicates authentication issues with CN Quickstart.

The service uses unsafe JWT with secret `"unsafe"` for LocalNet development.

Check the logs in `server/index.js` for detailed error messages.

### Contract creation succeeds but "No created event found"

The gRPC response format may have changed. Check backend logs for the full response structure.

## What's Working

Based on the integration:

- ✅ Backend routes registered (`server/index.js`)
- ✅ gRPC service implemented (`src/services/cnQuickstartGrpcService.js`)
- ✅ API endpoints exposed (init, create, mint, balance, status)
- ✅ External wallet creation (via existing SDK route)
- ✅ Swagger documentation available

## What Needs Testing

- 🧪 Actual gRPC communication with CN Quickstart
- 🧪 Contract creation via gRPC
- 🧪 Token minting via Issue choice
- 🧪 Balance queries via gRPC
- 🧪 End-to-end flow validation

## Success Criteria

A successful test should:

1. Initialize and get App Provider party
2. Create an Instrument contract (get real contract ID starting with `00`)
3. Create an external wallet party
4. Mint tokens (create Holding contract)
5. Query and see non-zero balance

All operations should work with **real Canton ledger data**, no mocks or simulations.

## Next Steps After Testing

1. If tests pass → Integrate with frontend UI
2. If tests fail → Check backend logs and gRPC service implementation
3. Document any API changes needed
4. Add error handling improvements based on test results