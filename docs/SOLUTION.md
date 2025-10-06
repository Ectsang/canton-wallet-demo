# Canton Network JSON API - SOLVED ✅

## Problem

The webapp couldn't display token balances because:
1. JSON API v2 `/v2/state/active-contracts` returned empty `[]`
2. JWT tokens were missing required `scope` field for v1 API
3. Initial attempts used incomplete templateId format

## Root Cause

The v1 JSON API has specific requirements that were not documented in our initial implementation:
1. **JWT must include `scope: 'daml_ledger_api'`** - Without it, returns 500 error
2. **templateIds must use full format**: `packageId:module:entity`, not `module:entity`

## Solution

Created new `JsonApiV1Service` that properly implements the v1 `/query` endpoint with correct JWT and templateId formatting.

### Working Implementation

**File**: `server/services/jsonApiV1Service.js`

```javascript
// 1. Generate JWT with scope
generateJWT(parties) {
  const payload = {
    sub: 'ledger-api-user',
    aud: 'https://canton.network.global',
    scope: 'daml_ledger_api',  // REQUIRED!
    actAs: partiesArray,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  };
  // ... sign with HMAC-SHA256
}

// 2. Query with full templateId format
async queryHoldings({ owner, instrumentId }) {
  const templateIds = [
    'c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d:MinimalToken:Holding',
    '2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118:MinimalToken:Holding',
    'eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de:MinimalToken:Holding'
  ];

  const response = await fetch(`${this.jsonApiUrl}/v1/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ templateIds })
  });
  // ... parse result
}
```

### Test Results

```bash
curl http://localhost:8899/api/cn/balance/demo-wallet-1::12203bef03ef28...
```

**Response**:
```json
{
  "success": true,
  "holdings": [
    {
      "contractId": "006205d7904923...",
      "owner": "demo-wallet-1::12203bef...",
      "instrument": "006a015cd7d9b6...",
      "amount": 100
    },
    // ... 3 more holdings
  ],
  "totalBalance": 2200.5,
  "holdingCount": 4
}
```

✅ **SUCCESS** - Balance queries now working!

## Key Learnings

### What Works ✅
1. **JSON API v1 `/query`** with proper JWT and templateId format
2. Canton console gRPC queries (always worked)
3. JSON API v2 command submission (for creating contracts)

### What Doesn't Work ❌
1. **JSON API v2 `/v2/state/active-contracts`** - Returns empty `[]` (separate bug)
2. JWT without `scope` field - Returns 500 error
3. Incomplete templateId format - Returns 400 error

### Common Mistakes to Avoid

| Mistake | Result | Fix |
|---------|--------|-----|
| Missing `scope` in JWT | 500: `Access token with unknown scope ""` | Add `scope: 'daml_ledger_api'` |
| Incomplete templateId (`MinimalToken:Holding`) | 400: `did not have two ':' chars` | Use `packageId:module:entity` |
| Using v2 `/v2/state/active-contracts` | Returns empty `[]` | Use v1 `/query` instead |

## Files Changed

1. **Created**: `server/services/jsonApiV1Service.js` - New working service
2. **Updated**: `server/routes/cnQuickstartRoutes.js` - Balance endpoint now uses v1 service
3. **Created**: `REPRO.md` - Complete reproduction steps and solution
4. **Created**: `SOLUTION.md` - This summary

## Impact

✅ **Balance queries now work correctly**
- Webapp can display token balances
- External wallets can query their holdings
- Total balance calculated accurately
- Filters by instrument ID supported

## Next Steps

1. ✅ Balance queries working - **DONE**
2. Consider investigating v2 API issue (separate ticket)
3. Update frontend to use working balance endpoint
4. Add proper error handling for JWT expiration

## References

- Canton JSON API v1 docs: https://docs.daml.com/json-api/index.html
- Investigation: `CONTEXT.md`
- Reproduction: `REPRO.md`
- Party hosting: `party-hosting-diagnosis.md`
