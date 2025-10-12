# Complete User Flow - Canton Wallet Demo

This document explains every step from cloning the repo to burning tokens, including what's automated and what users need to do.

---

## Prerequisites

- Docker installed and running
- Node.js 18+ installed
- Canton LocalNet (cn-quickstart) cloned

---

## Part 1: System Setup (One-Time)

### Step 1: Start Canton LocalNet

```bash
# Navigate to Canton LocalNet directory
cd /path/to/cn-quickstart/quickstart/

# Start Canton
make start

# Wait for Canton to fully start (look for "Canton is ready" in logs)
docker logs -f canton
```

**What happens:**

- Canton LocalNet starts with two participants:
  - `app-provider` (admin) on ports 3901/3902/3975
  - `app-user` (external wallets) on ports 2901/2902/2975
- Both participants generate **NEW party IDs** on each restart
- The `app_provider_quickstart-e-1` party is automatically created

---

### Step 2: Clone and Install Demo App

```bash
# Clone the repository
git clone <repo-url>
cd canton-wallet-demo

# Install dependencies
npm install
```

---

### Step 3: Build and Deploy DAML Contract

```bash
# Build the DAML contract
cd daml/minimal-token
daml build
cd ../..

# Upload and vet DAR to both participants (AUTOMATED via script)
# Version is auto-detected from daml.yaml - no need to specify!
./scripts/upload_dar.sh
```

**What `upload_dar.sh` does automatically:**

1. Reads version from `daml/minimal-token/daml.yaml` (auto-detection!)
2. Reads the built DAR file from `daml/minimal-token/.daml/dist/`
3. Encodes it to base64
4. Uploads to **both** participants via gRPC:
   - app-provider (localhost:3902)
   - app-user (localhost:2902)
5. **Vets the package** on both participants (required for transactions)
6. Extracts the package ID from response
7. **Updates `src/config/packageConfig.js`** with the new package ID

**Output:**

```text
📝 Reading version from daml.yaml...
✅ Found version: 1.0.0

🚀 Canton DAR Upload Tool
📦 Version: 1.0.0
📁 DAR path: .../daml/minimal-token/.daml/dist/minimal-token-1.0.0.dar

📦 Reading DAR file...
✅ Encoded DAR file (274489 bytes)

🚀 Uploading to app-provider (localhost:3902)...
✅ app-provider upload successful
📦 Package ID: 1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e

🚀 Uploading to app-user (localhost:2902)...
✅ app-user upload successful

🔒 Vetting DAR on participants...
  ✅ app-provider vetting successful
  ✅ app-user vetting successful
✅ DAR vetting complete

📝 Updating package configuration: .../src/config/packageConfig.js
✅ Updated package configuration
```

**Why vetting matters:**

- Canton security requires explicit approval before packages can be used
- Without vetting, all transaction attempts will fail with 403 "security-sensitive error"
- The script automatically vets during upload, so no manual vetting needed

---

### Step 4: Start Backend Server

```bash
# Start the backend (handles Canton SDK operations)
npm run server:start
```

**What the backend does on startup (AUTOMATED):**

1. Connects to Canton LocalNet JSON API (localhost:3975)
2. **Dynamically fetches app_provider party ID** from Docker logs:

   ```javascript
   // Extracts: app_provider_quickstart-e-1::1220c19f3e...
   execSync('docker logs canton 2>&1 | grep "app_provider_quickstart-e-1::"')
   ```

3. Stores party ID in memory for all admin operations

**Why dynamic party detection:**

- Canton LocalNet generates NEW party IDs on every restart
- Old hardcoded party IDs become invalid
- Backend automatically discovers current party ID, no manual config needed

---

### Step 5: Start Frontend

```bash
# In a new terminal
npm run dev

# Open browser to http://localhost:5173
```

---

## Part 2: User Wallet Flow (What Users Do)

### Step 6: Initialize Connection

**User action:** Page loads automatically

**What happens (AUTOMATED):**

1. Frontend calls `POST /api/cn/init`
2. Backend returns current app_provider party ID
3. Frontend saves it for later use (e.g., transfers to admin)
4. UI shows: ✅ Connected to CN Quickstart

