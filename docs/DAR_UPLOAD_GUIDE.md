# DAR Upload & Deployment Guide

Complete guide for building, uploading, and deploying DAML contracts to Canton LocalNet.

## Quick Reference

### One-Command Deploy

```bash
# Build and upload new version (auto-detects version from daml.yaml)
cd daml/minimal-token && daml build && cd ../.. && ./scripts/upload_dar.sh
```

### Step-by-Step Deploy

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

## Prerequisites

1. Canton LocalNet running (cn-quickstart)
2. `grpcurl` installed (`brew install grpcurl` on macOS)
3. `jq` installed (`brew install jq` on macOS) - for shell script JSON parsing
4. Python 3 + PyYAML (optional, only if using Python upload script)

## File Locations

```text
scripts/upload_dar.sh                # Upload & vet script (shell, auto-detects version)
scripts/upload_dar.py                # Python alternative (requires PyYAML)
scripts/vet_dar.py                   # Standalone vetting script for existing packages
src/config/packageConfig.js          # Centralized package config (auto-updated)
daml/minimal-token/daml.yaml         # DAML version definition
docs/DAR_UPLOAD_GUIDE.md             # This documentation
```

## Building the DAML Contract

Navigate to the DAML project directory and build:

```bash
cd daml/minimal-token
daml clean && daml build
```

This creates a `.dar` file in `.daml/dist/minimal-token-<version>.dar`

## Uploading the DAR

### Recommended: Shell Script (Auto-detects Version)

```bash
./scripts/upload_dar.sh
```

**Why use this?**

- ✅ Auto-detects version from daml.yaml (no arguments needed)
- ✅ No Python dependencies required
- ✅ Faster and simpler

**Requirements:** `grpcurl` and `jq` (install via `brew install grpcurl jq`)

### Alternative: Python Script

```bash
# Auto-detect version from daml.yaml
python3 ./scripts/upload_dar.py

# Or specify version explicitly
python3 ./scripts/upload_dar.py 1.0.0
```

**Why use this?**

- When you prefer Python
- Already have Python environment set up

**Requirements:** Python 3, `grpcurl`, PyYAML (`pip install pyyaml`)

### What the Script Does

1. **Reads the DAR file** from `daml/minimal-token/.daml/dist/`
2. **Encodes it to base64** for gRPC upload
3. **Uploads to both participants**:
   - app-provider (localhost:3902)
   - app-user (localhost:2902)
4. **Vets the DAR** on both participants (required for transaction usage)
5. **Extracts the package ID** from the upload response
6. **Updates configuration** automatically in `src/config/packageConfig.js`

### Package Configuration

The script maintains a centralized configuration file at `src/config/packageConfig.js`:

```javascript
export const MINIMAL_TOKEN_PACKAGE_CONFIG = {
  // Current active version
  currentVersion: '1.0.0',
  currentPackageId: '1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e',

  // All deployed versions (newest first)
  versions: {
    '1.0.0': '1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e',
    // Older versions for backward compatibility...
  }
};
```

### Services Updated Automatically

Both services import from the centralized config:

- `src/services/cnQuickstartLedgerService.js` - Uses `currentPackageId` for commands
- `server/services/jsonApiV1Service.js` - Uses all `versions` for queries

## Manual Upload (if needed)

If you prefer manual upload or the script fails:

```bash
# 1. Encode DAR to base64
dar_b64=$(base64 -i daml/minimal-token/.daml/dist/minimal-token-1.0.0.dar)

# 2. Create upload request JSON
cat > upload_request.json <<EOF
{
  "dars": [{
    "bytes": "${dar_b64}",
    "description": "MinimalToken v1.0.0"
  }],
  "vet_all_packages": true,
  "synchronize_vetting": true
}
EOF

# 3. Upload to app-provider
grpcurl -plaintext -d @upload_request.json \
  localhost:3902 \
  com.digitalasset.canton.admin.participant.v30.PackageService/UploadDar

# 4. Upload to app-user
grpcurl -plaintext -d @upload_request.json \
  localhost:2902 \
  com.digitalasset.canton.admin.participant.v30.PackageService/UploadDar
```

