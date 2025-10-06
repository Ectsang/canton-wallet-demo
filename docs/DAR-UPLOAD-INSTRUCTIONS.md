# DAR Upload Instructions for Canton CN Quickstart

## Current Status

✅ **Package ID**: `9d2d9824087d262af3f7726bf16038a7b46d4e735051cfe532f204c452512e61`
✅ **DAR File**: Already copied to `/app/minimal-token.dar` in Canton container
✅ **Configuration**: Updated in `src/services/cnQuickstartLedgerService.js`

## To Upload DAR (if needed after Docker restart)

### Method 1: Via Canton Console (Recommended)

```bash
# Enter Canton container
docker exec -it canton bash

# Start Canton console
cd /app && /app/bin/canton \
  --config /app/app-provider/on/canton.conf \
  --bootstrap <(cat <<'UPLOAD'
    participants.app_provider.dars.upload("/app/minimal-token.dar")
    participants.app_user.dars.upload("/app/minimal-token.dar")
    println("✅ DARs uploaded!")
UPLOAD
)
```

### Method 2: Via Curl Upload (Alternative)

```bash
# Re-copy DAR if needed
docker cp daml/minimal-token/minimal-token.dar canton:/app/minimal-token.dar

# Note: Upload via Admin API requires proper authentication
```

## Verify DAR is Uploaded

Try creating a token in the UI - the enhanced logging will show if the DAR is missing.

## If You Rebuild the DAR

1. Recompile DAML: `daml build` in `daml/minimal-token/`
2. Get new package ID:
   ```bash
   unzip -p daml/minimal-token/minimal-token.dar META-INF/MANIFEST.MF | grep "Main-Dalf:" | awk '{print $2}' | cut -d'-' -f5
   ```
3. Update package ID in `src/services/cnQuickstartLedgerService.js` line 25
4. Upload new DAR using Method 1 above
5. Restart backend server: `npm run server:start`

## Configuration Summary

- **JSON API URL**: http://localhost:3975 (app-provider)
- **App Provider Party**: `app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad`
- **Participant ID**: `PAR::participant::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad`
- **Timeout**: 30 seconds for all JSON API calls

## Test the Setup

1. Restart your backend: `npm run server:start`
2. Open http://localhost:5173
3. Click "Create Token"
4. Check browser console for detailed logs
5. If DAR is missing, you'll see a clear error message with the template ID

All configuration has been fixed. Try creating a token now!