**Behind the scenes:**

```javascript
// Frontend: src/App.jsx
const initResult = await cantonService.initialize();
setAppProviderParty(initResult.appProviderParty);

// Backend: server/routes/cnQuickstartRoutes.js
GET /api/cn/init → returns { appProviderParty: "app_provider_quickstart-e-1::1220..." }
```

---

### Step 7: Create External Wallet (Enable Party on app-user)

**User action:**

1. Enter party hint: `demo-wallet-1` (or any identifier)
2. Click "Create External Wallet"

**What happens (AUTOMATED via backend):**

1. Frontend calls `POST /api/cn/wallets/external` with partyHint
2. Backend performs FIVE operations:

   a. **Generates Ed25519 key pair** (public + private keys)

   ```javascript
   const keyPair = await canton.crypto.generateKeyPair('Ed25519');
   ```

   b. **Enables party on app-user participant** via gRPC:

   ```bash
   grpcurl -d '{"party_hint": "demo-wallet-1"}' \
     localhost:2902 \
     com.digitalasset.canton.admin.participant.v30.PartyManagementService/AllocateParty
   ```

   Returns: `demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21`

   c. **Grants JWT user rights** so party can authenticate:

   ```bash
   grpcurl -d '{
     "user_id": "ledger-api-user",
     "rights": [{
       "participant_admin": {}
     }, {
       "can_act_as": {"party": "demo-wallet-1::1220..."}
     }]
   }' localhost:2902 \
     com.digitalasset.canton.admin.user.v30.UserManagementService/GrantUserRights
   ```

   d. **Stores keys in memory** on backend (Map: partyId → keys)

   ```javascript
   walletKeys.set(partyId, { publicKey, privateKey });
   ```

   e. **Returns wallet info** to frontend

3. Frontend saves wallet to localStorage
4. UI shows wallet details (party ID, public key, private key, fingerprint)

**User sees:**

```
✅ Wallet Details
Party Hint: demo-wallet-1
Party ID: demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21
Public Key: 3082...
Private Key: 3082... (Ed25519 private key for signing)
Fingerprint: 12203bef...
```

**No vetting needed:** Party enabling and JWT rights are sufficient for wallet operations.

---

### Alternative: Use Existing Party ID

**User action:**

1. Paste existing party ID: `demo-wallet-1::1220...` (from previous session)
2. Click "Use Existing Party"

**What happens:**

- Frontend saves party ID to localStorage
- No backend call needed (party already enabled in Canton)
- Keys were already granted in previous session

**Note:** This only works if the party was created before Canton restart. After restart, all party IDs change.

---

### Step 8: Create Token (Instrument Contract)

**User action:**

1. Enter token name: `Demo Token`
2. Enter token symbol: `DEMO`
3. Enter decimals: `2`
4. Click "Create Token"

**What happens (AUTOMATED):**

1. Frontend calls `POST /api/cn/tokens/create`
2. Backend calls Canton JSON Ledger API v2:

   ```javascript
   // Generate JWT for admin
   const token = generateJWT(appProviderParty);

   // Create Instrument contract
   POST http://localhost:3975/v2/commands/submit-and-wait-for-transaction
   {
     "commands": {
       "actAs": ["app_provider_quickstart-e-1::1220..."],
       "commands": [{
         "CreateCommand": {
           "templateId": "1bf66b0c....:MinimalToken:Instrument",
           "createArguments": {
             "admin": "app_provider_quickstart-e-1::1220...",
             "name": "Demo Token",
             "symbol": "DEMO",
             "decimals": 2
           }
         }
       }]
     }
   }
   ```

3. Canton creates **Instrument contract** on ledger
4. Backend extracts contract ID from response
5. Backend returns token info to frontend
6. Frontend saves token to localStorage

**User sees:**

```
✅ Token Details
Token Name: Demo Token
Token Symbol: DEMO
Decimals: 2
Contract ID: 00dbb2f8dc2cccdade703b1b002dfba9110c4e75f590a80ea00b09cde2ab147c5aca111220...
Admin: app_provider_quickstart-e-1::1220...
✅ Real DAML Contract - This token exists on Canton ledger
```

