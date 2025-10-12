# Canton Wallet Demo - Context & Status

## Current Status (2025-10-12)

### ✅ WORKING Features
- **Dynamic Party ID Detection**: App provider party automatically fetched from Canton logs ✨ NEW (2025-10-12)
- **Centralized Package Config**: Uses src/config/packageConfig.js for version management ✨ NEW (2025-10-12)
- **v1.0.0 DAML Contract**: Immediate burn via consuming ProposeBurn choice (current deployment) ✨ UPDATED (2025-10-12)
- **Cross-Participant Minting**: Issue + Accept flow working
- **Immediate Token Burning**: ProposeBurn consumes Holding immediately (design decision) ✨ UPDATED (2025-10-12)
- **Package Management**: v1.0.0 (1bf66b0c...) set as active
- **UI**: Burn buttons immediately remove tokens

### 🎉 SOLVED ISSUES

#### Dynamic Party ID Detection (2025-10-12) ✅
**Problem**: Hardcoded app_provider party ID in code became invalid after Canton LocalNet restart, causing 403 "security-sensitive error" on all token operations.

**Root Cause**:
- Canton LocalNet generates **NEW party IDs** every time it restarts
- Old hardcoded party ID: `app_provider_quickstart-e-1::1220a57d93...`
- New party ID after restart: `app_provider_quickstart-e-1::1220c19f3e...`
- All commands used wrong party ID, resulting in authentication failures
- DAR vetting was successful, but party mismatch caused rejection

**Failed Solutions**:
1. ❌ Tried API call to fetch party → Required JWT → Circular dependency (needed party to generate JWT)
2. ❌ Tried environment variable → Required manual update on every restart

**Working Solution**: Extract party from Docker logs using shell command

```javascript
// src/services/cnQuickstartLedgerService.js (lines 70-135)
async initialize() {
  if (this.appProviderParty) return; // Already initialized

  try {
    // Option 1: Extract from Canton Docker logs (most reliable for LocalNet)
    const { execSync } = await import('child_process');
    const result = execSync(
      'docker logs canton 2>&1 | grep "app_provider_quickstart-e-1::" | tail -1 | grep -o "app_provider_quickstart-e-1::[a-f0-9]*" | head -1',
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    if (result && result.startsWith('app_provider_quickstart-e-1::')) {
      this.appProviderParty = result;
      return;
    }
  } catch (logError) {
    // Fallback to other methods...
  }

  // Option 2: Try CN Quickstart backend API
  // Option 3: Use environment variable
  // Option 4: Error with instructions
}
```

**Changes Made**:
1. **Constructor** (lines 26-40): Changed `appProviderParty` from hardcoded to `null`, added note about dynamic detection
2. **Initialize method** (lines 70-135): Added dynamic party fetching with multiple fallback strategies
3. **All command methods**: Added `await this.initialize()` call at the start to ensure party is loaded

**Result**: ✅ Party ID automatically detected on server startup, no manual updates needed after Canton restarts!

**Testing**:
- `/api/cn/init` returns correct party: `app_provider_quickstart-e-1::1220c19f3e...`
- Token creation works without 403 errors
- Commands use correct current party ID from Canton logs

**Key Insight**: Canton LocalNet party IDs change on restart. For production, party IDs are stable, but for LocalNet demos we must detect dynamically.

#### Immediate Token Burn Design Decision (2025-10-12) ✅
**Design Choice**: Burns happen immediately when user clicks 🔥 Burn button

**Why Immediate Burns?**
1. **DAML Default Behavior**: Choices are consuming by default unless marked `nonconsuming`
2. **Cross-Participant Reality**: Holdings have `signatory admin, owner` across different participants
3. **Simplicity**: User expectation is that clicking "Burn" removes tokens immediately
4. **Historical Context**: Previous attempts to change signatory/observer patterns broke minting

**Technical Implementation**:
```daml
-- ProposeBurn: Consuming choice (archives Holding immediately)
choice ProposeBurn : ContractId BurnProposal
  controller owner
  do
    create BurnProposal with
      admin
      owner
      holding = self  -- Creates audit trail with contract ID reference
```

**What Actually Happens**:
1. User clicks "🔥 Burn" button
2. Owner exercises ProposeBurn choice on Holding
3. **Holding is immediately archived** (consuming choice behavior)
4. BurnProposal contract created as **audit trail** with reference to archived Holding
5. Balance updates immediately to reflect burn

