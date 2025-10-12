# Quick Reference - DAR Deployment

## One-Command Deploy

```bash
# Build and upload new version (auto-detects version from daml.yaml)
cd daml/minimal-token && daml build && cd ../.. && ./scripts/upload_dar.sh
```

## Step-by-Step Deploy

```bash
# 1. Update version in daml.yaml
vim daml/minimal-token/daml.yaml

# 2. Build
cd daml/minimal-token
daml clean && daml build

# 3. Upload (from project root - auto-detects version!)
cd ../..
./scripts/upload_dar.sh

# 4. Verify
cat src/config/packageConfig.js

# 5. Restart server
npm run server:stop
npm run server:start
```

## File Locations

```
scripts/upload_dar.sh                # Upload & vet script (shell, auto-detects version)
scripts/upload_dar.py                # Python alternative (requires PyYAML)
vet_dar.py                           # Standalone vetting script for existing packages
src/config/packageConfig.js          # Centralized package config (auto-updated)
daml/minimal-token/daml.yaml         # DAML version definition
docs/DAR_UPLOAD_GUIDE.md             # Full documentation
```

## Manual Vetting (if needed)

If you get a "security-sensitive error" (403), the DAR needs vetting:

```bash
# Vet a specific package
python3 vet_dar.py <package-id>

# Example
python3 vet_dar.py 1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e
```

## Configuration Used By

- `src/services/cnQuickstartLedgerService.js` - Commands use currentPackageId
- `server/services/jsonApiV1Service.js` - Queries use all versions

## Verify Upload

```bash
# Check config
node -e "import('./src/config/packageConfig.js').then(m => console.log(m.default))"

# Check Canton participants
grpcurl -plaintext localhost:3902 com.digitalasset.canton.admin.participant.v30.PackageService/ListPackages
grpcurl -plaintext localhost:2902 com.digitalasset.canton.admin.participant.v30.PackageService/ListPackages
```

## Important: Party IDs Change on Canton Restart!

**Canton LocalNet generates NEW party IDs every time it restarts.** The backend now fetches the party ID **dynamically** on initialization.

If you need the current party ID for debugging:
```bash
./get_party_id.sh
```

## Current Deployment

- **Version:** 1.0.0
- **Package ID:** `1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e`
- **Uploaded:** 2025-10-12
- **Status:** ✅ Active
- **Party Discovery:** ✅ Automatic
