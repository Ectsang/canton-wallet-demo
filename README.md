# Canton Wallet Demo

A web application demonstrating **real DAML contract operations** on Canton Network LocalNet. This demo creates actual Instrument and Holding contracts on the Canton ledger using JSON Ledger API with JWT authentication.

**✅ FULLY OPERATIONAL** - End-to-end two-step minting flow verified working (2025-10-06)

## Features

- **Real DAML Integration**: Creates actual contracts on Canton ledger via JSON Ledger API v1/v2
- **Cross-Participant Minting**: Issue and Accept tokens across different participants
- **Two-Step Minting Flow**:
  - Step 1: Issue choice creates HoldingProposal (proposal to mint)
  - Step 2: Accept choice creates Holding (actual token balance)
- **Multi-Token Support**: Create and manage multiple token types with dropdown selector
- **Balance Queries**: Real-time balance display with breakdown by token symbol
- **Proposal Management**: View and accept pending HoldingProposals
- **Party Management**: Canton console integration for wallet setup with actAs/readAs rights

## Prerequisites

- Node.js (v18 or higher)
- A running Canton Network LocalNet instance from cn-quickstart
- Canton Network services running on:
  - **App Provider**:
    - JSON API: localhost:3975
    - Admin API: localhost:3902
  - **App User**:
    - JSON API: localhost:2975
    - Admin API: localhost:2902
  - Canton Console: Available for party/user management

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd canton-wallet-demo
```

2. Install dependencies:
```bash
npm install
```

3. Start the backend server:
```bash
npm run server:start
```

4. Start the frontend development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5174`

## Usage

### Quick Start

1. **Initialize**: App automatically connects to Canton Network (localhost:3975)
2. **Setup Wallet**:
   - Use existing party ID (e.g., `demo-wallet-1::1220...`)
   - Or create new party via Canton console (see Onboarding section)
3. **Create Token**: Name, symbol, decimals → Creates Instrument contract
4. **Issue Tokens** (Step 1/2): Select token, enter amount → Creates HoldingProposal
5. **Accept Proposal** (Step 2/2): Click Accept in Section 4 → Creates Holding
6. **View Balance**: Real-time balance with breakdown by token symbol

### UI Sections

1. **Connection Status**: Shows Canton Network connectivity
2. **Wallet Management**: Create/use external wallet, view party ID
3. **Token Creation**: Create new tokens or select from existing
4. **Pending Proposals**: View and accept HoldingProposals
5. **Minting**: Issue tokens (creates proposals)
6. **Balance Display**: Current balance breakdown by token

### Cross-Participant Setup

For cross-participant operations (owner on different participant than admin), you need to grant JWT user rights via Canton console:

```scala
// Grant actAs rights for the owner party
participants.app_user.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  actAs = Set(PartyId.tryFromProtoPrimitive("owner-party-id::..."))
)

// Grant readAs rights for the admin party
participants.app_user.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  readAs = Set(PartyId.tryFromProtoPrimitive("app_provider_quickstart-e-1::..."))
)
```

See [CONTEXT.md](./CONTEXT.md) for detailed troubleshooting.

## Uploading DARs to Canton

**CRITICAL**: Use this proven method to upload new DAR versions to Canton participants.

### Method: grpcurl via Python Script

Create a Python script like `/tmp/upload_dar_v2.2.0.py`:

```python
import subprocess
import base64
import json

# Read DAR file
dar_path = '/path/to/your/minimal-token-autoaccept-X.Y.Z.dar'
with open(dar_path, 'rb') as f:
    dar_bytes = f.read()

# Encode to base64 for JSON
dar_b64 = base64.b64encode(dar_bytes).decode('utf-8')

# Create upload request
upload_request = {
    "dars": [
        {
            "bytes": dar_b64,
            "description": "MinimalToken vX.Y.Z - Description of changes"
        }
    ],
    "vet_all_packages": True,
    "synchronize_vetting": True
}

json_data = json.dumps(upload_request)

# Upload to app-provider (port 3902)
print("📦 Uploading DAR to app-provider...")
result = subprocess.run([
    'grpcurl', '-plaintext',
    '-d', json_data,
    'localhost:3902',
    'com.digitalasset.canton.admin.participant.v30.PackageService/UploadDar'
], capture_output=True, text=True)

if result.returncode == 0:
    print("✅ app-provider:", result.stdout.strip())
else:
    print("❌ app-provider error:", result.stderr.strip())
    exit(1)

# Upload to app-user (port 2902)
print("\n📦 Uploading DAR to app-user...")
result2 = subprocess.run([
    'grpcurl', '-plaintext',
    '-d', json_data,
    'localhost:2902',
    'com.digitalasset.canton.admin.participant.v30.PackageService/UploadDar'
], capture_output=True, text=True)

if result2.returncode == 0:
    print("✅ app-user:", result2.stdout.strip())
else:
    print("❌ app-user error:", result2.stderr.strip())
    exit(1)

print("\n✅ Upload complete!")
```

