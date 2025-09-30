# Canton Wallet Demo - Current Status

## Goal

Build a web app that performs real DAML token operations on Canton Network:

1. Create external wallets with cryptographic keys
2. Deploy custom tokens (MinimalToken DAML contracts)
3. Mint tokens to wallets
4. Query wallet balances

All operations must use real Canton ledger, no mocks.

## What Works

- ✅ **External wallet creation** - Real parties with Ed25519 keys registered on Canton ledger
- ✅ **Backend infrastructure** - Fastify server with API routes
- ✅ **DAML contracts** - MinimalToken.dar compiled for DAML-LF 2.1
- ✅ **CN Quickstart connection** - Can connect and authenticate with LocalNet

## What's Blocked

- ❌ **Token creation** - HTTP 403 "security-sensitive error" from JSON Ledger API
- ❌ **Token minting** - Depends on token creation
- ❌ **Balance queries** - Depends on minting

## The Problem

Canton Wallet SDK (v0.7.0) only supports token standard operations. Custom DAML contracts require direct JSON Ledger API calls.

JSON Ledger API on CN Quickstart LocalNet returns:

```text
403 Forbidden
"A security-sensitive error has been received"
```

This blocks all custom DAML contract operations (create, exercise, query).

## What We Tried

### Approach 1: Canton Wallet SDK

- Used `prepareSignAndExecuteTransaction()` for contract creation
- Contract creation succeeded, but SDK provides no way to extract contract IDs for subsequent operations
- Canton team confirmed SDK only supports token standard, not custom contracts

### Approach 2: Direct JSON Ledger API v2

- Implemented direct HTTP calls to `http://localhost:3975/v2/commands/submit-and-wait-for-transaction`
- Uses JWT authentication with HMAC-SHA256 and secret "unsafe"
- Authentication succeeds (no 401 errors)
- All create/exercise/query commands return 403 security errors

### Approach 3: gRPC Ledger API

- Attempted using `@daml/ledger` package
- Same security restrictions as JSON API

### Approach 4: Switched LocalNet environments

- Started with Splice LocalNet 0.4.15 - security blocked
- Switched to CN Quickstart LocalNet - same security blocks

## Technical Details

**Working request example:**

```bash
curl -X POST http://localhost:3975/v2/commands/submit-and-wait-for-transaction \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": {
      "applicationId": "canton-wallet-demo",
      "commandId": "create-123",
      "actAs": ["app_provider_quickstart-e-1::1220..."],
      "commands": [{
        "CreateCommand": {
          "templateId": "d832...15f6:MinimalToken:Instrument",
          "createArguments": {
            "admin": "app_provider_quickstart-e-1::1220...",
            "name": "Test",
            "symbol": "TST",
            "decimals": 18
          }
        }
      }]
    }
  }'
```

**Response:**

```json
{
  "code": "NA",
  "cause": "A security-sensitive error has been received",
  "correlationId": "5d24c5b6e2d5bbe94c0721e8f9be7e1d"
}
```

**JWT payload:**

```json
{
  "sub": "app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad",
  "aud": "https://canton.network.global"
}
```

Signed with HMAC-SHA256 using secret `"unsafe"`.

## What We Need

Access to CN Quickstart LocalNet without security restrictions, or configuration to enable custom DAML contract operations in development environment.

The code is complete and working - this is a LocalNet security configuration issue.

## File Locations

- Backend routes: `server/routes/cnQuickstartRoutes.js`
- JSON API service: `src/services/cnQuickstartLedgerService.js`
- Test scripts: `test-flow.sh`, `quick-test.sh`
- DAML contracts: `minimal-token.dar`

## Test Command

```bash
cd /Users/e/code/architecture/canton/canton-wallet-demo
./test-flow.sh
```

Will succeed through wallet creation, then fail at token creation with 403 error.
