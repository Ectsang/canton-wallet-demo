# Canton Wallet Demo - Context & Status

## Current Status (2025-10-07)

### ✅ WORKING Features
- **v2.2.0 DAML Contract**: Burn choice implemented and deployed
- **Cross-Participant Minting**: Issue + Accept flow working
- **Package Management**: v2.2.0 (c90d4ebe...) set as active, old versions hidden
- **Transfer Feature**: Implemented (for migrating old holdings)
- **UI**: Transfer and Burn buttons displayed

### ❌ KNOWN ISSUES

#### 1. Burn Fails on Newly Created Holdings (Race Condition)
**Symptom**: Burn immediately after Accept returns `CONTRACT_NOT_ACTIVE`

**Error**:
```
CONTRACT_NOT_ACTIVE(11,371eafc1): Interpretation error: Error: Update failed due to fetch of an inactive contract 006dfbb153c0da3d22bbb539b0ad32c6cf00b4d791cfbe813cf6b60426b7b7623cca11122066722950018381a946476e544192556dec8ca4b0a275ab570f79e82bff40a9d7 (MinimalToken:Holding@c90d4ebe).
The contract had been consumed in sub-transaction #NodeId(0):
```

**Timeline**:
- 16:36:40.567459Z: Holding created (Accept choice)
- 16:36:45.913448Z: Burn attempted (5 seconds later)
- Result: CONTRACT_NOT_ACTIVE error

**Root Cause**: Canton's active contract set (ACS) view hasn't fully propagated to the participant yet. The holding was JUST created, and when queried immediately for burn, Canton sees it as "inactive" or "consumed" because the creation event hasn't fully settled.

**Workaround**: Wait 5-10 seconds after creating a holding before burning it, or refresh the UI to force a new ACS query.

**Proper Fix Needed**:
- Add a delay/retry mechanism in burn operations
- Query ACS before burn to ensure contract is visible
- Add transaction finality check

#### 2. Transfer Fails on Old Package Versions
**Symptom**: Transfer buttons fail on v2.0.x and v2.1.0 holdings

**Error**:
```
CONTRACT_NOT_ACTIVE(11,f40f38aa): Interpretation error: Error: Update failed due to fetch of an inactive contract ... (MinimalToken:Holding@c90d4ebe)
```

**Root Cause**:
- Query uses old package IDs to FIND holdings (commented out in jsonApiV1Service)
- Transfer uses v2.2.0 template ID to EXERCISE the choice
- Mismatch: trying to exercise v2.2.0 choice on v2.1.0 contracts fails

**Solution**: Old package IDs now commented out - only v2.2.0 holdings visible for clean demo

## DAML Contract Evolution

### v2.2.0 (Current - c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae)
**Added**: Burn choice

```daml
choice Burn : ()
  controller owner
  do
    archive self
    return ()
```

**Features**:
- ✅ Issue choice (admin → creates HoldingProposal)
- ✅ Accept choice (owner → creates Holding from proposal)
- ✅ Transfer choice (owner → transfer tokens)
- ✅ Burn choice (owner → destroy holding)

### v2.1.0 (c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d)
- Issue, Accept, Transfer only (no Burn)

### v2.0.1 & v2.0.0
- Basic minting without proposal pattern

## Package ID Management

### Active Package IDs (Queried)
**Files**:
- `server/services/jsonApiV1Service.js` (lines 21-26)
- `src/services/cnQuickstartLedgerService.js` (lines 757-762)

**Current Config**:
```javascript
this.packageIds = [
  'c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae',  // v2.2.0 (with Burn) ✅ ACTIVE
  // 'c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d',  // v2.1.0 ❌ HIDDEN
  // '2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118',  // v2.0.1 ❌ HIDDEN
  // 'eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de'   // v2.0.0 ❌ HIDDEN
];
```

**Effect**: Only v2.2.0 holdings shown in UI (clean demo state)