Then manually update `src/config/packageConfig.js` with the returned package ID.

## Verifying Upload

Check that the package was uploaded successfully:

```bash
# Check config
node -e "import('./src/config/packageConfig.js').then(m => console.log(m.default))"

# Check Canton participants
grpcurl -plaintext localhost:3902 com.digitalasset.canton.admin.participant.v30.PackageService/ListPackages
grpcurl -plaintext localhost:2902 com.digitalasset.canton.admin.participant.v30.PackageService/ListPackages
```

## Important: Party IDs Change on Canton Restart

**Canton LocalNet generates NEW party IDs every time it restarts.** The backend now fetches the party ID **dynamically** on initialization.

If you need the current party ID for debugging:

```bash
./get_party_id.sh
```

## What is DAR Vetting?

**Vetting** is Canton's security mechanism that requires explicit approval before a package can be used in transactions. When you upload a DAR:

1. The DAR is **uploaded** to the participant (stored but not usable yet)
2. The DAR must be **vetted** by the participant to authorize its use
3. Only vetted packages can be used in `CreateCommand` and `ExerciseCommand` operations

The `upload_dar.py` script automatically vets the DAR after uploading. If you need to vet an existing package:

```bash
# Vet a specific package
python3 ./scripts/vet_dar.py <package-id>

# Example
python3 ./scripts/vet_dar.py 1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e
```

### Common Vetting Issues

**Error: "security-sensitive error" (403)**

- **Cause**: DAR was uploaded but not vetted
- **Solution**: Run `python3 ./scripts/vet_dar.py <package-id>`

**Error: Package not found**

- **Cause**: DAR not uploaded to participant
- **Solution**: Re-run `./scripts/upload_dar.sh` or `python3 ./scripts/upload_dar.py <version>`

## Troubleshooting

### "DAR file not found"

- Make sure you ran `daml build` first
- Check that the version matches the one in `daml/minimal-token/daml.yaml`

### "grpcurl not found" or "jq not found"

```bash
brew install grpcurl jq  # macOS
# or
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest  # Go
# jq: https://stedolan.github.io/jq/download/
```

### "Connection refused"

- Make sure Canton LocalNet is running
- Check that ports 3902 and 2902 are accessible

### Package ID not updating in services

- The config file should be automatically imported
- Check that imports use the correct relative path
- Restart the backend server after updating the config

## Version Management

When upgrading DAML contracts:

1. **Update version** in `daml/minimal-token/daml.yaml`
2. **Run `daml build`**
3. **Run `./scripts/upload_dar.sh`** (auto-detects) or `python3 ./scripts/upload_dar.py <new-version>`
4. **Verify config** with `cat src/config/packageConfig.js`
5. **Restart server** with `npm run server:stop && npm run server:start`
6. **Test the application** with the new version

The script preserves all previous versions in the config, so old contracts remain queryable.

## Configuration Used By

- `src/services/cnQuickstartLedgerService.js` - Commands use currentPackageId
- `server/services/jsonApiV1Service.js` - Queries use all versions

## Current Deployment

- **Version:** 1.0.0
- **Package ID:** `1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e`
- **Uploaded:** 2025-10-12
- **Status:** ✅ Active
- **Party Discovery:** ✅ Automatic

## Package ID Reference

For reference, here are the package IDs used in this project:

- **v1.0.0** (current): `1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e`
- **v2.4.0**: `bc5800fb102ebab939780f60725fc87c5c0f93c947969c8b2fc2bb4f87d471de`
- **v2.2.0**: `c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae`
- **v2.1.0**: `c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d`
- **v2.0.1**: `2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118`
- **v2.0.0**: `eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de`

## Related Files

- `scripts/upload_dar.sh` - Shell upload script (recommended, auto-detects version)
- `scripts/upload_dar.py` - Python upload script alternative
- `scripts/vet_dar.py` - Standalone vetting tool
- `src/config/packageConfig.js` - Centralized package configuration
- `daml/minimal-token/daml.yaml` - DAML project version
- `CONTEXT.md` - Full project context and architecture
