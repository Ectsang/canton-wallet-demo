#!/bin/bash
# Complete flow test for Canton Wallet Demo + CN Quickstart integration

set -e

API="http://localhost:8899"
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}Canton Wallet Demo - Complete Flow Test${NC}\n"

# Check if backend is running
echo -e "${BLUE}→ Checking backend health...${NC}"
if ! curl -sf "$API/api/health" > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Backend not running. Start it with: npm run server:start${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Backend is running${NC}\n"

# 1. Initialize CN Quickstart connection
echo -e "${BOLD}1. Initialize CN Quickstart connection...${NC}"
INIT=$(curl -sf -X POST "$API/api/cn/init" -H "Content-Type: application/json" -d '{}')
if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Failed to initialize. Is CN Quickstart LocalNet running?${NC}"
  echo -e "Start it with: cd /Users/e/code/sbc/canton/cn-quickstart/quickstart && make start"
  exit 1
fi
echo "$INIT" | jq .

APP_PROVIDER=$(echo "$INIT" | jq -r .appProviderParty)
if [ "$APP_PROVIDER" == "null" ]; then
  echo -e "${YELLOW}⚠️  Could not get App Provider party${NC}"
  exit 1
fi
echo -e "${GREEN}✓ App Provider Party: $APP_PROVIDER${NC}\n"

# 2. Create token
echo -e "${BOLD}2. Create custom token...${NC}"
TOKEN=$(curl -sf -X POST "$API/api/cn/tokens/create" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Token",
    "symbol": "TEST",
    "decimals": 18
  }')

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Token creation failed${NC}"
  exit 1
fi
echo "$TOKEN" | jq .

CONTRACT_ID=$(echo "$TOKEN" | jq -r .contractId)
if [ "$CONTRACT_ID" == "null" ]; then
  echo -e "${YELLOW}⚠️  Could not get contract ID${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Token Contract ID: $CONTRACT_ID${NC}\n"

# 3. Create external wallet
echo -e "${BOLD}3. Create external wallet...${NC}"
WALLET=$(curl -sf -X POST "$API/api/daml/wallets" \
  -H "Content-Type: application/json" \
  -d '{
    "partyHint": "testuser"
  }')

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Wallet creation failed${NC}"
  exit 1
fi
echo "$WALLET" | jq .

PARTY_ID=$(echo "$WALLET" | jq -r .partyId)
if [ "$PARTY_ID" == "null" ]; then
  echo -e "${YELLOW}⚠️  Could not get party ID${NC}"
  exit 1
fi
echo -e "${GREEN}✓ External Wallet Party: $PARTY_ID${NC}\n"

# 4. Mint tokens to wallet
echo -e "${BOLD}4. Mint tokens to wallet...${NC}"
MINT=$(curl -sf -X POST "$API/api/cn/tokens/mint" \
  -H "Content-Type: application/json" \
  -d "{
    \"contractId\": \"$CONTRACT_ID\",
    \"owner\": \"$PARTY_ID\",
    \"amount\": \"1000.0\"
  }")

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Minting failed${NC}"
  exit 1
fi
echo "$MINT" | jq .

HOLDING_ID=$(echo "$MINT" | jq -r .holdingId)
if [ "$HOLDING_ID" == "null" ]; then
  echo -e "${YELLOW}⚠️  Could not get holding ID${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Holding Contract ID: $HOLDING_ID${NC}\n"

# 5. Query balance
echo -e "${BOLD}5. Query wallet balance...${NC}"
BALANCE=$(curl -sf "$API/api/cn/balance/$PARTY_ID")

if [ $? -ne 0 ]; then
  echo -e "${YELLOW}⚠️  Balance query failed${NC}"
  exit 1
fi
echo "$BALANCE" | jq .

TOTAL_BALANCE=$(echo "$BALANCE" | jq -r .totalBalance)
echo -e "${GREEN}✓ Total Balance: $TOTAL_BALANCE TEST${NC}\n"

# Summary
echo -e "${BOLD}${GREEN}═══════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}✅ Complete flow successful!${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════${NC}\n"

echo -e "${BOLD}Summary:${NC}"
echo -e "  • App Provider: ${BLUE}$APP_PROVIDER${NC}"
echo -e "  • Token Contract: ${BLUE}$CONTRACT_ID${NC}"
echo -e "  • Wallet Party: ${BLUE}$PARTY_ID${NC}"
echo -e "  • Holding Contract: ${BLUE}$HOLDING_ID${NC}"
echo -e "  • Balance: ${BLUE}$TOTAL_BALANCE TEST${NC}"
echo ""