**Why Not Two-Step?**:
- Minting requires two steps because admin creates HoldingProposal first, then owner accepts
- For burning, owner already possesses the Holding and just wants to remove it
- Making ProposeBurn `nonconsuming` would leave Holding active, requiring admin approval to finish
- Historical issues: Changing Holding signatures/observers repeatedly broke cross-participant minting
- **Design decision**: Keep it simple - immediate burn with audit trail

**BurnProposal Template Purpose**:
- Serves as **permanent audit record** of what was burned
- Contains: owner, admin, archived Holding contract ID reference
- AcceptBurn choice exists for completeness but Holding is already archived
- Queryable for burn history and compliance

**UI Updates (2025-10-12)**:
- Removed "Admin: Burn Proposals" section (no approval needed)
- Changed burn button text to reflect immediate action
- Updated Quick Start Guide: "Click 🔥 Burn to immediately remove tokens"
- Added design note explaining immediate burn behavior

**Result**: ✅ Simple, immediate burns with full audit trail!

### ⚠️ KNOWN LIMITATIONS

#### Legacy Burn Choice May Not Work
The direct `Burn` choice is kept for backward compatibility but may fail on cross-participant Holdings. Use ProposeBurn/AcceptBurn instead.

## DAML Contract Evolution

### v2.4.0 (Current - bc5800fb102ebab939780f60725fc87c5c0f93c947969c8b2fc2bb4f87d471de) ✨ NEW
**Added**: ProposeBurn/AcceptBurn pattern + kept legacy Burn

