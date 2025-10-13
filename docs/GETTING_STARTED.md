# Getting Started - Canton Wallet Demo

Quick guide to get up and running in 5 minutes.

---

## Prerequisites

✅ Docker running
✅ Node.js 18+
✅ Canton LocalNet (cn-quickstart)

---

## Step 1: Start Canton LocalNet

```bash
cd /path/to/cn-quickstart/quickstart/docker/modules/localnet
make start
```

Wait for Canton to be ready (~30 seconds).

---

## Step 2: Build and Deploy DAML Contract

```bash
# From this repo's root directory
cd daml/minimal-token
daml build
cd ../..

# Upload and vet (automatic - auto-detects version!)
./scripts/upload_dar.sh
```

**What happens:** Script auto-detects version from daml.yaml, uploads DAR to both participants, vets it, and updates package config automatically.

---

## Step 3: Start Backend

```bash
npm install
npm run server:start
```

**What happens:** Backend connects to Canton, auto-detects admin party ID.

---

## Step 4: Start Frontend

```bash
# In a new terminal
npm run dev
```

Open <http://localhost:5174> in your browser.

---

## Step 5: Create Wallet via Canton Console

```bash
docker exec -it canton-console bash
```

Then run in the Canton console:

```scala
val usr = participants.all.find(_.name == "app-user").get
val appProvider = participants.all.find(_.name == "app-provider").get

// Enable party and get the party ID
val myWallet = usr.parties.enable("demo-wallet-1")
println(myWallet.toLf)

// Grant actAs rights (REQUIRED for transactions!)
usr.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  actAs = Set(myWallet)
)

// Grant readAs for admin party (REQUIRED for cross-participant operations)
val adminPartyId = appProvider.parties.list().head.toLf
usr.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  readAs = Set(PartyId.tryFromProtoPrimitive(adminPartyId))
)
```

Copy the party ID from `println(myWallet.toLf)` output.

---

## Step 6: Use the Demo

Follow the UI instructions:

1. **Connection** - Automatic ✅
2. **Paste Party ID** - From Canton console
3. **Create Token** - Enter name/symbol (creates Instrument contract)
4. **Mint Tokens** - Two-step process:
   - Click "Issue" → Admin creates proposal
   - Click "Accept" → You receive tokens
5. **View Balance** - See your holdings
6. **Burn Tokens** - Click 🔥 Burn → Holding archived immediately

---

## What's Happening Behind the Scenes?

### When you create a wallet

- Canton console enables party on app-user participant
- Grants actAs rights for ledger-api-user (required for transactions)
- Grants readAs rights for admin party (required for cross-participant)
- Returns your unique Party ID (format: `hint::fingerprint`)

### When you create a token

- Creates real **Instrument contract** on Canton ledger
- Admin (app_provider) is the owner
- Contract stores name, symbol, decimals

### When you mint tokens

- **Step 1 (Issue):** Admin creates HoldingProposal contract
- **Step 2 (Accept):** You accept, creates Holding contract with tokens
- Why 2 steps? Admin and your wallet are on **different Canton participants**

### When you burn tokens

- **ProposeBurn (consuming choice):** Archives the Holding immediately
- Creates BurnProposal as audit trail (Holding is already gone)
- One-step process: Owner clicks burn → Holding archived

---

## Troubleshooting

### "403 security-sensitive error"

- **Fix:** Re-run `python3 upload_dar.py 1.0.0` (vets the package)

### "Party not found" / "Connection failed"

- **Fix:** Restart backend (it will auto-detect new party ID)

### Tokens not showing

- **Fix:** Check that Canton LocalNet is running on correct ports (3975, 2975)

---

## Key Concepts

- **Party ID:** Unique identifier (format: `hint::fingerprint`)
- **Participant:** Canton node hosting parties (app-provider, app-user)
- **Instrument:** Token metadata contract (name, symbol, decimals)
- **Holding:** Token ownership contract (owner, amount)
- **Proposal Pattern:** Required for cross-participant operations

---

## Files You Might Edit

- `daml/minimal-token/daml/MinimalToken.daml` - DAML contract
- `src/App.jsx` - Frontend UI
- `src/services/cnQuickstartLedgerService.js` - Backend service

---

## Next Steps

- Read [USER_FLOW.md](./USER_FLOW.md) for detailed step-by-step explanation
- Read [CONTEXT.md](../CONTEXT.md) for technical details and architecture
- Read [DAR_UPLOAD_GUIDE.md](./DAR_UPLOAD_GUIDE.md) for deployment and quick commands

---

## Need Help?

- Check [VETTING_STATUS.md](./VETTING_STATUS.md) for vetting issues
- Check [docs/DAR_UPLOAD_GUIDE.md](./docs/DAR_UPLOAD_GUIDE.md) for upload details
- Review Canton logs: `docker logs canton`

---

**Everything in this demo is real** - no mocks, no simulations. All contracts exist on Canton ledger.
