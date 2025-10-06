# Canton Network JSON API Issue - Reproduction Steps

## Issue Summary - RESOLVED ✅

**SOLUTION FOUND**: The v1 `/query` endpoint works correctly when JWT includes `scope` field and templateIds use full package format.

**Root Causes**:
1. **v1 API requires `scope` field in JWT** - Without it, returns 500 error: `Access token with unknown scope ""`
2. **v1 API requires full templateId format** - Must be `packageId:module:entity`, not just `module:entity`
3. **v2 API issue remains** - `/v2/state/active-contracts` still returns empty `[]` (separate issue)

## Environment

- **Canton Network**: LocalNet from `digital-asset/cn-quickstart`
- **Version**: Based on latest cn-quickstart (as of Oct 2025)
- **Participants**:
  - app-provider (ports 3901-3902 Ledger/Admin, 3975 JSON API)
  - app-user (ports 2901-2902 Ledger/Admin, 2975 JSON API)
- **Node.js**: v24.0.2
- **JWT Secret**: `unsafe` (LocalNet default)

## Setup Steps

### 1. Start Canton Network LocalNet

```bash
cd /path/to/cn-quickstart/quickstart
# Start LocalNet (exact command depends on your setup)
```

### 2. Verify Party Hosting

In Canton console:

```scala
// Connect to Canton console
val demoWallet = PartyId.tryFromProtoPrimitive("demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21")

// Verify party is hosted on app-user
participants.app_user.parties.hosted().exists(_.party == demoWallet)
// Result: true ✅

// Grant JWT user rights
participants.app_user.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  actAs = Set(demoWallet)
)
```

### 3. Upload MinimalToken DAR

Upload package to both participants:
- **Package ID**: `eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de`
- **Template**: `MinimalToken:Holding`

### 4. Create Holdings (via Canton Console or API)

Create some Holding contracts so we have data to query:

```scala
// In Canton console, verify Holdings exist
val demoWallet = PartyId.tryFromProtoPrimitive("demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21")

usr.ledger_api.state.acs.of_party(demoWallet)
  .filter(_.templateId.entityName == "Holding")
  .foreach(h => println(s"${h.contractId} - ${h.templateId}"))

// Example output:
// 006205d79049236bdc74... - TemplateId(eccbf7c5...,MinimalToken,Holding)
// 000ae863d4e76da95671... - TemplateId(eccbf7c5...,MinimalToken,Holding)
// 0022f80a1b2cd799cebc... - TemplateId(eccbf7c5...,MinimalToken,Holding)
// 004b06bceb4f40256ac6... - TemplateId(c5988237...,MinimalToken,Holding)
// Total: 4 Holdings ✅
```

## Reproduction

### Test 1: Query via Canton Console (gRPC) ✅ WORKS

```scala
val demoWallet = PartyId.tryFromProtoPrimitive("demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21")

usr.ledger_api.state.acs.of_party(demoWallet).size
// Result: 10 contracts

usr.ledger_api.state.acs.of_party(demoWallet)
  .filter(_.templateId.entityName == "Holding").size
// Result: 4 Holdings ✅
```

**Result:** ✅ **SUCCESS** - Returns 4 Holding contracts

---

### Test 2: Query via HTTP JSON API ❌ FAILS

#### Generate JWT Token

```bash
python3 << 'EOF'
import jwt
import datetime

payload = {
    'sub': 'ledger-api-user',
    'aud': 'https://canton.network.global',
    'actAs': ['demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21'],
    'exp': datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1),
    'iat': datetime.datetime.now(datetime.UTC)
}

token = jwt.encode(payload, 'unsafe', algorithm='HS256')
print(token)
EOF
```

#### Query Active Contracts

```bash
TOKEN="<jwt-from-above>"

curl -X POST http://localhost:2975/v2/state/active-contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "filtersByParty": {
        "demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21": {
          "inclusive": [{
            "templateId": "eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de:MinimalToken:Holding"
          }]
        }
      }
    },
    "verbose": true,
    "activeAtOffset": "1"
  }'
```

**Result:** ❌ **FAILURE**
```json
[]
```

Empty array despite 4 Holdings existing!

---

### Test 3: Query Without Template Filter ❌ FAILS

Try querying ALL contracts (no template filter):

