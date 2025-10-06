# Canton Wallet Demo - Context & Status

## Project Goal
Fix cross-participant token minting in Canton Network LocalNet to enable:
- **Admin** (on app-provider participant) can Issue a HoldingProposal
- **Owner** (on app-user participant) can Accept the proposal to create a Holding

## Problem Identified
Cross-participant Accept was failing with authorization error:
```
FAILED_PRECONDITION: Interpretation error: Error: node DEV::1220... cannot confirm transaction ...
due to ... Inconsistent: root hash mismatch
```

### Root Cause
The DAML `Holding` template had BOTH admin and owner as signatories:
```daml
template Holding
  with
    admin: Party
    instrument: ContractId Instrument
    owner: Party
    amount: Decimal
  where
    signatory admin, owner  -- ❌ PROBLEM: Both are signatories
```

**Why this fails:** When admin (on app-provider) submits a transaction, owner (on app-user, different participant) cannot sign it because they're on different participants. Canton's authorization model requires all signatories to be on the same participant for cross-participant transactions.

## Solution Implemented

### 1. Fixed DAML Contract ✅
Changed `Holding` template to single signatory with observer pattern:

**File:** `daml/minimal-token/daml/MinimalToken.daml`

```daml
template Holding
  with
    admin: Party
    instrument: ContractId Instrument
    owner: Party
    amount: Decimal
  where
    signatory admin       -- ✅ Only admin is signatory
    observer owner        -- ✅ Owner is observer (can see but not sign)
```