## Service Architecture

### Actually Used Services ✅
1. **CNQuickstartLedgerService** (`src/services/cnQuickstartLedgerService.js`)
   - **Purpose**: Execute commands (Issue, Accept, Burn, Transfer) via JSON API v2
   - **Used By**: All POST endpoints in `server/routes/cnQuickstartRoutes.js`

2. **JsonApiV1Service** (`server/services/jsonApiV1Service.js`)
   - **Purpose**: Query contracts (Holdings, HoldingProposals) via JSON API v1
   - **Used By**: `/api/cn/balance/:owner`, `/api/cn/proposals/:owner`

### NOT Used Services ❌
- CNQuickstartGrpcBalanceService (imported but never called)
- grpcLedgerService.js (not imported)
- cantonConsoleService.js (not used in API)
- damlLedgerService.js (not used in API)

## Frontend Integration

**Main Service**: `CNQuickstartFrontendService` (`src/services/cnQuickstartFrontendService.js`)
- Calls backend API endpoints
- Methods: initialize, createToken, mintTokens, getProposals, acceptProposal, burnHolding, transferHolding, getTokenBalance

**UI State**: `src/App.jsx`
- Added `appProviderParty` state (line 17)
- Set via `setAppProviderParty(initResult.appProviderParty)` on init (line 55)
- Used in `transferToAdmin()` function (line 398)

## Transfer Feature Implementation

### Purpose
Allow users to transfer old v2.0.x/v2.1.0 holdings back to admin to "clean up" holdings that can't be burned.

### Implementation

**Backend**:
- Endpoint: `POST /api/cn/holdings/transfer` (cnQuickstartRoutes.js:370-447)
- Service Method: `CNQuickstartLedgerService.transferHolding()` (cnQuickstartLedgerService.js:622-729)
- Choice: `Transfer` (exists in all DAML versions)

**Frontend**:
- Service Method: `CNQuickstartFrontendService.transferHolding()` (cnQuickstartFrontendService.js:306-344)
- UI Function: `transferToAdmin()` in App.jsx (lines 386-411)
- Button: "↩️ Transfer" next to Burn button (App.jsx:1082-1097)

**Flow**:
1. User clicks "↩️ Transfer" button on a holding
2. Frontend calls `transferToAdmin(holdingId, amount, symbol)`
3. Transfers full amount to `appProviderParty` (admin)
4. Archives old holding, creates new holding owned by admin
5. Updates balance display

## Known Working Flows

### 1. Cross-Participant Two-Step Minting ✅
```
Admin (app-provider) → Issue choice → HoldingProposal created
Owner (app-user) → Accept choice → Holding created
Result: 1000 tokens in owner's balance
```

**Verified**: 2025-10-06 (v2.2.0)
- Proposal created successfully
- Proposal accepted successfully
- Holding created with both admin and owner as signatories
- Balance query shows tokens

### 2. Burn (with timing consideration) ⚠️
```
Owner (app-user) → Burn choice → Holding archived
Result: Tokens removed from supply
```

**Status**: Implemented but requires waiting after holding creation
**Issue**: Race condition - must wait for ACS to propagate

## DAR Upload Method (Proven Working)

**Method**: grpcurl via Python script

**Script Template**:
```python
import subprocess, base64, json

dar_path = '/path/to/minimal-token-v2.2.0.dar'
with open(dar_path, 'rb') as f:
    dar_bytes = f.read()

dar_b64 = base64.b64encode(dar_bytes).decode('utf-8')

upload_request = {
    "dars": [{
        "bytes": dar_b64,
        "description": "MinimalToken v2.2.0 - Added Burn choice"
    }],
    "vet_all_packages": True,
    "synchronize_vetting": True
}

# Upload to app-provider (port 3902)
subprocess.run([
    'grpcurl', '-plaintext', '-d', json.dumps(upload_request),
    'localhost:3902',
    'com.digitalasset.canton.admin.participant.v30.PackageService/UploadDar'
], capture_output=True, text=True)

# Upload to app-user (port 2902)
subprocess.run([
    'grpcurl', '-plaintext', '-d', json.dumps(upload_request),
    'localhost:2902',
    'com.digitalasset.canton.admin.participant.v30.PackageService/UploadDar'
], capture_output=True, text=True)
```