```bash
curl -X POST http://localhost:2975/v2/state/active-contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "filtersByParty": {
        "demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21": {}
      }
    },
    "verbose": true,
    "activeAtOffset": "1"
  }'
```

**Result:** ❌ **FAILURE**
```json
[]
```

Still empty!

---

### Test 4: Query with Different Package IDs ❌ FAILS

Try all package versions:

```bash
curl -X POST http://localhost:2975/v2/state/active-contracts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filter": {
      "filtersByParty": {
        "demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21": {
          "inclusive": [
            {"templateId": "eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de:MinimalToken:Holding"},
            {"templateId": "2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118:MinimalToken:Holding"},
            {"templateId": "c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d:MinimalToken:Holding"}
          ]
        }
      }
    },
    "verbose": true,
    "activeAtOffset": "1"
  }'
```

**Result:** ❌ **FAILURE**
```json
[]
```

---

### Test 5: Command Submission Works ✅

Verify JSON API works for commands (not just queries):

```bash
curl -X POST http://localhost:3975/v2/commands/submit-and-wait-for-transaction \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": {
      "applicationId": "test-app",
      "commandId": "test-123",
      "actAs": ["app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad"],
      "commands": [{
        "CreateCommand": {
          "templateId": "eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de:MinimalToken:Instrument",
          "createArguments": {
            "admin": "app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad",
            "name": "TestToken",
            "symbol": "TEST",
            "decimals": 2
          }
        }
      }]
    }
  }'
```

**Result:** ✅ **SUCCESS** - Command execution works fine

---

### Test 6: gRPC Query ⚠️ ATTEMPTED

Attempted direct gRPC query via grpcurl:

```bash
grpcurl -plaintext \
  -rpc-header "authorization: Bearer $TOKEN" \
  -d '{
    "filter": {
      "filters_by_party": {
        "demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21": {
          "cumulative": [{
            "template_filter": {
              "template_id": {
                "package_id": "eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de",
                "module_name": "MinimalToken",
                "entity_name": "Holding"
              }
            }
          }]
        }
      }
    }
  }' localhost:2901 com.daml.ledger.api.v2.StateService/GetActiveContracts
```

**Result:** ⚠️ Returns streaming response (difficult to parse without proper proto definitions)

---

### Test 7: v1 JSON API Query ✅ WORKS (with correct JWT format)

Testing v1 endpoints - initially failed, then succeeded after fixing JWT:

#### Generate JWT Token WITH SCOPE (required for v1 API)

```bash
python3 << 'EOF'
import jwt
import datetime

payload = {
    'sub': 'ledger-api-user',
    'aud': 'https://canton.network.global',
    'scope': 'daml_ledger_api',  # ← REQUIRED for v1 API!
    'actAs': ['demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21'],
    'exp': datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1),
    'iat': datetime.datetime.now(datetime.UTC)
}

token = jwt.encode(payload, 'unsafe', algorithm='HS256')
print(token)
EOF
```

#### Test 7a: v1 /query WITHOUT scope ❌ FAILS

```bash
# JWT without scope field
TOKEN="<jwt-without-scope>"

curl -X POST http://localhost:2975/v1/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateIds": ["eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de:MinimalToken:Holding"]
  }'
```

**Result:** ❌ **FAILURE**
```
Status: 500 Internal Server Error
Error: Access token with unknown scope "". Issue tokens with adjusted or no scope to get rid of this warning.
```

---

#### Test 7b: v1 /query WITH scope and full templateId ✅ SUCCESS

```bash
# JWT with scope='daml_ledger_api'
TOKEN="<jwt-with-scope>"

curl -X POST http://localhost:2975/v1/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateIds": [
      "eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de:MinimalToken:Holding",
      "2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118:MinimalToken:Holding",
      "c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d:MinimalToken:Holding"
    ]
  }'
```

**Result:** ✅ **SUCCESS**
```json
{
  "result": [
    {
      "contractId": "006205d79049236bdc74...",
      "payload": {
        "owner": "demo-wallet-1::12203bef03ef28...",
        "amount": "100.0",
        "instrument": "006a015cd7d9b6bbe36f..."
      }
    },
    {
      "contractId": "000ae863d4e76da95671...",
      "payload": {
        "owner": "demo-wallet-1::12203bef03ef28...",
        "amount": "1000.0",
        "instrument": "0025dd4408b8166f4f19..."
      }
    }
    // ... 2 more contracts
  ],
  "status": 200
}
```