```daml
-- NEW: Propose-and-accept burn pattern (recommended)
choice ProposeBurn : ContractId BurnProposal
  controller owner
  do
    create BurnProposal with admin, owner, holding = self

template BurnProposal
  where
    signatory owner
    observer admin

    choice AcceptBurn : ()
      controller admin
      do
        exercise holding Archive

-- LEGACY: Direct burn (may not work cross-participant)
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
- ✅ ProposeBurn choice (owner → creates BurnProposal) ✨ NEW
- ✅ AcceptBurn choice (admin → completes burn) ✨ NEW
- ⚠️ Burn choice (legacy, may fail cross-participant)

### v2.2.0 (c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae)
**Added**: Direct Burn choice (superseded by ProposeBurn)

**Features**:
- ✅ Issue, Accept, Transfer
- ⚠️ Burn (fails on cross-participant Holdings)

### v2.1.0 (c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d)
- Issue, Accept, Transfer only (no Burn)

### v2.0.1 & v2.0.0
- Basic minting without proposal pattern

## Package ID Management (Updated 2025-10-12)

### Centralized Configuration ✨ NEW
**Location**: `src/config/packageConfig.js`

All services now import from centralized config:
```javascript
export const MINIMAL_TOKEN_PACKAGE_CONFIG = {
  currentVersion: '1.0.0',
  currentPackageId: '1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e',

  versions: {
    '1.0.0': '1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e'
    // Add old versions for backward compatibility if needed
  }
};
```

**Services Using Config**:
1. `src/services/cnQuickstartLedgerService.js` (line 24)
   - Imports `currentPackageId` for command operations
   ```javascript
   this.minimalTokenPackageId = MINIMAL_TOKEN_PACKAGE_CONFIG.currentPackageId;
   ```

2. `server/services/jsonApiV1Service.js` (line 22)
   - Uses all `versions` for query operations
   ```javascript
   this.packageIds = Object.values(MINIMAL_TOKEN_PACKAGE_CONFIG.versions);
   ```

**Automatic Updates**:
- `upload_dar.py` script automatically updates this config file
- Adds new version and keeps existing ones for backward compatibility
- No need to manually update multiple files

**Effect**:
- v1.0.0 used for all new operations (mint, burn proposals, accepts, transfers)
- Can add old versions to `versions` object to query historical contracts
- Single source of truth for package IDs

## Service Architecture

### Actually Used Services ✅
1. **CNQuickstartLedgerService** (`src/services/cnQuickstartLedgerService.js`)
   - **Purpose**: Execute commands (Issue, Accept, ProposeBurn, AcceptBurn, Transfer) via JSON API v2
   - **Used By**: All POST endpoints in `server/routes/cnQuickstartRoutes.js`
   - **Methods**: issueTokens(), acceptProposal(), proposeBurnHolding(), acceptBurnProposal(), transferHolding()

2. **JsonApiV1Service** (`server/services/jsonApiV1Service.js`)
   - **Purpose**: Query contracts (Holdings, HoldingProposals, BurnProposals, Instruments) via JSON API v1
   - **Used By**: `/api/cn/balance/:owner`, `/api/cn/proposals/:owner`, `/api/cn/burn-proposals/:party`
   - **Methods**: queryHoldings(), queryProposals(), queryBurnProposals(), queryInstruments()

### NOT Used Services ❌
- CNQuickstartGrpcBalanceService (imported but never called)
- grpcLedgerService.js (not imported)
- cantonConsoleService.js (not used in API)
- damlLedgerService.js (not used in API)

## Frontend Integration

**Main Service**: `CNQuickstartFrontendService` (`src/services/cnQuickstartFrontendService.js`)
- Calls backend API endpoints
- Methods: initialize, createToken, mintTokens, getProposals, acceptProposal, proposeBurnHolding, acceptBurnProposal, queryBurnProposals, transferHolding, getTokenBalance

**UI State**: `src/App.jsx`
- Added `appProviderParty` state (line 17)
- Added `burnProposals` state (line 41)
- Set via `setAppProviderParty(initResult.appProviderParty)` on init (line 55)
- Used in `transferToAdmin()` function (line 398)
- Admin burn proposals panel (lines 1090-1151)

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

### 2. Cross-Participant Two-Step Burning ✅
```
Owner (app-user) → ProposeBurn choice → BurnProposal created
Admin (app-provider) → AcceptBurn choice → Holding + BurnProposal archived
Result: Tokens removed from supply
```

**Verified**: 2025-10-07 (v2.4.0)
- User clicks "🔥 Burn" → BurnProposal created successfully
- Admin sees proposal in admin panel
- Admin clicks "🔥 Approve Burn" → Both contracts archived
- Balance reflects burn immediately after acceptance

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

**After Upload**: Update `cnQuickstartLedgerService.js` line 24 with new package ID

## Next Steps

### Completed ✅
- ~~Fix Burn Race Condition~~ → Implemented ProposeBurn/AcceptBurn pattern (v2.4.0)
- ~~Test end-to-end burn flow~~ → Verified working on 2025-10-07

### Priority 1: Testing
- Test cross-participant burn with multiple tokens
- Verify backward compatibility with v2.2.0 Instruments
- Load testing with multiple concurrent burn proposals

### Priority 2: Clean Up
- Remove dead code (CNQuickstartGrpcBalanceService, grpcLedgerService, etc.)
- Consider implementing RejectBurn choice (currently placeholder)
- Consider removing Transfer feature if old holdings are permanently hidden

### Priority 3: Enhancements
- Add burn history/audit log
- Add batch burn operations
- Implement burn limits/permissions

## Environment

- **Canton LocalNet**: cn-quickstart (from /Users/e/code/sbc/canton/cn-quickstart/quickstart/docker/modules/localnet)
- **App Provider**: localhost:3975 (JSON API), localhost:3902 (Admin API)
- **App User**: localhost:2975 (JSON API), localhost:2902 (Admin API)
- **Backend Server**: localhost:8899 (Fastify)
- **Frontend Dev Server**: localhost:5173 (Vite)
- **JWT Secret**: "unsafe" (Canton LocalNet default)

## Files Modified (Recent Sessions)

### Dynamic Party Detection + v1.0.0 Package Deployment (2025-10-12)

1. **Centralized Config**: `src/config/packageConfig.js` (CREATED)
   - Centralized package version management
   - Auto-updated by upload_dar.py
   - Imported by both command and query services

2. **Ledger Service**: `src/services/cnQuickstartLedgerService.js`
   - Changed `appProviderParty` from hardcoded to `null` (line 28)
   - Added `initialize()` method for dynamic party detection (lines 70-135)
   - Added `await this.initialize()` to all command methods
   - Updated to use centralized package config (line 24)

3. **Upload Scripts**:
   - `upload_dar.py`: Enhanced to auto-update packageConfig.js
   - `vet_dar.py`: Standalone vetting tool
   - `get_party_id.sh`: Helper to extract current party from logs

4. **Documentation**:
   - `docs/DAR_UPLOAD_GUIDE.md`: Complete deployment guide with quick commands and troubleshooting

5. **DAML Package**: `daml/minimal-token/daml.yaml`
   - Updated version to 1.0.0
   - Clean deployment with consistent ProposeBurn/AcceptBurn pattern

### v2.4.0 Implementation (ProposeBurn/AcceptBurn Pattern - 2025-10-07)

1. **DAML Contract**: `daml/minimal-token/daml/MinimalToken.daml`
   - Added ProposeBurn choice on Holding template
   - Added BurnProposal template with AcceptBurn choice
   - Added RejectBurn choice (placeholder)
   - Kept legacy Burn choice for backward compatibility

2. **DAML Package**: `daml/minimal-token/daml.yaml`
   - Updated version to 2.4.0

3. **Backend Routes**: `server/routes/cnQuickstartRoutes.js`
   - Added `POST /api/cn/holdings/propose-burn` endpoint (lines 370-437)
   - Added `POST /api/cn/burn-proposals/accept` endpoint (lines 439-505)
   - Added `GET /api/cn/burn-proposals/:party` endpoint (lines 507-573)

4. **Ledger Service**: `src/services/cnQuickstartLedgerService.js`
   - Added `proposeBurnHolding()` method (lines 510-598)
   - Added `acceptBurnProposal()` method (lines 721-812)
   - Updated package ID to v2.4.0 (line 24)

5. **JSON API Service**: `server/services/jsonApiV1Service.js`
   - Added `queryBurnProposals()` method (lines 269-325)
   - Updated packageIds to v2.4.0 (line 22)

6. **Frontend Service**: `src/services/cnQuickstartFrontendService.js`
   - Added `proposeBurnHolding()` method (lines 265-301)
   - Added `acceptBurnProposal()` method (lines 303-342)
   - Added `queryBurnProposals()` method (lines 344-379)

7. **Frontend App**: `src/App.jsx`
   - Added `burnProposals` state (line 41)
   - Updated `burnHolding()` to use ProposeBurn (lines 362-385)
   - Added `loadBurnProposals()` handler (lines 503-524)
   - Added `acceptBurnProposal()` handler (lines 526-561)
   - Added admin burn proposals panel UI (lines 1090-1151)
   - Added 1-second delay after accept for Canton processing (line 551)

### v2.2.0 Implementation (Transfer Feature - Previous Session)

1. **Backend Routes**: Added `/api/cn/holdings/transfer` endpoint
2. **Ledger Service**: Added `transferHolding()` method
3. **Frontend**: Added Transfer button and `transferToAdmin()` function

## Key Learnings

1. **Canton LocalNet Party ID Persistence**: Party IDs in Canton LocalNet are **NOT persistent** across restarts. The same party hint (e.g., `app_provider_quickstart-e-1`) gets assigned a different hash suffix each restart. Production Canton has stable party IDs, but LocalNet requires dynamic detection. Solution: Extract from Docker logs using shell commands at runtime.

2. **DAML Contract Immutability**: Old contracts can't gain new choices from upgraded templates. Must create new holdings with new package version to use new choices.

3. **Package Version Matching**: Exercise commands MUST use the exact package ID that created the contract. Cannot exercise v2.4.0 choice on v2.2.0 contract.

4. **Cross-Participant Dual Signatories**: Holdings with `signatory admin, owner` across different participants require special handling:
   - Direct choices controlled by only one signatory may fail with CONTRACT_NOT_ACTIVE
   - Solution: Use propose-and-accept pattern where each party acts separately
   - ProposeBurn (owner creates proposal) → AcceptBurn (admin completes)

5. **Canton Backward Compatibility**: Package upgrades CANNOT remove choices:
   - First attempt (v2.3.0): Removed Burn, added ProposeBurn → Upload failed
   - Solution (v2.4.0): Keep both Burn (legacy) and ProposeBurn (recommended)

6. **UI State Timing**: Canton needs time to process contract archives:
   - After AcceptBurn, BurnProposal and Holding are archived
   - Immediate re-query may still show old contracts
   - Solution: Add 1-second delay before reloading UI state

7. **Service Separation**:
   - JSON API v1 for queries (batch queries with templateIds)
   - JSON API v2 for commands (single operations with full request structure)

8. **Hidden vs Deleted**: Commenting out package IDs HIDES contracts from queries but doesn't delete them from ledger. They still exist and can be queried with correct template ID.

9. **Observer Pattern for Cross-Participant**:
   - BurnProposal has `signatory owner, observer admin`
   - This allows admin on different participant to see and accept proposal
   - AcceptBurn exercises Archive on the Holding, using admin's authority