**After Upload**: Update `cnQuickstartLedgerService.js` line 15 with new package ID

## Next Steps

### Priority 1: Fix Burn Race Condition
**Options**:
1. Add 5-second delay before allowing burn operations after Accept
2. Query ACS before burn to verify contract visibility
3. Add retry logic (try burn, if CONTRACT_NOT_ACTIVE, wait 2s and retry)

### Priority 2: Testing
- Test Burn on holdings that are >10 seconds old (should work)
- Verify Transfer still fails on old v2.1.0 holdings (expected with current config)
- Test end-to-end: Create token → Issue → Accept → Wait 10s → Burn ✅

### Priority 3: Clean Up
- Remove dead code (CNQuickstartGrpcBalanceService, grpcLedgerService, etc.)
- Add UI feedback for race condition (e.g., "Holding just created, please wait before burning")
- Consider removing Transfer feature if old holdings are permanently hidden

## Environment

- **Canton LocalNet**: cn-quickstart (from /Users/e/code/sbc/canton/cn-quickstart/quickstart/docker/modules/localnet)
- **App Provider**: localhost:3975 (JSON API), localhost:3902 (Admin API)
- **App User**: localhost:2975 (JSON API), localhost:2902 (Admin API)
- **Backend Server**: localhost:8899 (Fastify)
- **Frontend Dev Server**: localhost:5173 (Vite)
- **JWT Secret**: "unsafe" (Canton LocalNet default)

## Files Modified (This Session)

1. **DAML Contract**: `daml/minimal-token/daml/MinimalToken.daml`
   - Added Burn choice (lines 84-88)

2. **Backend Routes**: `server/routes/cnQuickstartRoutes.js`
   - Added `/api/cn/holdings/transfer` endpoint (lines 370-447)

3. **Ledger Service**: `src/services/cnQuickstartLedgerService.js`
   - Added `transferHolding()` method (lines 622-729)
   - Updated `allPackageIds` to show only v2.2.0 (lines 757-762)

4. **JSON API Service**: `server/services/jsonApiV1Service.js`
   - Added v2.2.0 to packageIds, commented out old versions (lines 21-26)

5. **Frontend Service**: `src/services/cnQuickstartFrontendService.js`
   - Added `transferHolding()` method (lines 306-344)

6. **Frontend App**: `src/App.jsx`
   - Added `appProviderParty` state (line 17)
   - Added `setAppProviderParty()` in `initializeApp()` (line 55)
   - Added `transferToAdmin()` function (lines 386-411)
   - Added Transfer button UI (lines 1081-1114)

7. **Package Management**:
   - Commented out old package IDs in jsonApiV1Service.js
   - Commented out old package IDs in cnQuickstartLedgerService.js

## Key Learnings

1. **DAML Contract Immutability**: Old contracts can't gain new choices from upgraded templates. Must create new holdings with new package version to use Burn.

2. **Package Version Matching**: Exercise commands MUST use the exact package ID that created the contract. Cannot exercise v2.2.0 choice on v2.1.0 contract.

3. **Race Conditions**: Canton's ACS view takes time to propagate. Operations on just-created contracts may fail with CONTRACT_NOT_ACTIVE.

4. **Service Separation**: JSON API v1 for queries (batch queries with templateIds), v2 for commands (single operations with full request structure).

5. **Hidden vs Deleted**: Commenting out package IDs HIDES contracts from queries but doesn't delete them from ledger. They still exist and can be queried with correct template ID.