This allows:
- Admin submits the transaction (they're the signatory)
- Owner can see the Holding (they're an observer)
- Cross-participant authorization works correctly

### 2. Version Bump ✅
**File:** `daml/minimal-token/daml.yaml`
```yaml
version: 2.0.1  # Bumped from 2.0.0
```

Reason: Canton requires different version number to upload alongside existing package.

### 3. Built New DAR ✅
```bash
cd daml/minimal-token
daml build
```

**Output:** `.daml/dist/minimal-token-autoaccept-2.0.1.dar`

### 4. Uploaded DAR to Both Participants ✅
Used Python script `/tmp/upload_dar_v2.0.1.py` to upload via gRPC PackageService:

```python
# Uploaded to both:
# - app-provider: localhost:3902
# - app-user: localhost:2902
```

**New Package ID:** `2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118`

## Current Status (Updated 2025-10-06)

### Completed ✅
1. ✅ DAML contract fix (signatory → observer pattern) - v2.0.1
2. ✅ Version bump to 2.0.1
3. ✅ DAR build
4. ✅ DAR upload to both participants (package ID: `2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118`)
5. ✅ **Same-participant flow VERIFIED WORKING** with v2.0.1

### Test Results

#### ✅ Same-Participant Test (PASSING)
**Test:** `/tmp/test-v2.0.1-same-participant.sh`

Flow: Create Instrument → Issue (HoldingProposal) → Accept (Holding)
- Admin: `app_provider_quickstart-e-1` (app-provider participant)
- Owner: `app_provider_quickstart-e-1` (same participant)
- Result: **100% SUCCESS** - Full flow works correctly

**Conclusion:** The v2.0.1 DAR with observer pattern is functionally correct.

#### ✅ Cross-Participant Test (NOW WORKING!)
**Test:** `/tmp/test-v2.0.1-cross-participant.sh`

Flow: Create Instrument → Issue (HoldingProposal) ✅ → Accept (Holding) ✅
- Admin: `app_provider_quickstart-e-1` (app-provider participant)
- Owner: `demo-wallet-1` (app-user participant)
- Issue choice: **SUCCESS** - HoldingProposal created cross-participant
- Accept choice: **SUCCESS** - Holding created cross-participant!

**Root Cause Identified & FIXED:**
The error was **NOT** a DAML signatory problem. It was a **JWT authorization issue**:

1. ✅ Party exists on both participants (verified via Canton console)
2. ✅ DAML contract authorization is correct (observer pattern works)
3. ❌ JWT `ledger-api-user` lacked rights to act as `demo-wallet-1` on app-user participant

**Solution Applied:**
```scala
// Grant actAs rights for demo-wallet-1
participants.app_user.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  actAs = Set(PartyId.tryFromProtoPrimitive("demo-wallet-1::12203bef..."))
)

// Grant readAs rights for app_provider (to see HoldingProposal)
participants.app_user.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  readAs = Set(PartyId.tryFromProtoPrimitive("app_provider_quickstart-e-1::1220a57d..."))
)
```

**Result:** Cross-participant Issue + Accept flow now works end-to-end! ✅

### Solution Summary ✅

**The DAML v2.0.1 observer pattern IS WORKING CORRECTLY across participants!**

Both same-participant and cross-participant flows now work end-to-end:
- ✅ Same-participant: Full Issue + Accept flow works
- ✅ Cross-participant Issue: HoldingProposal created successfully
- ✅ Cross-participant Accept: Holding created successfully!

**Key Insights:**

1. **DAML Contract Design**: The observer pattern fix was correct. Admin as signatory, owner as observer enables cross-participant operations.

2. **Canton Authorization Model**: Cross-participant operations require proper JWT user rights on each participant:
   - Party must exist on the participant (via `parties.enable()`)
   - JWT user must have `actAs` rights for the party
   - JWT user must have `readAs` rights for any parties whose contracts they need to see

3. **JWT Configuration**: The `ledger-api-user` (matching JWT `sub` claim) needs explicit rights granted via Canton console:
   ```scala
   participants.app_user.ledger_api.users.rights.grant(
     id = "ledger-api-user",
     actAs = Set(PartyId.tryFromProtoPrimitive("demo-wallet-1::...")),
     readAs = Set(PartyId.tryFromProtoPrimitive("app_provider::..."))
   )
   ```

### Next Steps for Production

For a production system, automate user rights management:
1. When creating a new wallet/party, grant rights to `ledger-api-user` automatically
2. Consider using per-wallet JWT users instead of shared `ledger-api-user`
3. Document the rights model for external participants joining the network

**The original problem (signatory authorization) was correctly diagnosed and fixed. The additional blocker was JWT user rights, now also resolved.**

## Technical Details

### Canton Network Setup
- **Location:** `/Users/e/code/sbc/canton/cn-quickstart/quickstart/docker/modules/localnet`
- **Participants:**
  - **app-provider** (admin): Ports 3901 (Ledger), 3902 (Admin), 3975 (JSON API)
  - **app-user** (wallets): Ports 2901 (Ledger), 2902 (Admin), 2975 (JSON API)

### Backend Server
- **Port:** 8899
- **Routes:** `server/routes/cnQuickstartRoutes.js`
- **Key endpoints:**
  - `POST /api/cn/tokens/create` - Create Instrument
  - `POST /api/cn/tokens/mint` - Issue HoldingProposal
  - `POST /api/cn/proposals/accept` - Accept proposal → Holding
  - `POST /api/cn/wallets/create` - Allocate party (currently broken)

### DAML Contract Flow
1. **Create Instrument** (admin creates token definition)
   - Template: `Instrument`
   - Fields: `name`, `symbol`, `decimals`, `admin`

2. **Issue** choice on Instrument → creates **HoldingProposal**
   - Admin exercises choice
   - Creates proposal for owner to accept

3. **Accept** choice on HoldingProposal → creates **Holding**
   - Owner exercises choice
   - Converts proposal to actual holding
   - **This is where cross-participant auth matters**

## Workaround Options

### Option A: Use Existing Parties
Use parties already allocated in previous sessions:
- `app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4d...` (app-provider)
- Any previously created demo-wallet parties

### Option B: Direct gRPC Investigation
Explore Canton Admin API v30 for alternative party allocation methods:
```bash
grpcurl -plaintext localhost:2902 list com.digitalasset.canton.admin.participant.v30.PartyManagementService
```

### Option C: Fix Canton Console
Debug why `daemon -c --auto-connect-local --bootstrap` mode is broken (likely Canton environment issue, not code).

## Files Modified

### DAML
- `daml/minimal-token/daml/MinimalToken.daml` - Fixed Holding template
- `daml/minimal-token/daml.yaml` - Version bump to 2.0.1

### Backend
- `server/routes/cnQuickstartRoutes.js` - Wallet creation endpoint (attempted fixes)

### Scripts
- `/tmp/upload_dar_v2.0.1.py` - DAR upload script

## Key Learnings

1. **Cross-participant authorization requires single signatory pattern**
   - Use `signatory` for the party submitting the transaction
   - Use `observer` for parties that need visibility but not signing authority

2. **Canton package versioning**
   - Cannot upload same version twice
   - Must increment version in daml.yaml

3. **Canton console daemon mode**
   - The `daemon -c --auto-connect-local --bootstrap` approach may not be reliable
   - Consider using gRPC Admin APIs directly instead

## Latest Investigation: Pattern C (Both Signatories) - 2025-10-06

### Problem with Observer Pattern (v2.0.1)
After successfully fixing cross-participant Accept with v2.0.1 observer pattern, we discovered a critical issue:
- ✅ Holdings are created successfully
- ❌ **Owners cannot see their Holdings in balance queries**

When querying via `/v2/state/active-contracts`, Holdings with `signatory admin, observer owner` are invisible to owner queries, even though owner has actAs rights.

### Root Cause Analysis
The observer pattern (v2.0.1) works for **authorization** but breaks **visibility**:
1. Owner can exercise Accept choice (controller authority + admin signatory from proposal)
2. Holding is created with admin as sole signatory, owner as observer
3. Canton ACS queries filter by stakeholder relationship
4. **Observer status alone is insufficient for ACS visibility in cross-participant scenarios**

### Research: DAML Finance Standard Pattern
Researched DAML authorization and discovered:
1. **Pattern A** (admin only signatory): ❌ Breaks Accept authorization
2. **Pattern B** (owner only signatory): ❌ Breaks Accept completely (owner can't authorize admin as signatory)
3. **Pattern C** (both signatories): ✅ **DAML Finance standard pattern**

**Key Insight:** When owner exercises Accept choice, they gain **combined authority** of:
- Owner (controller of Accept)
- Admin (signatory of HoldingProposal)

This combined authority CAN create Holding with `signatory admin, owner`.

**Why Pattern C originally "failed":** The original failure was the JWT authorization issue, NOT a DAML problem!

### Solution: Revert to Pattern C (v2.1.0)

**File:** `daml/minimal-token/daml/MinimalToken.daml`
```daml
template Holding
  with
    admin      : Party
    owner      : Party
    instrument : ContractId Instrument
    amount     : Decimal
  where
    signatory admin, owner  -- Both parties sign (DAML Finance standard pattern)
```

**Rationale:**
- This is the standard DAML Finance pattern for holdings
- Owner as signatory ensures ACS visibility
- Combined authority from Accept choice enables cross-participant creation
- Original failure was JWT rights, not DAML authorization

### Version 2.1.0 Deployment ✅

**Built and deployed:**
```bash
cd daml/minimal-token
# Updated daml.yaml to version: 2.1.0
daml build
```

**Package ID (v2.1.0):** `c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d`

Uploaded to both participants via `/tmp/upload_dar_v2.1.0.py`:
- ✅ app-provider: localhost:3902
- ✅ app-user: localhost:2902

### Test Results (v2.1.0)

**Test:** `/tmp/test-v2.1.0-via-api.sh`

1. ✅ **Instrument Created** - Admin creates token successfully
2. ✅ **Issue Choice** - HoldingProposal created cross-participant
3. ✅ **Accept Choice** - Holding created with BOTH signatories!
   ```
   "signatories": [
     "app_provider_quickstart-e-1::1220a57d...",
     "demo-wallet-1::12203bef03ef..."
   ]
   ```
4. ❌ **Balance Query** - Returns 0 holdings despite successful creation

### ROOT CAUSE IDENTIFIED: JSON API v2 Not Working ✅

**Symptom:** Holdings created successfully but ACS queries via JSON API return empty.

**Investigation Results:**

1. **Canton Console Verification** ✅
   - demo-wallet-1 has **10 contracts** visible (6 HoldingProposals + 4 Holdings)
   - Holdings include both v2.0.0 and v2.1.0 packages
   - Party is properly **HOSTED** on app-user participant
   - All DAML authorization working correctly

2. **JSON API Testing** ❌
   - Endpoint: `http://localhost:2975/v2/state/active-contracts`
   - Query with templateId filter: Returns `[]`
   - Query WITHOUT any filter (all contracts): Returns `[]`
   - Query with different package IDs: Returns `[]`
   - **Conclusion: JSON API endpoint returning empty regardless of query**

3. **Package ID Discovery**
   - Holdings exist with multiple package IDs:
     - 3 Holdings: v2.0.0 (`eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de`)
     - 1 Holding: v2.1.0 (`c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d`)

**Root Cause:**
Canton Network LocalNet's JSON API v2 `/v2/state/active-contracts` endpoint is **not functional** or **not properly exposed** on port 2975. The gRPC API (used by Canton console) works perfectly, but the HTTP JSON API does not.

**Confirmed Working:**
- ✅ DAML contracts (v2.1.0 with both signatories)
- ✅ Cross-participant minting (Issue + Accept)
- ✅ Party hosting on app-user
- ✅ Canton gRPC Ledger API
- ❌ Canton HTTP JSON API v2

**Possible Solutions:**
1. Use gRPC Ledger API directly instead of JSON API
2. Check Canton JSON API configuration/startup
3. Use transaction stream API instead of ACS query
4. Deploy JSON API separately if not bundled with Canton Network

### Status Summary

**DAML Authorization: ✅ WORKING**
- Pattern C (both signatories) is correct
- Cross-participant Accept succeeds
- Holdings created with proper authorization

**ACS Visibility: ❌ BROKEN**
- Queries return empty despite Holdings existing
- Requires investigation into Canton ledger synchronization
- May be a LocalNet environment issue vs production Canton

**Confidence:** The DAML contract design is correct per DAML Finance standards. The ACS query issue is a Canton integration/configuration problem, not a contract design flaw.

## References

- **Package ID (v2.0.0 - original):** `eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de`
- **Package ID (v2.0.1 - observer):** `2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118`
- **Package ID (v2.1.0 - both sig):** `c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d`
- **App Provider Party:** `app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4d...`
- **Demo Wallet Party:** `demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21`


## FINAL RESOLUTION - JSON API v1 Working ✅

**Date:** 2025-10-06

### Problem Solved
Balance queries were failing because:
1. JSON API v2 `/v2/state/active-contracts` returns empty `[]`
2. JWT tokens were missing required `scope` field for v1 API
3. templateId format was incomplete (`module:entity` instead of `packageId:module:entity`)

### Solution Implemented
Created `JsonApiV1Service` that uses v1 `/query` endpoint with:
- JWT including `scope: 'daml_ledger_api'`
- Full templateId format: `packageId:module:entity`
- Support for multiple package versions

### Test Results
```bash
curl http://localhost:8899/api/cn/balance/demo-wallet-1::12203bef...
```

**Response:**
```json
{
  "success": true,
  "holdings": [...],
  "totalBalance": 2200.5,
  "holdingCount": 4
}
```

✅ **Balance queries now working correctly!**

### Files Changed
1. **Created**: `server/services/jsonApiV1Service.js` - Working v1 API service
2. **Updated**: `server/routes/cnQuickstartRoutes.js` - Balance endpoint uses v1
3. **Created**: `SOLUTION.md` - Complete solution documentation
4. **Created**: `REPRO.md` - Reproduction steps and testing

### Key Learnings
- v1 JSON API requires `scope: 'daml_ledger_api'` in JWT
- templateIds must be full format: `packageId:module:entity`
- v2 query endpoints have separate issue (still returns `[]`)
- v2 command endpoints work fine

**Status: RESOLVED ✅**

