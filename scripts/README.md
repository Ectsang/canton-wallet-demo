# Scripts Directory

Utility scripts for Canton Wallet Demo development, testing, and deployment.

---

## Wallet Management

### `create_wallet.sh`

**Purpose**: Standalone script to create a wallet (allocate party) on Canton LocalNet via command line.

**Usage**:
```bash
./scripts/create_wallet.sh <party-hint>
```

**Example**:
```bash
./scripts/create_wallet.sh demo-wallet-1
```

**What it does**:
1. Allocates party via JSON Ledger API (POST /v2/parties on localhost:2975)
2. Grants actAs rights via gRPC User Management Service
3. Grants readAs rights for admin party (cross-participant access)
4. Returns the allocated party ID

**Output**:
```
=== Step 1: Allocate Party via JSON Ledger API ===
Party allocated: demo-wallet-1::1220857149b7...
=== Step 2: Grant actAs Rights ===
actAs rights granted
=== Step 3: Grant readAs Rights for Admin Party ===
Admin party: app_provider::1220...
readAs rights granted for admin
=== Success ===
demo-wallet-1::1220857149b7...
```

**Use cases**:
- Testing wallet creation without the web UI
- Debugging party allocation issues
- Automating wallet creation in scripts
- Creating multiple test wallets quickly

**Dependencies**: Node.js, grpcurl, Canton LocalNet running

---

### `get_app_provider_party.sh`

**Purpose**: Retrieve the admin party ID from app-provider participant.

**Usage**:
```bash
./scripts/get_app_provider_party.sh
```

**Output**:
```
app_provider::1220a1b2c3d4...
```

**Use cases**:
- Get admin party ID for manual operations
- Used by `create_wallet.sh` to grant readAs rights
- Debugging cross-participant operations

**Dependencies**: grpcurl, Canton LocalNet running

---

## DAML Contract Deployment

### `upload_dar.sh`

**Purpose**: Upload and vet DAML contract (DAR file) to both Canton participants with automatic version detection.

**Usage**:
```bash
./scripts/upload_dar.sh
```

**What it does**:
1. Auto-detects version from `daml/minimal-token/daml.yaml`
2. Uploads DAR to both app-provider (3902) and app-user (2902) participants
3. Vets package on both participants with synchronization
4. Updates package ID in `src/config/packageConfig.js` automatically

**Output**:
```
📦 Uploading DAR to app-provider...
✅ app-provider: { "darIds": ["bc5800fb102ebab..."] }

📦 Uploading DAR to app-user...
✅ app-user: { "darIds": ["bc5800fb102ebab..."] }

✅ Upload complete!
📝 Updated package config with version 2.4.0
```

**Prerequisites**:
```bash
cd daml/minimal-token
daml build
cd ../..
```

**Dependencies**: grpcurl, Canton LocalNet running

**See also**: [docs/DAR_UPLOAD_GUIDE.md](../docs/DAR_UPLOAD_GUIDE.md) for detailed information

---

### `upload_dar.py`

**Purpose**: Python version of DAR upload script (legacy, prefer `upload_dar.sh`).

**Usage**:
```bash
python3 ./scripts/upload_dar.py <version>
```

**Example**:
```bash
python3 ./scripts/upload_dar.py 2.4.0
```

**Note**: The shell script version (`upload_dar.sh`) is now preferred as it auto-detects the version and updates config automatically.

---

### `vet_dar.py`

**Purpose**: Vet (approve) a specific package ID on Canton participants.

**Usage**:
```bash
python3 ./scripts/vet_dar.py <package-id>
```

**Example**:
```bash
python3 ./scripts/vet_dar.py bc5800fb102ebab939780f60725fc87c5c0f93c947969c8b2fc2bb4f87d471de
```

**Use cases**:
- Fix "403 security-sensitive error" after DAR upload
- Re-vet packages after Canton restart
- Manual vetting if automatic vetting failed

**Note**: `upload_dar.sh` now includes automatic vetting, so this script is rarely needed.

---

## Server Management

### `start-server.js`

**Purpose**: Node.js script to start the backend Fastify server with proper error handling.

**Usage** (via npm scripts):
```bash
npm run server:start       # Normal start
npm run server:dev         # Development mode with auto-restart
npm run server:stop        # Stop server and clean port 8899
npm run server:start:robust # Handle port conflicts
```

**Direct usage**:
```bash
node scripts/start-server.js
```

**What it does**:
- Starts Fastify server on port 8899
- Initializes Canton SDK connection
- Provides health check endpoint
- Logs server startup and errors

---

## Quick Reference

### Common Workflows

**Deploy new DAML contract version**:
```bash
cd daml/minimal-token
daml build
cd ../..
./scripts/upload_dar.sh
```

**Create a test wallet**:
```bash
./scripts/create_wallet.sh test-wallet-$(date +%s)
```

**Get admin party ID**:
```bash
./scripts/get_app_provider_party.sh
```

**Start development environment**:
```bash
npm run server:start    # Terminal 1
npm run dev             # Terminal 2
```

---

## Troubleshooting

### "grpcurl: command not found"
Install grpcurl:
```bash
brew install grpcurl  # macOS
# or
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest
```

### "Connection refused" errors
Ensure Canton LocalNet is running:
```bash
cd /path/to/cn-quickstart/quickstart/docker/modules/localnet
make start
```

### "403 security-sensitive error"
Re-upload and vet the DAR:
```bash
./scripts/upload_dar.sh
```

---

## Port Reference

**App Provider** (admin):
- Ledger API: 3901 (gRPC)
- Admin API: 3902 (gRPC)
- JSON API: 3975 (HTTP)

**App User** (external wallets):
- Ledger API: 2901 (gRPC)
- Admin API: 2902 (gRPC)
- JSON API: 2975 (HTTP)

**Backend Server**: 8899 (HTTP)

**Frontend Dev Server**: 5174 (HTTP)
