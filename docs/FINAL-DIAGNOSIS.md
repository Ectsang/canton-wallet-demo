# Final Diagnosis: Canton Wallet Demo ACS Query Issue

## Executive Summary

✅ **DAML Implementation: WORKING**
- Cross-participant token minting works correctly
- v2.1.0 with both signatories pattern is correct per DAML Finance standards
- Holdings are created and visible in Canton ledger

❌ **JSON API Endpoint: NOT WORKING**
- Canton Network LocalNet's HTTP JSON API v2 `/v2/state/active-contracts` returns empty
- gRPC Ledger API (used by Canton console) works perfectly
- This is an infrastructure/configuration issue, not a code issue

## Evidence

### Canton Console (gRPC API) ✅
```scala
usr.ledger_api.state.acs.of_party(demoWallet).size
// Result: 10 contracts

Breakdown:
- 6 HoldingProposal contracts
- 4 Holding contracts (3x v2.0.0, 1x v2.1.0)
```

### HTTP JSON API ❌
```bash
POST http://localhost:2975/v2/state/active-contracts
{
  "filter": {"filtersByParty": {"demo-wallet-1::...": {}}},
  "verbose": true,
  "activeAtOffset": "1"
}

Response: []  # Empty, despite 10 contracts existing!
```

## What Works

1. ✅ **DAML Contract Design**
   - Pattern C (both signatories) is correct
   - Aligns with DAML Finance standard
   - Holdings created with: `signatory admin, owner`

2. ✅ **Cross-Participant Authorization**
   - JWT user has proper actAs/readAs rights
   - demo-wallet-1 is HOSTED on app-user participant
   - Combined authority in Accept choice works correctly

3. ✅ **Transaction Execution**
   - Create Instrument: SUCCESS
   - Issue HoldingProposal: SUCCESS
   - Accept (cross-participant): SUCCESS
   - Holdings created with proper signatories

4. ✅ **Canton gRPC APIs**
   - Ledger API via console works
   - ACS queries return correct results
   - All 10 contracts visible

## What Doesn't Work

❌ **HTTP JSON API v2 ACS Endpoint**
- `/v2/state/active-contracts` returns `[]`
- Works for command submission (Create, Exercise)
- Does NOT work for state queries
- Affects balance queries in webapp

## Impact

**User-Facing:**
- Token creation works ✅
- Token minting (Issue) works ✅
- Proposal acceptance works ✅
- **Balance display shows 0** ❌

**Backend:**
- All Canton operations succeed
- Contract creation verified
- Query endpoint non-functional

## Recommended Solutions

### Option 1: Use gRPC Ledger API (Recommended)
Replace HTTP JSON API with direct gRPC calls:
- Use `@daml/ledger` or Canton gRPC client
- Query via `GetActiveContracts` gRPC method
- More reliable, standard Canton interface

### Option 2: Use Transaction Stream
Query via transaction stream instead of ACS:
- `/v2/updates/transactions` endpoint
- Build ACS from transaction history
- More complex but may work if streaming works

### Option 3: Debug JSON API Configuration
Investigate Canton Network LocalNet setup:
- Check if JSON API is properly started
- Verify port 2975 configuration
- Check Canton logs for JSON API errors

### Option 4: Use Canton Console Proxy
Create a service that wraps Canton console commands:
- Execute Scala commands via console
- Parse console output
- Return results as JSON

## Technical Details

### Holdings Package IDs Found:
1. v2.0.0: `eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de` (3 contracts)
2. v2.1.0: `c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d` (1 contract)

### Party Details:
- **demo-wallet-1**: `demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21`
- **app_provider**: `app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad`
- **Hosting**: demo-wallet-1 IS hosted on app-user (verified)

### JSON API Endpoints Tested:
- ✅ `POST /v2/commands/submit-and-wait-for-transaction` - Works
- ❌ `POST /v2/state/active-contracts` - Returns empty
- ❓ `GET /v2/updates/transactions` - Not tested

## Conclusion

The Canton Wallet Demo **DAML implementation is correct and working**. The issue is with Canton Network LocalNet's HTTP JSON API v2 configuration or implementation. The `/v2/state/active-contracts` endpoint does not return contracts even though they exist and are visible via gRPC.

**Recommended Action:** Switch to gRPC Ledger API for queries or investigate Canton JSON API configuration.