**No vetting needed:** The package was already vetted during Step 3 (upload_dar.py). Admin can now create contracts.

---

### Step 9: Mint Tokens (Two-Step Flow)

#### Step 9a: Issue Tokens (Create HoldingProposal)

**User action:**

1. Enter amount: `1000`
2. Click "Step 1: Issue 1000 DEMO (Create Proposal)"

**What happens (AUTOMATED):**

1. Frontend calls `POST /api/cn/tokens/mint`
2. Backend exercises **Issue choice** on Instrument contract:

   ```javascript
   // Admin exercises Issue choice
   POST http://localhost:3975/v2/commands/submit-and-wait-for-transaction
   {
     "commands": {
       "actAs": ["app_provider_quickstart-e-1::1220..."],  // Admin
       "commands": [{
         "ExerciseCommand": {
           "templateId": "1bf66b0c....:MinimalToken:Instrument",
           "contractId": "00dbb2f8dc2c...",  // Instrument ID
           "choice": "Issue",
           "choiceArgument": {
             "owner": "demo-wallet-1::1220...",  // User's wallet
             "amount": "1000"
           }
         }
       }]
     }
   }
   ```

3. Canton creates **HoldingProposal contract**:

   ```daml
   template HoldingProposal
     with
       admin   : Party  -- app_provider (signatory)
       owner   : Party  -- demo-wallet-1 (observer)
       instrument : ContractId Instrument
       amount  : Decimal
     where
       signatory admin
       observer owner
   ```

4. Backend extracts proposal ID from response
5. Frontend shows pending proposal

**User sees:**

```
✅ Step 1/2: HoldingProposal created! Proposal ID: 00afe1c3d8e7...
```

**Why two steps?**

- Admin (app-provider) and owner (demo-wallet-1) are on **different participants**
- Canton requires propose-and-accept pattern for cross-participant minting
- Admin proposes → Owner accepts

---

#### Step 9b: Accept Proposal (Create Holding)

**User action:**

1. Click "Step 2: Accept Proposal (Mint Tokens)"
   OR
2. Click "✅ Accept & Mint Tokens" in the "Your Pending Proposals" section

**What happens (AUTOMATED):**

1. Frontend calls `POST /api/cn/proposals/accept`
2. Backend exercises **Accept choice** on HoldingProposal:

   ```javascript
   // Owner (demo-wallet-1) exercises Accept choice on THEIR participant (app-user)
   POST http://localhost:2975/v2/commands/submit-and-wait-for-transaction
   {
     "commands": {
       "actAs": ["demo-wallet-1::1220..."],  // Owner acts
       "readAs": ["app_provider_quickstart-e-1::1220..."],  // Admin read access
       "commands": [{
         "ExerciseCommand": {
           "templateId": "1bf66b0c....:MinimalToken:HoldingProposal",
           "contractId": "00afe1c3d8e7...",  // Proposal ID
           "choice": "Accept",
           "choiceArgument": {}
         }
       }]
     }
   }
   ```

   **Important:** Request goes to **localhost:2975** (app-user), not 3975 (app-provider)

3. Canton:
   - Archives HoldingProposal contract
   - Creates **Holding contract**:

     ```daml
     template Holding
       with
         admin   : Party
         owner   : Party
         instrument : ContractId Instrument
         amount  : Decimal
       where
         signatory admin, owner  -- BOTH parties sign
     ```

4. Backend extracts Holding contract ID
5. Frontend updates balance display

**User sees:**

```
✅ Step 2/2: SUCCESS! Tokens minted. Holding ID: 00c8f2d9e1a3...

Your Token Holdings
Total Balance: 1000 tokens

Breakdown by Token:
Demo Token (DEMO)
1000 DEMO
1 holding
```

---

### Step 10: Query Token Balance (View Holdings)

**What happens (AUTOMATIC on page load and after each operation):**

