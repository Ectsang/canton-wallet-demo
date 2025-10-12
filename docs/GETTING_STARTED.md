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

# Upload and vet (automatic)
python3 upload_dar.py 1.0.0
```

**What happens:** Script uploads DAR to both participants, vets it, and updates package config automatically.

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

Open http://localhost:5174 in your browser.

---

## Step 5: Use the Demo

Follow the UI instructions:

1. **Connection** - Automatic ✅
2. **Create Wallet** - Click button (backend enables party + generates keys)
3. **Create Token** - Enter name/symbol (creates Instrument contract)
4. **Mint Tokens** - Two-step process:
   - Click "Issue" → Admin creates proposal
   - Click "Accept" → You receive tokens
5. **View Balance** - See your holdings
6. **Burn Tokens** - Two-step process:
   - Click 🔥 Burn → You propose burn
   - Admin approves in "Admin: Burn Proposals" section

---

## What's Happening Behind the Scenes?

### When you create a wallet:
- Backend generates Ed25519 key pair
- Enables party on Canton's app-user participant
- Grants JWT authentication rights
- Returns your unique Party ID

### When you create a token:
- Creates real **Instrument contract** on Canton ledger
- Admin (app_provider) is the owner
- Contract stores name, symbol, decimals

### When you mint tokens:
- **Step 1 (Issue):** Admin creates HoldingProposal contract
- **Step 2 (Accept):** You accept, creates Holding contract with tokens
- Why 2 steps? Admin and your wallet are on **different Canton participants**

### When you burn tokens:
- **Step 1 (ProposeBurn):** You propose to burn a Holding
- **Step 2 (AcceptBurn):** Admin approves, archives both contracts
- Why 2 steps? Holding has dual signatories (admin + you)

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
- Read [CONTEXT.md](./CONTEXT.md) for technical details and architecture
- Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for quick commands

---

## Need Help?

- Check [VETTING_STATUS.md](./VETTING_STATUS.md) for vetting issues
- Check [docs/DAR_UPLOAD_GUIDE.md](./docs/DAR_UPLOAD_GUIDE.md) for upload details
- Review Canton logs: `docker logs canton`

---

**Everything in this demo is real** - no mocks, no simulations. All contracts exist on Canton ledger.
