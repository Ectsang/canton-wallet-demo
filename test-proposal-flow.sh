#!/bin/bash
# Test the full proposal-accept-query flow

set -e  # Exit on error

API_URL="http://localhost:8899"
OWNER_PARTY="12208::12208346157d7f46e2671613f289e6a92ef5f8d5c29914cddfd8b611a18f7b668984"

echo "========================================="
echo "🧪 Testing Full Proposal-Accept Flow"
echo "========================================="
echo ""

# Step 1: Initialize connection
echo "Step 1: Initialize CN Quickstart connection"
echo "-------------------------------------------"
INIT_RESPONSE=$(curl -s -X POST "${API_URL}/api/cn/init")
echo "$INIT_RESPONSE" | python3 -m json.tool
echo ""

# Step 2: Create instrument (token)
echo "Step 2: Create Instrument (token contract)"
echo "-------------------------------------------"
TOKEN_RESPONSE=$(curl -s -X POST "${API_URL}/api/cn/tokens/create" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token",
    "symbol": "TEST",
    "decimals": 2
  }')
echo "$TOKEN_RESPONSE" | python3 -m json.tool

INSTRUMENT_ID=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['contractId'])")
echo ""
echo "✅ Instrument created: $INSTRUMENT_ID"
echo ""

# Step 3: Mint tokens (create HoldingProposal)
echo "Step 3: Mint tokens (create HoldingProposal)"
echo "--------------------------------------------"
MINT_RESPONSE=$(curl -s -X POST "${API_URL}/api/cn/tokens/mint" \
  -H "Content-Type: application/json" \
  -d "{
    \"contractId\": \"$INSTRUMENT_ID\",
    \"owner\": \"$OWNER_PARTY\",
    \"amount\": \"100.50\"
  }")
echo "$MINT_RESPONSE" | python3 -m json.tool

PROPOSAL_ID=$(echo "$MINT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['proposalId'])")
echo ""
echo "✅ HoldingProposal created: $PROPOSAL_ID"
echo ""

# Step 4: Accept proposal (create Holding)
echo "Step 4: Accept HoldingProposal (create Holding)"
echo "-----------------------------------------------"
ACCEPT_RESPONSE=$(curl -s -X POST "${API_URL}/api/cn/proposals/accept" \
  -H "Content-Type: application/json" \
  -d "{
    \"proposalId\": \"$PROPOSAL_ID\",
    \"owner\": \"$OWNER_PARTY\"
  }")
echo "$ACCEPT_RESPONSE" | python3 -m json.tool

HOLDING_ID=$(echo "$ACCEPT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['holdingId'])")
echo ""
echo "✅ Holding created: $HOLDING_ID"
echo ""

# Step 5: Query balance (should show holdings)
echo "Step 5: Query balance (should show holdings)"
echo "---------------------------------------------"
BALANCE_RESPONSE=$(curl -s -G "${API_URL}/api/cn/balance/${OWNER_PARTY}" \
  --data-urlencode "instrumentId=$INSTRUMENT_ID")
echo "$BALANCE_RESPONSE" | python3 -m json.tool

TOTAL_BALANCE=$(echo "$BALANCE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['totalBalance'])")
echo ""
echo "✅ Total balance: $TOTAL_BALANCE TEST tokens"
echo ""

echo "========================================="
echo "✅ All tests passed!"
echo "========================================="