1. Frontend calls `GET /api/cn/balance/:ownerPartyId`
2. Backend queries active contracts via JSON API v1:

   ```javascript
   // Query Holdings for owner (demo-wallet-1)
   POST http://localhost:2975/v2/state/active-contracts
   {
     "filter": {
       "filtersByParty": {
         "demo-wallet-1::1220...": {
           "inclusive": [
             { "templateId": "1bf66b0c....:MinimalToken:Holding" }
           ]
         }
       }
     }
   }
   ```

   **Important:** Uses **localhost:2975** (app-user) where the owner is registered

3. Backend also queries Instrument contracts to get token metadata
4. Groups holdings by instrument
5. Returns breakdown to frontend

**User sees (automatically):**

```
Your Token Holdings
Total Balance: 1000 tokens

Breakdown by Token:
  Demo Token (DEMO)
  00dbb2f8dc2c... (Instrument ID)
  1000 DEMO
  1 holding

  Individual Holdings:
  [Holding 1] 00c8f2d9e1a3... - 1000 DEMO  [🔥 Burn]
```

**No vetting needed:** Queries don't require vetting, only commands do.

---

### Step 11: Burn Tokens (Two-Step Flow)

#### Step 11a: Propose Burn (Create BurnProposal)

**User action:**

1. Find a holding in "Your Token Holdings" section
2. Click "🔥 Burn" button next to the holding

**What happens (AUTOMATED):**

1. Frontend calls `POST /api/cn/holdings/propose-burn`
2. Backend exercises **ProposeBurn choice** on Holding:

   ```javascript
   // Owner (demo-wallet-1) exercises ProposeBurn on THEIR participant
   POST http://localhost:2975/v2/commands/submit-and-wait-for-transaction
   {
     "commands": {
       "actAs": ["demo-wallet-1::1220..."],  // Owner acts
       "commands": [{
         "ExerciseCommand": {
           "templateId": "1bf66b0c....:MinimalToken:Holding",
           "contractId": "00c8f2d9e1a3...",  // Holding to burn
           "choice": "ProposeBurn",
           "choiceArgument": {}
         }
       }]
     }
   }
   ```

3. Canton creates **BurnProposal contract**:

   ```daml
   template BurnProposal
     with
       admin   : Party
       owner   : Party
       holding : ContractId Holding
     where
       signatory owner  -- Owner creates it
       observer admin   -- Admin can see it
   ```

4. Backend returns success
5. Frontend shows success message

**User sees:**

```
🔥 Burn proposal created for 1000 DEMO tokens! Waiting for admin to accept...
```

**Why two steps?**

- Holding has **two signatories**: admin and owner (on different participants)
- Direct burn would fail with CONTRACT_NOT_ACTIVE
- Solution: Owner proposes → Admin accepts

---

#### Step 11b: Accept Burn (Archive Holding)

**User action (acting as admin):**

1. Admin sees "🔥 Admin: Burn Proposals" panel appear
2. Click "🔥 Approve Burn"

**What happens (AUTOMATED):**

1. Frontend calls `POST /api/cn/burn-proposals/accept`
2. Backend exercises **AcceptBurn choice** on BurnProposal:

   ```javascript
   // Admin exercises AcceptBurn on THEIR participant (app-provider)
   POST http://localhost:3975/v2/commands/submit-and-wait-for-transaction
   {
     "commands": {
       "actAs": ["app_provider_quickstart-e-1::1220..."],  // Admin acts
       "commands": [{
         "ExerciseCommand": {
           "templateId": "1bf66b0c....:MinimalToken:BurnProposal",
           "contractId": "00b3e7a1f5c2...",  // BurnProposal ID
           "choice": "AcceptBurn",
           "choiceArgument": {}
         }
       }]
     }
   }
   ```

   **Important:** Request goes to **localhost:3975** (app-provider) where admin is

3. Canton **archives BOTH contracts**:
   - BurnProposal (consumed by AcceptBurn)
   - Holding (exercised via `exercise holding Archive`)

4. Frontend waits 1 second for Canton to process archives
5. Reloads balance and burn proposals

**User sees:**

```
✅ Burn approved! Holding has been burned.

Your Token Holdings
Total Balance: 0 tokens
```

**Result:** Tokens are permanently removed from the ledger (Holding archived).

---

## Summary: What's Automated vs Manual

### Fully Automated (Scripts/Backend)