Then run:
```bash
python3 /tmp/upload_dar_v2.2.0.py
```

**Expected Output**:
```
📦 Uploading DAR to app-provider...
✅ app-provider: {
  "darIds": [
    "c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae"
  ]
}

📦 Uploading DAR to app-user...
✅ app-user: {
  "darIds": [
    "c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae"
  ]
}

✅ Upload complete!
```

### After Upload

Update `src/services/cnQuickstartLedgerService.js` with the new package ID:

```javascript
this.minimalTokenPackageId = 'c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae';
```

**Why This Method Works**:
- ✅ Uses grpcurl with Canton's PackageService gRPC API
- ✅ No Python protobuf dependencies required
- ✅ Direct participant upload (ports 3902, 2902)
- ✅ Proper vetting and synchronization
- ✅ Returns package IDs for verification

**Methods That DON'T Work**:
- ❌ `daml ledger upload-dar` (authentication errors)
- ❌ Python gRPC with Canton protobufs (missing modules)
- ❌ Canton console via piped commands (participant name issues)

## Architecture

### DAML Integration Architecture
- **JSON Ledger API**: v2 for commands, v1 for queries
- **JWT Authentication**: HMAC-SHA256 signed tokens with `scope: 'daml_ledger_api'`
- **Real Contracts**: Actual Instrument, HoldingProposal, and Holding contracts on ledger
- **DAML Finance Pattern**: Holding has both admin and owner as signatories
- **Cross-Participant**: Admin on app-provider, owners on app-user participant
- **No Mocks**: 100% real Canton ledger operations

### Tech Stack
- **Frontend**: React 19.1.1 + Vite 7.1.5
- **Backend**: Fastify server (port 8899)
- **DAML**: MinimalToken v2.2.0 contracts (with Burn choice)
- **Canton**: LocalNet from cn-quickstart
- **Package ID (v2.2.0)**: `c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae`
- **Package ID (v2.1.0)**: `c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d`
- **Package ID (v2.0.1)**: `2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118`
- **Package ID (v2.0.0)**: `eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de`

## Project Structure

```
canton-wallet-demo/
├── src/
│   ├── App.jsx                      # Main React component
│   ├── services/
│   │   └── cantonConsoleService.js  # Real Canton integration
│   ├── index.css                    # Styles
│   └── main.jsx                     # React entry point
├── server/
│   ├── index.js                     # Fastify server
│   └── routes/                      # API routes
├── daml/
│   └── minimal-token/               # DAML contracts
├── scripts/                         # Utility scripts
└── docs/
    └── PRD.md                       # Product requirements
```

## Real Canton Operations

This demo performs **actual DAML operations** on Canton ledger:

### API Integration
1. **Commands** (v2): `POST /v2/commands/submit-and-wait-for-transaction`
   - CreateCommand (Instrument)
   - ExerciseCommand (Issue, Accept)
2. **Queries** (v1): `POST /v1/query` with templateIds
   - Query Holdings by owner
   - Query HoldingProposals by owner
   - Query Instruments by admin

### DAML Contract Flow (MinimalToken v2.2.0)

```
Instrument (signatory: admin)
  ↓ Issue choice (controller: admin)
HoldingProposal (signatory: admin, observer: owner)
  ↓ Accept choice (controller: owner)
Holding (signatory: admin, owner)  ← Both sign (DAML Finance pattern)
  ↓ Burn choice (controller: owner)
Archived ← Reduces supply
```

**Key Design Decisions:**
1. **Both Signatories**: Holding requires both admin and owner signatures (standard DAML Finance pattern)
2. **Combined Authority**: When owner exercises Accept, they gain combined authority from proposal signatory
3. **Cross-Participant**: Works because Accept choice gives owner signing rights
4. **ACS Visibility**: Both signatories ensure Holdings appear in owner's ACS queries
5. **Burn Choice**: Owner can burn tokens (archives Holding contract), both parties sign via signatories

### Verified Test Case (2025-10-06)
- Token: USA Token (symbol: USA)
- Flow: Create Instrument → Issue (HoldingProposal) → Accept (Holding) ✅
- Cross-participant: app-provider (admin) → app-user (demo-wallet-1) ✅
- Balance query: Returns 1000 USA tokens ✅

**No mocks, no simulations - everything is real Canton ledger data!**

## License

ISC License