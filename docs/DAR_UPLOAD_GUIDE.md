# DAR Upload Guide

This guide explains how to build and upload DAML contracts to Canton LocalNet.

## Prerequisites

1. Canton LocalNet running (cn-quickstart)
2. `grpcurl` installed (`brew install grpcurl` on macOS)
3. Python 3 installed

## Building the DAML Contract

Navigate to the DAML project directory and build:

```bash
cd daml/minimal-token
daml clean && daml build
```

This creates a `.dar` file in `.daml/dist/minimal-token-<version>.dar`

## Uploading the DAR

Use the automated upload script from the project root:

```bash
python3 upload_dar.py <version>
```

Example:
```bash
python3 upload_dar.py 1.0.0
```

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
# Query app-provider packages
grpcurl -plaintext localhost:3902 \
  com.digitalasset.canton.admin.participant.v30.PackageService/ListPackages

# Query app-user packages
grpcurl -plaintext localhost:2902 \
  com.digitalasset.canton.admin.participant.v30.PackageService/ListPackages
```

## What is DAR Vetting?

**Vetting** is Canton's security mechanism that requires explicit approval before a package can be used in transactions. When you upload a DAR:

1. The DAR is **uploaded** to the participant (stored but not usable yet)
2. The DAR must be **vetted** by the participant to authorize its use
3. Only vetted packages can be used in `CreateCommand` and `ExerciseCommand` operations

The `upload_dar.py` script automatically vets the DAR after uploading. If you need to vet an existing package:

```bash
python3 vet_dar.py <package-id>
```

### Common Vetting Issues

**Error: "security-sensitive error" (403)**
- **Cause**: DAR was uploaded but not vetted
- **Solution**: Run `python3 vet_dar.py <package-id>`

**Error: Package not found**
- **Cause**: DAR not uploaded to participant
- **Solution**: Re-run `python3 upload_dar.py <version>`

## Troubleshooting

### "DAR file not found"
- Make sure you ran `daml build` first
- Check that the version matches the one in `daml/minimal-token/daml.yaml`

### "grpcurl not found"
```bash
brew install grpcurl  # macOS
# or
go install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest  # Go
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
3. **Run `python3 upload_dar.py <new-version>`**
4. **Test the application** with the new version
5. **Keep old versions** in config if you need backward compatibility

The script preserves all previous versions in the config, so old contracts remain queryable.

## Package ID Reference

For reference, here are the package IDs used in this project:

- **v1.0.0** (current): `1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e`
- **v2.4.0**: `bc5800fb102ebab939780f60725fc87c5c0f93c947969c8b2fc2bb4f87d471de`
- **v2.2.0**: `c90d4ebea4593e9f5bcb46291cd4ad5fef08d94cb407a02085b30d92539383ae`
- **v2.1.0**: `c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d`
- **v2.0.1**: `2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118`
- **v2.0.0**: `eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de`

## Related Files

- `upload_dar.py` - Automated upload script
- `src/config/packageConfig.js` - Centralized package configuration
- `daml/minimal-token/daml.yaml` - DAML project version
- `CONTEXT.md` - Full project context and architecture