**Found 4 Holding contracts successfully!**

## Summary

### What Works ✅
1. Canton console gRPC queries via `usr.ledger_api.state.acs.of_party()`
2. JSON API v2 command submission (`/v2/commands/submit-and-wait-for-transaction`)
3. **JSON API v1 queries (`/v1/query`)** - WITH proper JWT scope and templateId format ✅
4. Party hosting and JWT authentication
5. Contract creation and DAML operations

### What Doesn't Work ❌
1. **HTTP JSON API v2 queries**: `/v2/state/active-contracts` returns `[]`
   - Works with NO filters - still returns `[]`
   - Works with ANY package ID - still returns `[]`
   - Works for ANY party with known contracts - still returns `[]`
   - Issue is specific to v2 query endpoints
2. **HTTP JSON API v1 WITHOUT proper JWT**:
   - Missing `scope: 'daml_ledger_api'` → 500 Internal Server Error
   - Incomplete templateId format → 400 Bad Request

### Key Learnings ✅
1. **v1 `/query` is the working solution** for querying active contracts
2. **JWT must include `scope: 'daml_ledger_api'`** for v1 API
3. **templateIds must be full format**: `packageId:module:entity`
4. v2 query endpoints have a separate issue and should not be used

### Evidence
- **Canton console shows**: 10 contracts total, 4 Holdings for demo-wallet-1 ✅
- **JSON API v1 with proper JWT**: Returns all 4 Holdings correctly ✅
- **JSON API v2 queries**: Return empty `[]` ❌
- **JSON API v2 commands**: Work correctly ✅
- **Same participant**: app-user (localhost:2975)

## Solution - Use v1 `/query` Endpoint

### Working Request Format

```python
import jwt
import datetime
import requests

# 1. Generate JWT with scope
payload = {
    'sub': 'ledger-api-user',
    'aud': 'https://canton.network.global',
    'scope': 'daml_ledger_api',  # REQUIRED!
    'actAs': ['<your-party-id>'],
    'exp': datetime.datetime.now(datetime.UTC) + datetime.timedelta(hours=1),
    'iat': datetime.datetime.now(datetime.UTC)
}
token = jwt.encode(payload, 'unsafe', algorithm='HS256')

# 2. Query with full templateId format
response = requests.post(
    'http://localhost:2975/v1/query',
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    json={
        "templateIds": [
            "<packageId>:<module>:<entity>"  # Full format required!
        ]
    }
)

# 3. Parse results
data = response.json()
contracts = data['result']  # List of contracts
```

### Common Mistakes to Avoid

1. ❌ **Missing scope in JWT** → 500 error: `Access token with unknown scope ""`
2. ❌ **Incomplete templateId** (`MinimalToken:Holding`) → 400 error: `did not have two ':' chars`
3. ❌ **Using v2 query endpoints** → Returns empty `[]`
4. ✅ **Use v1 `/query` with scope + full templateIds**

## Workarounds Attempted

1. ❌ Different request formats (with/without filters)
2. ❌ Different package IDs (v2.0.0, v2.0.1, v2.1.0)
3. ❌ Different offset values (0, 1, "1")
4. ❌ Querying different participants (app-user, app-provider)
5. ❌ v1 JSON API endpoints (500 errors, 404 not found)
6. ❌ Different v1 templateId formats (object vs string)
7. ⚠️ Direct gRPC (blocked by missing proto file definitions for complex Daml LF types)

## Additional Context

- This is blocking balance display in our web application
- Canton console queries work perfectly via gRPC (using `usr.ledger_api.state.acs.of_party()`)
- **Both v1 and v2 HTTP JSON APIs fail** - issue is not version-specific
- Command submission works via JSON API, proving auth/connectivity is correct
- Issue appears specific to the query/state endpoints of HTTP JSON API layer
- We're willing to migrate to gRPC if that's the recommended approach, but need:
  - Complete proto file definitions (especially for complex Daml LF Value types)
  - Official Node.js gRPC client library or examples
  - Guidance on handling streaming responses

## Files for Reference

- Investigation notes: `CONTEXT.md`
- Technical diagnosis: `FINAL-DIAGNOSIS.md`
- Party hosting verification: `party-hosting-diagnosis.md`

## Contact

Please advise on the correct approach to query ACS from HTTP/Node.js applications in Canton Network.
