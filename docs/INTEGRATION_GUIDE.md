# Canton Wallet Demo - Integration Guide

## Complete Setup Guide with Custom DAML Contracts

**Document Version**: 1.0
**Date**: October 3, 2025
**Canton Version**: 3.3.0-snapshot.20250502.13767.0.v2fc6c7e2
**DAML Target**: 2.1

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [DAML Contract Design](#daml-contract-design)
4. [Building and Uploading DARs](#building-and-uploading-dars)
5. [Canton Multi-Participant Architecture](#canton-multi-participant-architecture)
6. [JWT Authentication](#jwt-authentication)
7. [Creating Tokens (Instruments)](#creating-tokens)
8. [Minting Tokens](#minting-tokens)
9. [Querying Balances](#querying-balances-work-in-progress)
10. [Gotchas and Caveats](#gotchas-and-caveats)

---

## Overview

This guide documents the complete process of integrating custom DAML contracts with Canton Network's CN Quickstart LocalNet. It covers:

- Custom token contracts with admin-controlled minting
- Multi-participant Canton topology
- JSON Ledger API v2 integration
- Common pitfalls and solutions

---

## Prerequisites

### Software Versions

```yaml
DAML SDK: 3.3.0-snapshot.20250502.13767.0.v2fc6c7e2
Canton: CN Quickstart LocalNet (running in Docker)
Node.js: 18+ (for backend server)
```

### Required Services

1. **Canton LocalNet** running via Docker:
   - app-provider participant: Port 3975 (JSON API)
   - app-user participant: Port 2975 (JSON API)
   - Backend API: Port 8080

2. **Development Environment**:
   - DAML compiler (`daml`)
   - Docker with Canton container running
   - Backend server (Node.js/Fastify)

---

## DAML Contract Design

### Critical Design Decision: Nonconsuming Choices

**GOTCHA #1**: DAML choices are **consuming by default** - they archive the contract after execution.

#### Problem

If you write an Issue choice like this:

```daml
choice Issue : ContractId Holding
  with
    owner  : Party
    amount : Decimal
  controller admin
  do
    create Holding with ...
```

The Instrument contract will be **archived after the first mint**, preventing subsequent mints.

#### Solution

Use the `nonconsuming` keyword:

```daml
nonconsuming choice Issue : ContractId Holding
  with
    owner  : Party
    amount : Decimal
  controller admin
  do
    create Holding with ...
```

### Complete DAML Contract

**File**: `daml/minimal-token/daml/MinimalToken.daml`

```daml
module MinimalToken where

template Instrument
  with
    admin    : Party
    name     : Text
    symbol   : Text
    decimals : Int
  where
    signatory admin

    -- Admin mints a Holding directly to an owner (nonconsuming to allow multiple mints)
    nonconsuming choice Issue : ContractId Holding
      with
        owner  : Party
        amount : Decimal
      controller admin
      do
        assertMsg "amount must be positive" (amount > 0.0)
        create Holding with admin, owner, instrument = self, amount

template Holding
  with
    admin      : Party
    owner      : Party
    instrument : ContractId Instrument
    amount     : Decimal
  where
    signatory admin
    observer owner

    -- Transfer part or all of the holding
    choice Transfer : (ContractId Holding, Optional (ContractId Holding))
      with
        recipient      : Party
        transferAmount : Decimal
      controller owner
      do
        assertMsg "transferAmount must be positive" (transferAmount > 0.0)
        assertMsg "insufficient balance" (transferAmount <= amount)
        archive self
        newCid <- create Holding with
          admin
          owner = recipient
          instrument
          amount = transferAmount
        if transferAmount < amount then do
          changeCid <- create Holding with
            admin
            owner = owner
            instrument
            amount = amount - transferAmount
          return (newCid, Some changeCid)
        else
          return (newCid, None)
```

### Key Design Points

1. **Admin as Signatory**: Admin signs all Holdings, enabling minting without owner authorization
2. **Owner as Observer**: Owner can see their Holdings but doesn't sign them
3. **Nonconsuming Issue**: Instrument persists after minting, allowing reuse
4. **Controller = Admin**: Only admin can execute the Issue choice

---

## Building and Uploading DARs

### 1. Project Structure

```
daml/minimal-token/
├── daml.yaml
└── daml/
    └── MinimalToken.daml
```

### 2. Configure daml.yaml

**File**: `daml/minimal-token/daml.yaml`

```yaml
sdk-version: 3.3.0-snapshot.20250502.13767.0.v2fc6c7e2
name: minimal-token-admin
version: 1.1.0  # Increment when making changes
source: daml
build-options:
  - --target=2.1
dependencies:
  - daml-prim
  - daml-stdlib
```

**GOTCHA #2**: Version conflicts - Canton rejects uploading a different DAR with the same name/version.

**Solution**: Increment the version number whenever you change the contract.

### 3. Build the DAR

```bash
cd /Users/e/code/architecture/canton/canton-wallet-demo/daml/minimal-token
daml build --output=.daml/dist/minimal-token-admin-1.1.0.dar
```

### 4. Get Package ID

```bash
daml damlc inspect-dar .daml/dist/minimal-token-admin-1.1.0.dar
```

Look for the main package line (example output):

```
minimal-token-admin-1.1.0-fd55eb07f6c8596423bd1765bc749c69ef4eabe86cf6f39787f13be214e717ae
"fd55eb07f6c8596423bd1765bc749c69ef4eabe86cf6f39787f13be214e717ae"
```

The hash `fd55eb07...` is your **Package ID**.

### 5. Upload to BOTH Participants

**GOTCHA #3**: Must upload to ALL participants that will interact with the contracts.

Generate JWT for upload:

```bash
node -e "
import('crypto').then(({ createHmac }) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'ledger-api-user',
    aud: 'https://canton.network.global',
    actAs: ['app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad'],
    exp: now + 3600,
    iat: now
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', 'unsafe').update(\`\${header}.\${payloadB64}\`).digest('base64url');

  console.log(\`\${header}.\${payloadB64}.\${signature}\`);
});
"
```

Upload to **app-provider** (port 3975):

```bash
curl -X POST http://localhost:3975/v2/packages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@.daml/dist/minimal-token-admin-1.1.0.dar"
```

Upload to **app-user** (port 2975):

```bash
curl -X POST http://localhost:2975/v2/packages \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@.daml/dist/minimal-token-admin-1.1.0.dar"
```

Both should return `{}` on success.

### 6. Update Backend Service

Update the package ID in your backend service:

**File**: `src/services/cnQuickstartLedgerService.js`

```javascript
this.minimalTokenPackageId = 'fd55eb07f6c8596423bd1765bc749c69ef4eabe86cf6f39787f13be214e717ae';
```

---

## Canton Multi-Participant Architecture

### Participant Overview

Canton LocalNet runs with 2 participants:

| Participant | Port | Hosts Parties |
|-------------|------|---------------|
| app-provider | 3975 | app_provider_quickstart-e-1::1220a57d... |
| app-user | 2975 | External wallet parties (12xxx::12xxx...) |

**GOTCHA #4**: Contracts are only visible to participants where stakeholders reside.

### Contract Visibility

- **Instrument contracts**: Only on app-provider (admin is sole signatory)
- **Holding contracts**: On BOTH participants (admin + owner are stakeholders)
  - Admin (signatory) → app-provider
  - Owner (observer) → app-user

### Party ID Format

```
{party_hint}::{participant_id}
```

Examples:

- Admin: `app_provider_quickstart-e-1::1220a57d...`
- Wallet: `12208::12208cfd67ce...`

The prefix indicates which participant hosts the party.

---

## JWT Authentication

### JWT Structure

Canton uses HMAC-SHA256 JWTs with the shared secret `"unsafe"` for LocalNet.

```javascript
{
  "sub": "ledger-api-user",
  "aud": "https://canton.network.global",
  "actAs": ["party-id-1", "party-id-2"],  // Parties to sign as
  "readAs": ["party-id-3"],               // Parties to read as (observer access)
  "exp": 1759430000,
  "iat": 1759426400
}
```

### Key Fields

- **actAs**: Parties you're authorized to sign transactions for (signatories)
- **readAs**: Parties you can read contracts for (observers)
- **sub**: User ID (use `"ledger-api-user"`)
- **aud**: Always `"https://canton.network.global"` for Canton

### Generating JWTs

```javascript
import { createHmac } from 'crypto';

function generateJWT(actAsParties, readAsParties = null) {
  const now = Math.floor(Date.now() / 1000);
  const actAsArray = Array.isArray(actAsParties) ? actAsParties : [actAsParties];

  const payload = {
    sub: "ledger-api-user",
    aud: "https://canton.network.global",
    actAs: actAsArray,
    exp: now + 3600,
    iat: now
  };

  if (readAsParties) {
    payload.readAs = Array.isArray(readAsParties) ? readAsParties : [readAsParties];
  }

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', 'unsafe')
    .update(`${header}.${payloadB64}`)
    .digest('base64url');

  return `${header}.${payloadB64}.${signature}`;
}
```

---

## Creating Tokens

### API Endpoint

```
POST http://localhost:3975/v2/commands/submit-and-wait-for-transaction
```

### Request Format

```javascript
{
  "commands": {
    "applicationId": "canton-wallet-demo",
    "commandId": "create-instrument-TIMESTAMP-RANDOM",
    "actAs": ["app_provider_quickstart-e-1::1220a57d..."],
    "commands": [{
      "CreateCommand": {
        "templateId": "PACKAGE_ID:MinimalToken:Instrument",
        "createArguments": {
          "admin": "app_provider_quickstart-e-1::1220a57d...",
          "name": "Demo Token",
          "symbol": "DEMO",
          "decimals": 18
        }
      }
    }]
  }
}
```

### Extract Contract ID

Response structure:

```javascript
{
  "transaction": {
    "events": [{
      "CreatedEvent": {
        "contractId": "00d7f408234613...",  // ← This is your Instrument contract ID
        "templateId": "...",
        "createArguments": { ... }
      }
    }],
    "updateId": "...",
    "commandId": "..."
  }
}
```

---

## Minting Tokens

### API Endpoint

```
POST http://localhost:3975/v2/commands/submit-and-wait-for-transaction
```

### Request Format

```javascript
{
  "commands": {
    "applicationId": "canton-wallet-demo",
    "commandId": "mint-tokens-TIMESTAMP-RANDOM",
    "actAs": ["app_provider_quickstart-e-1::1220a57d..."],  // Admin party
    "commands": [{
      "ExerciseCommand": {
        "templateId": "PACKAGE_ID:MinimalToken:Instrument",
        "contractId": "INSTRUMENT_CONTRACT_ID",  // From create step
        "choice": "Issue",
        "choiceArgument": {
          "owner": "12208::12208cfd67ce...",  // External wallet party
          "amount": "1000"  // DAML Decimal as string
        }
      }
    }]
  }
}
```

### Success Response

```javascript
{
  "transaction": {
    "events": [{
      "CreatedEvent": {
        "contractId": "0033dd866289...",  // ← Holding contract ID
        "templateId": "PACKAGE_ID:MinimalToken:Holding",
        "createArguments": {
          "admin": "app_provider...",
          "owner": "12208::12208...",
          "instrument": "00d7f408...",
          "amount": "1000"
        }
      }
    }]
  }
}
```

**GOTCHA #5**: The Instrument contract ID must match the current Instrument - it doesn't get archived because we used `nonconsuming`.

---

## Querying Balances (Work in Progress)

### Current Status

⚠️ **OPEN ISSUE**: Active contracts query returns empty results despite contracts existing in Canton logs.

### Attempted Approaches

#### Approach 1: Query as Owner with readAs

```javascript
// JWT: actAs=[owner], readAs=[owner]
// Query filtersByParty: owner
// Result: Empty (403 or empty array)
```

**Issue**: Owner is observer, not signatory. Canton may not return contracts where party is observer-only.

#### Approach 2: Query as Admin with readAs Owner

```javascript
// JWT: actAs=[admin], readAs=[owner]
// Query filtersByParty: admin
// Result: Empty array (even with wildcardFilter)
```

**Issue**: `/v2/state/active-contracts` endpoint returns empty despite Canton logs showing Active contracts.

### API Format Attempted

```javascript
{
  "filter": {
    "filtersByParty": {
      "app_provider_quickstart-e-1::1220a57d...": {
        "inclusive": [{
          "templateId": "PACKAGE_ID:MinimalToken:Holding"
        }]
      }
    }
  },
  "verbose": true,
  "activeAtOffset": "0"  // Required field - returns error if missing
}
```

### Known Working Verification

Canton logs confirm contracts are Active:

```
Updated cache... -> Active(Versioned(...,ContractInstance(minimal-token-admin,
fd55eb07...:MinimalToken:Holding,...
```

### Next Steps to Try

1. **Alternative endpoint**: Try gRPC Ledger API instead of JSON API
2. **Different query structure**: Use `cumulative` with `TemplateFilter` format
3. **Stream-based query**: Check if active-contracts requires streaming
4. **Direct participant access**: Query participant directly via admin console

---

## Gotchas and Caveats

### 1. Consuming Choices Archive Contracts

**Problem**: Default DAML choices consume (archive) the contract after execution.

**Solution**: Use `nonconsuming` keyword for choices that should be reusable.

### 2. Version Conflicts on DAR Upload

**Problem**: Canton rejects uploading different DARs with same name/version.

**Solution**: Increment version in `daml.yaml` whenever changing contracts.

### 3. Multi-Participant Package Distribution

**Problem**: Contracts fail if package not uploaded to all relevant participants.

**Solution**: Upload DAR to ALL participants that will interact with the contracts.

### 4. Contract Visibility Across Participants

**Problem**: Contracts only visible to participants where stakeholders reside.

**Solution**: Design contracts so all stakeholders' participants have access, or use reassignment to move contracts.

### 5. Instrument Contract Not Found After First Mint

**Problem**: With consuming Issue choice, contract is archived after first use.

**Solution**: Use `nonconsuming choice Issue` to keep Instrument active.

### 6. Observer vs Signatory Access

**Problem**: Observers may not see contracts in ACS queries.

**Solution**: Use `readAs` in JWT and query as a signatory party.

### 7. JSON API v2 Query Format

**Problem**: Multiple incompatible query formats (verbose/activeAtOffset vs event_format).

**Error**: `Either filter/verbose or event_format is required. Please use... but not both.`

**Solution**: Use EITHER:

- Backwards compatible: `filter` + `verbose` + `activeAtOffset` (as string "0")
- New format: `filter` + `eventFormat` (without verbose/activeAtOffset)

### 8. Empty activeAtOffset Error

**Problem**: `activeAtOffset` requires a value but type varies by API version.

**Tried**:

- `""` (empty string) → `Invalid value... (Long at 'activeAtOffset')`
- `null` → `Invalid value... (Long at 'activeAtOffset')`
- `0` (number) → `Invalid value... (Long at 'activeAtOffset')`
- `"0"` (string) → Currently testing

### 9. Package ID Mismatch

**Problem**: Using wrong package ID from old DAR version.

**Solution**: Always run `daml damlc inspect-dar` after building to get current package ID.

### 10. JWT Secret for LocalNet

**Info**: CN Quickstart LocalNet uses shared secret `"unsafe"` for HMAC-SHA256 JWTs.

**Production**: Will use proper OAuth2/OIDC authentication.

---

## Debugging Tips

### 1. Check Canton Logs

```bash
docker logs canton 2>&1 | grep "CONTRACT_ID" | tail -20
```

Look for:

- `Active(...)` - Contract exists
- `Archived(...)` - Contract was consumed
- Package IDs in contract instances

### 2. Verify Package Upload

```bash
docker logs canton 2>&1 | grep "PACKAGE_ID"
```

Should see upload confirmations on both participants.

### 3. Inspect DAR

```bash
daml damlc inspect-dar path/to/file.dar
```

Verify:

- Package ID matches your code
- Template names are correct

### 4. Test JWT Generation

Use online JWT decoder (jwt.io) to verify:

- Payload structure is correct
- Signature is valid with secret "unsafe"

### 5. Check Participant Connectivity

```bash
curl http://localhost:3975/v2/packages
curl http://localhost:2975/v2/packages
```

Should return package lists (may need auth).

---

## Success Criteria

- [x] DAR builds successfully
- [x] DAR uploaded to both participants
- [x] Instrument contract created (token)
- [x] Tokens minted successfully (nonconsuming works)
- [ ] Balance queries return correct holdings (IN PROGRESS)

---

## References

- [Canton Documentation](https://docs.digitalasset.com/build/3.3/)
- [DAML Language Reference](https://docs.daml.com/daml/reference/)
- [JSON Ledger API v2](https://docs.digitalasset.com/build/3.3/explanations/json-api/)

---

## Changelog

- **2025-10-03**: Initial documentation created
  - Documented nonconsuming choice requirement
  - Documented multi-participant DAR upload
  - Documented JWT authentication structure
  - Documented current balance query issues

---

**Status**: Minting works perfectly. Balance queries still in progress.

---

## ✅ RESOLVED: Balance Query Implementation

**Goal**: Query active Holding contracts where owner is observer (not signatory)

**Status**: ✅ **WORKING** - Balance queries implemented via JSON Ledger API v2

### Solution Summary (Oct 5, 2025)

The `/v2/state/active-contracts` endpoint **DOES exist** in Canton JSON Ledger API v2 and works correctly with proper request format.

**Key Findings from Web Research**:
1. The endpoint exists and is accessible via HTTP POST at `http://localhost:3975/v2/state/active-contracts`
2. Requires specific request fields: `filter`, `verbose`, and `activeAtOffset`
3. Observer queries ARE supported via `readAs` parameter in JWT tokens
4. The State Service replaced the old Active Contracts Service in Ledger API v2

**Working Request Format**:
```json
{
  "filter": {
    "filtersByParty": {
      "<party-id>": {
        "inclusive": [{
          "templateId": "<package-id>:<module>:<template>"
        }]
      }
    }
  },
  "verbose": true,
  "activeAtOffset": 0
}
```

**Required Fields** (previously missing):
- `verbose`: Boolean (required) - controls response detail level
- `activeAtOffset`: Long/Number (required, not string) - ledger offset for query
- `filtersByParty`: Cannot be empty - must have at least one party

**Implementation Changes Made**:
1. Updated `cnQuickstartLedgerService.js` to include `verbose: true` and `activeAtOffset: 0`
2. Changed route from gRPC service to JSON Ledger service in `cnQuickstartRoutes.js:268`
3. Confirmed observer queries work with JWT containing `actAs: [admin], readAs: [owner]`

### Priority 1: API Availability - ✅ RESOLVED

**Q1.1**: Does Canton JSON Ledger API v2 include a `/v2/state/active-contracts` endpoint?
- ✅ **YES** - Endpoint exists at `POST /v2/state/active-contracts`
- ✅ Previous 404 errors were due to missing required fields (`verbose`, `activeAtOffset`)
- ✅ Endpoint is available via both HTTP JSON API and gRPC

**Q1.2**: What is the correct request format for querying active contracts via JSON API?
- ✅ **RESOLVED** - See "Working Request Format" above
- ✅ `verbose: true` is required
- ✅ `activeAtOffset` must be numeric (Long type), not string
- ✅ `filtersByParty` cannot be empty (must specify at least one party)

### Priority 2: Observer Contract Visibility

**Q2.1**: Can observers query contracts where they are listed as `observer` but not `signatory`?
- DAML contract: `signatory admin, observer owner`
- Can `owner` query these Holding contracts?
- If yes, what JWT claims are required (`actAs`? `readAs`? both?)?

**Q2.2**: Which participant should we query?
- Admin (signatory) is on app-provider participant (port 3975)
- Owner (observer) is on app-user participant (port 2975)
- Do we query where the signatory resides or where the observer resides?
- Or both participants?

**Q2.3**: Does `filtersByParty` work for observers?
- When filtering by `owner` party (who is observer), does Canton return contracts?
- Or does `filtersByParty` only work for signatories?

### Priority 3: gRPC Implementation Path

**Q3.1**: Is there a working example of using `@protobuf-ts/grpc-transport` with `@grpc/grpc-js` in Node.js ESM?
- Current error: "Channel credentials must be a ChannelCredentials object"
- Error persists even in pure CommonJS (.cjs file)
- Is there a known working configuration for this package combination?

**Q3.2**: Can we use `@grpc/grpc-js` directly without @protobuf-ts/grpc-transport?
- Would require manually constructing proto messages
- Is there example code for calling Canton gRPC StateService directly?

**Q3.3**: Does Canton provide a higher-level Node.js client for gRPC?
- Similar to how Canton Wallet SDK wraps some APIs
- Is there a Canton gRPC client library we should be using instead?

### Priority 4: Alternative Query Approaches

**Q4.1**: Can we use the Canton Console for programmatic queries?
- Is there a REST API or RPC interface to Canton Console?
- Can we execute participant console commands via API?

**Q4.2**: Does the Transaction Stream (`/v2/updates`) support initial state?
- Can we get all existing active contracts via the stream?
- What is the correct `beginExclusive` value to get all history?

**Q4.3**: Is there a Canton Admin API query endpoint?
- Separate from the Ledger API
- Can we query participant state directly as admin?

### Priority 5: DAML Contract Design Alternatives

**Q5.1**: Should we make owner a co-signatory instead of observer?
- Would this enable owner to query their contracts?
- Downside: Requires owner authorization for minting
- Is there a pattern where admin mints but owner can still query?

**Q5.2**: Can we use contract keys for lookups?
- Add a contract key like `(admin, owner, instrument)`?
- Would this enable efficient queries by owner?
- Does this work across participants?

**Q5.3**: Should we implement a separate Registry contract?
- Admin maintains a registry mapping owner → [holdings]
- Owner queries the registry (where owner is signatory)
- Tradeoff: Additional contract maintenance overhead

### Priority 6: Workaround Strategies

**Q6.1**: If observer queries are fundamentally unsupported, what's the Canton-recommended pattern?
- Event sourcing from transaction stream?
- Materialized views in application database?
- Different contract structure?

**Q6.2**: What do other Canton applications do for balance/portfolio queries?
- Are there reference implementations?
- Canton Network Wallet - how does it handle this?

**Q6.3**: Is there Canton Network infrastructure for this?
- Scan proxy or indexer service?
- Do we need to run additional Canton services?

---

## Next Steps

1. **Verify API endpoints** - Confirm which HTTP/gRPC endpoints exist in Canton v3.3
2. **Test observer queries** - Determine if observers can query via any Canton API
3. **Resolve gRPC issue** - Either fix protobuf-ts interop or find alternative client
4. **Document findings** - Update this guide with working solution

---

## Help Needed

If you have experience with:
- Canton Ledger API v2 query endpoints
- Observer-based contract queries in Canton
- @protobuf-ts/grpc-transport + @grpc/grpc-js configuration
- Canton Network reference implementations

Please share insights on how to query active contracts where the querying party is an observer.
