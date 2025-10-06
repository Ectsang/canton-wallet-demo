# Party Hosting Diagnosis

## What We Know (From Server Logs)

### ✅ Holding Contract Created Successfully
- Contract ID: `004b06bceb4f40256ac6d6a455c91ee4578f13bf836cb5764b615fcc4787fb45c1ca111220ed910b38ace3cf9325017d2c0ecaddec7e11fe762d4e30b57d776270f75803bc`
- Template: `c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d:MinimalToken:Holding`
- Created via Accept choice on app-user participant (port 2975)
- Signatories: `["app_provider_quickstart-e-1::1220a57d...", "demo-wallet-1::12203bef03ef..."]`
- Witness Parties: Both admin and owner
- Transaction successful (HTTP 200)

### ❌ ACS Query Returns Empty
- Query endpoint: `http://localhost:2975/v2/state/active-contracts`
- JWT: actAs demo-wallet-1
- Filter: templateId for Holding
- Result: `[]` (empty array)

## Root Cause (Per Google Research)

**Most Likely**: `demo-wallet-1` party is **NOT HOSTED** on app-user participant

From Canton documentation:
> "If a party needs to be seen on multiple participants, it must be hosted on each one"

### Key Distinction
- **Party EXISTS**: Party ID is known/allocated in the Canton network
- **Party HOSTED**: Party is actively hosted on a specific participant node

A party can exist globally but only be hosted on certain participants. ACS queries only return contracts for HOSTED parties on that participant.

## What We Need to Verify

### 1. Is demo-wallet-1 hosted on app-user?
```scala
participants.app_user.parties.hosted()
// Should include: demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21
```

### 2. If NOT hosted, enable it:
```scala
participants.app_user.parties.enable("demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21")
```

### 3. Alternative: Check party allocation
```scala
participants.app_user.parties.list()
// Shows all parties (hosted + non-hosted)

// Get specific party details
val demoWallet = PartyId.tryFromProtoPrimitive("demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21")
participants.app_user.parties.list().find(_.party == demoWallet)
```

## Expected Outcome After Fix

Once `demo-wallet-1` is properly hosted on app-user:
1. ACS queries should return the Holding contract
2. Balance queries should show 100.5 tokens
3. Full cross-participant flow will work end-to-end

## Commands to Run in Canton Console

```bash
# Connect to Canton console
docker exec -it canton-console bash
cd /app
bin/canton daemon -c config/canton.conf --auto-connect-local

# Once in console:
val demoWallet = PartyId.tryFromProtoPrimitive("demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21")

// Check if hosted
participants.app_user.parties.hosted().exists(_.party == demoWallet)

// If false, enable hosting
participants.app_user.parties.enable(demoWallet)

// Verify
participants.app_user.parties.hosted().exists(_.party == demoWallet)

// Exit
exit
```
