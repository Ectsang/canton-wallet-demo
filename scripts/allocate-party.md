# Manual Party Allocation for CN Quickstart

## Quick Start - One-Line Commands

### Allocate a new party on app-user participant:

**Option A: Interactive console (party ID may be truncated in output)**
```bash
docker exec -it canton-console /app/bin/canton -c /app/app.conf
```

Then in the Canton console that opens:
```scala
val party = participants.app_user.parties.enable("demo-wallet-1")
println(party.party.toLf)
```

This will print the FULL party ID (format: `demo-wallet-1::1220...`)

Exit the console:
```scala
exit
```

**Option B: One-liner to get full party ID (recommended)**
```bash
# Replace "demo-wallet-1" with your desired party hint
PARTY_HINT="demo-wallet-1"

docker exec canton-console bash -c "echo 'val party = participants.app_user.parties.enable(\"$PARTY_HINT\"); println(party.party.toLf)' | /app/bin/canton daemon -c /app/app.conf --auto-connect-local --bootstrap /dev/stdin 2>&1 | grep -A 1 '$PARTY_HINT::'"
```

**Option C: Save to file and use**
```bash
PARTY_HINT="demo-wallet-1"

# Allocate and save party ID
PARTY_ID=$(docker exec canton-console bash -c "echo 'val party = participants.app_user.parties.enable(\"$PARTY_HINT\"); println(party.party.toLf); sys.exit(0)' | /app/bin/canton daemon -c /app/app.conf --auto-connect-local --bootstrap /dev/stdin 2>&1 | grep '^$PARTY_HINT::' | head -1")

echo "Party ID: $PARTY_ID"

# Save to file for later use
echo "$PARTY_ID" > /tmp/party-$PARTY_HINT.txt
```

## Alternative: Use app_provider party for quick testing

For immediate testing without creating a new party, you can use the app_provider party:

```
app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad
```

Just paste this into the "External Party ID" field in the UI.

## Testing the full flow

Once you have a party ID:

1. Create a token via the UI or API
2. Use the mint endpoint with your party ID
3. Query the balance with your party ID

Example curl commands:
```bash
# Set your party ID
export PARTY_ID="demo-wallet-1::1220..."
export CONTRACT_ID="00..." # From token creation

# Mint tokens
curl -X POST http://localhost:8899/api/cn/tokens/mint \
  -H "Content-Type: application/json" \
  -d "{\"contractId\": \"$CONTRACT_ID\", \"owner\": \"$PARTY_ID\", \"amount\": \"1000\"}"

# Check balance
curl http://localhost:8899/api/cn/balance/$PARTY_ID
```

## Managing Parties

**IMPORTANT**: Canton parties are permanent identities - they CANNOT be deleted or "un-allocated". Once a party hint is used, it's permanently associated with that party ID on the participant.

### List all parties on app-user participant

```bash
docker exec -it canton-console bash -c "echo 'participants.app_user.parties.list()' | /app/bin/canton daemon -c /app/app.conf --auto-connect-local --bootstrap /dev/stdin 2>&1"
```

### Find a specific party by hint

If you created a party but lost the ID, you can retrieve it:

```bash
PARTY_HINT="demo-wallet-1"

# List parties and filter by hint
docker exec canton-console bash -c "echo 'participants.app_user.parties.list().filter(_.party.toLf.startsWith(\"$PARTY_HINT::\")).foreach(p => println(p.party.toLf))' | /app/bin/canton daemon -c /app/app.conf --auto-connect-local --bootstrap /dev/stdin 2>&1 | grep '^$PARTY_HINT::'"
```

### Reusing party IDs for testing

Since parties cannot be deleted, for repeated testing use incrementing hints:
- `demo-wallet-1`
- `demo-wallet-2`
- `demo-wallet-3`

Each will create a new, independent party ID.

Alternatively, if you already created `demo-wallet-1` and just need the ID again, use the "Find a specific party" command above.

## Why manual allocation?

Canton party allocation requires topology transactions that need:
- Admin-level access to Canton's topology manager
- Signing with participant keys
- Complex multi-step gRPC workflows

For development/demo purposes, manual allocation via Canton console is simpler and more reliable.
