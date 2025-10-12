# DAR Vetting Status & Troubleshooting

## Current Status

**Package ID:** `1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e`
**Version:** 1.0.0
**Upload Status:** ✅ Uploaded to both participants
**Vetting Status:** ✅ Vetted on both participants
**Transaction Status:** ❌ Still getting 403 "security-sensitive error"

## What We've Done

1. ✅ Built DAML contract (minimal-token v1.0.0)
2. ✅ Uploaded DAR to app-provider (localhost:3902)
3. ✅ Uploaded DAR to app-user (localhost:2902)
4. ✅ Vetted DAR on app-provider
5. ✅ Vetted DAR on app-user
6. ✅ Updated packageConfig.js
7. ✅ Restarted backend server

## The Problem

Despite successful vetting, transactions are still failing with:
```
403 - {"code":"NA","cause":"A security-sensitive error has been received"}
```

## Possible Causes

### 1. Domain Synchronization Delay
Canton uses a domain synchronizer, and vetting changes need to propagate across the domain. This can take time.

**Solution:** Wait 30-60 seconds and try again

### 2. Party Not Connected to Domain
The app_provider party might not be properly connected to the domain synchronizer.

**Check:**
```bash
grpcurl -plaintext localhost:3902 \
  com.digitalasset.canton.admin.participant.v30.SynchronizerConnectivityService/ListConnectedSynchronizers
```

### 3. Topology Authorization Missing
In Splice/CN Quickstart, there might be additional topology authorizations needed beyond just vetting.

### 4. Package Dependencies Not Vetted
The MinimalToken package depends on daml-prim and daml-stdlib. These dependencies might not be vetted.

**Solution:** Vet the dependencies:
```bash
# Check dependencies
grpcurl -plaintext -d '{"main_package_id": "1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e"}' \
  localhost:3902 \
  com.digitalasset.canton.admin.participant.v30.PackageService/GetPackageReferences
```

## Recommended Next Steps

### Step 1: Check Domain Connection
```bash
grpcurl -plaintext localhost:3902 \
  com.digitalasset.canton.admin.participant.v30.SynchronizerConnectivityService/ListConnectedSynchronizers
```

### Step 2: Check Package Vetting Status
```bash
grpcurl -plaintext -d '{"main_package_id": "1bf66b0c9774ca1de9a075c810b443c2fe3638c59c07da7c8034b04650e3352e"}' \
  localhost:3902 \
  com.digitalasset.canton.admin.participant.v30.PackageService/ListDars
```

### Step 3: Wait and Retry
Sometimes vetting needs time to propagate. Wait 60 seconds and try creating a token again.

### Step 4: Check Canton Console Logs
```bash
docker logs canton 2>&1 | tail -100 | grep -i "vet\|topology\|security"
```

### Step 5: Try Using Old Package (Temporary Test)
To verify the issue is vetting-specific, temporarily test with the old package that was working:

```javascript
// In src/config/packageConfig.js, temporarily change:
currentPackageId: '578f328a058216d3697b09c5d1a3fd8e5a02884360363609b849f86b4c0ac478'
```

If this works, it confirms the issue is with the new package vetting/topology.

## Workaround: Use Canton Console

If the JSON API continues to fail, you can try using Canton Console directly:

```scala
// Connect to Canton console
docker exec -it canton-console bash
# Then in console:
participant1.ledger_api.javaapi.commands.submit(...)
```

## Scripts Created

1. **upload_dar.py** - Uploads and vets DARs automatically
2. **vet_dar.py** - Standalone vetting tool for existing packages

Both scripts now include automatic vetting after upload.

## When Vetting is Required

**Always vet after:**
- Uploading a new DAR
- Restarting Canton LocalNet (vetting state may be lost)
- Adding new participants to the network

**Vetting is automatic when using:** `python3 upload_dar.py <version>`

## Canton LocalNet Specifics

CN Quickstart uses Splice, which adds additional topology layers:
- Domain synchronizers
- Party hosting
- Package vetting
- Topology transactions

The 403 error suggests one of these topology layers isn't properly configured for the new package.

## Contact/Support

If the issue persists:
1. Check Canton documentation on topology management
2. Review Splice-specific vetting requirements
3. Check if there are any Splice-specific package authorization steps

---

**Last Updated:** 2025-10-12
**Status:** Investigating 403 security error despite successful vetting