1. ✅ **DAR vetting** (`upload_dar.py`)
2. ✅ **Party ID detection** (backend on startup)
3. ✅ **Party enabling** (backend creates external wallet)
4. ✅ **JWT rights grant** (backend creates external wallet)
5. ✅ **Key generation and storage** (backend)
6. ✅ **Contract creation** (Instrument, HoldingProposal, BurnProposal)
7. ✅ **Cross-participant coordination** (correct participant selection)
8. ✅ **Balance queries** (automatic after operations)

### User Actions Required

1. ⚙️ Start Canton LocalNet (`make start`)
2. ⚙️ Run upload script once (`./scripts/upload_dar.sh`)
3. ⚙️ Start backend server (`npm run server:start`)
4. ⚙️ Start frontend (`npm run dev`)
5. 🖱️ Click "Create External Wallet"
6. 🖱️ Click "Create Token"
7. 🖱️ Click "Issue Tokens" (Step 1)
8. 🖱️ Click "Accept Proposal" (Step 2)
9. 🖱️ Click "🔥 Burn" (propose)
10. 🖱️ Click "🔥 Approve Burn" (accept as admin)

---

## Key Technical Details

### Party ID Format

```
party-hint::fingerprint
demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21
└─────┬─────┘ └──────────────────────────────┬─────────────────────────────────┘
   Hint                          Canton-generated hash (changes on restart)
```

### Participant Mapping

- **app-provider** (admin):
  - JSON API: localhost:3975
  - Admin API: localhost:3902
  - Party: `app_provider_quickstart-e-1::1220...`

- **app-user** (external wallets):
  - JSON API: localhost:2975
  - Admin API: localhost:2902
  - Party: `demo-wallet-1::1220...` (or any user-created party)

### JWT Authentication

All API calls require JWT with `actAs` claim:

```javascript
{
  "sub": "ledger-api-user",
  "aud": "https://canton.network.global",
  "actAs": ["demo-wallet-1::1220..."],
  "readAs": [],  // Optional, for observer access
  "exp": 1760260773,
  "iat": 1760257173
}
```

Signed with HMAC-SHA256 using secret: `"unsafe"` (LocalNet only)

### Cross-Participant Contract Visibility

Canton automatically shares contracts to observers:

- **HoldingProposal**: Admin (signatory) → Owner (observer) sees it on app-user
- **BurnProposal**: Owner (signatory) → Admin (observer) sees it on app-provider
- **Holding**: Both admin and owner are signatories, visible on both participants

---

## Troubleshooting

### "403 security-sensitive error"

- **Cause**: DAR not vetted, or wrong party ID
- **Fix**: Run `./scripts/upload_dar.sh` (auto-vets), restart backend

### "Party not found"

- **Cause**: Canton restarted, party IDs changed
- **Fix**: Restart backend (auto-detects new party ID), create new wallet

### "CONTRACT_NOT_ACTIVE"

- **Cause**: Trying to exercise choice without all required signatories
- **Fix**: Use propose-and-accept pattern (already implemented)

### Tokens not showing in balance

- **Cause**: Querying wrong participant
- **Fix**: Backend automatically queries correct participant (app-user for external wallets)

---

## Files Reference

### Scripts

- `scripts/upload_dar.sh` - Upload and vet DAR, update config (auto-detects version)
- `scripts/upload_dar.py` - Python version (alternative, requires PyYAML)
- `vet_dar.py` - Standalone vetting tool
- `get_party_id.sh` - Extract current admin party from logs

### Config

- `src/config/packageConfig.js` - Centralized package IDs (auto-updated)

### Backend Services

- `src/services/cnQuickstartLedgerService.js` - Command operations (Issue, Accept, ProposeBurn, AcceptBurn)
- `server/services/jsonApiV1Service.js` - Query operations (balance, proposals)

### Frontend

- `src/App.jsx` - Main UI with wallet/token/burn flows
- `src/services/cnQuickstartFrontendService.js` - API client

### Documentation

- `docs/DAR_UPLOAD_GUIDE.md` - Complete deployment guide with quick commands
- `CONTEXT.md` - Technical context and history
