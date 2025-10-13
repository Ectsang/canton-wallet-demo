# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Canton Wallet Demo is a web application demonstrating **real DAML contract operations** on Canton Network LocalNet. This is not a mock or simulation - it creates actual Instrument and Holding contracts on the Canton ledger using the Canton Wallet SDK and direct console API calls.

## Key Architecture Decisions

### Integration Approach

This project has evolved through multiple integration attempts with Canton Network. The current implementation uses **Canton Wallet SDK 0.7.0** with direct JSON Ledger API calls. Key architectural points:

- **Backend-for-Frontend Pattern**: Fastify server (port 8899) acts as BFF, handling Canton SDK operations
- **Direct Ledger API**: Some operations bypass SDK restrictions by calling JSON Ledger API directly
- **Real DAML Contracts**: Uses MinimalToken package deployed to Canton ledger (package ID: `d8325445c38031336b59afafaf5f01c83494e77884eab47baf3a6436e4be15f6`)
- **Key Management**: Wallet keys stored in memory (Map) on backend service for transaction signing

### DAML Contract Architecture

The MinimalToken DAML contract has two templates:

- **Instrument**: Represents token metadata (name, symbol, decimals), created by admin
- **Holding**: Represents token ownership (owner, instrument reference, amount)

The Issue choice on Instrument creates Holding contracts. The Transfer choice on Holding enables token transfers between parties.

## Common Development Commands

### Start Development Environment

```bash
# Install dependencies
npm install # or pnpm install

# Start backend server (required for Canton SDK integration)
npm run server:start # or pnpm server:start

# Start frontend dev server
npm run dev # or pnpm dev

# Access app at http://localhost:5173
# API docs at http://localhost:8899/docs
```

### Build Commands

```bash
# Build frontend for production
npm run build

# Preview production build
npm run preview
```

### Server Management

```bash
# Start server with auto-restart
npm run server:dev

# Stop server and clean port 8899
npm run server:stop

# Restart server 
npm run server:restart
```

## Canton CN Quickstart Configuration

This demo uses cn-quickstart from `/Users/e/code/sbc/canton/cn-quickstart/quickstart/docker/modules/localnet`.

CN Quickstart exposes multiple participants with port pattern: `[prefix][suffix]`

- Prefix: 2 = app-user, 3 = app-provider, 4 = sv
- Suffixes: 901 = Ledger API, 902 = Admin API, 975 = JSON API, 903 = Validator Admin

**App Provider Services** (used by this demo):

- **Ledger API**: localhost:3901 (gRPC)
- **Admin API**: localhost:3902 (gRPC)
- **JSON API**: localhost:3975 (HTTP) ← Main integration point
- **Validator Admin**: localhost:2903 (REST)
- **UI**: localhost:3000 (HTTP)

**App User Services** (for external wallets):

- **Ledger API**: localhost:2901 (gRPC)
- **Admin API**: localhost:2902 (gRPC)
- **JSON API**: localhost:2975 (HTTP)
- **UI**: localhost:2000 (HTTP)

## Critical Implementation Details

### Wallet Creation Flow (src/services/cantonConsoleService.js:82-140)

1. Generate Ed25519 key pair using SDK's `createKeyPair()`
2. Call `sdk.topology.prepareSignAndSubmitExternalParty(privateKey, partyHint)`
3. Store keys in `walletKeys` Map with partyId as key
4. Set partyId on both userLedger and adminLedger

**IMPORTANT**: Keys MUST be stored when wallet is created. All subsequent operations require these keys for signing.

### Contract Creation Flow (src/services/cantonConsoleService.js:473-1202)

1. Set party ID on SDK using `sdk.setPartyId(admin)`
2. Retrieve wallet keys from `walletKeys` Map
3. Prepare DAML CreateCommand with templateId and createArguments
4. Execute using `sdk.userLedger.prepareSignAndExecuteTransaction(commands, privateKey, commandId)`
5. Wait for completion using `sdk.userLedger.waitForCompletion(offset, timeout, commandId)`
6. Extract contract ID from completion result or query active contracts as fallback

**CRITICAL**: The SDK's `waitForCompletion` may not return contract IDs directly. Multiple fallback strategies are implemented (direct JSON API, activeContracts query, transaction polling).

### Token Minting Flow (src/services/cantonConsoleService.js:1207-1464)

1. Create ExerciseCommand for Issue choice on Instrument contract
2. **Use admin keys, not owner keys** - admin exercises Issue choice
3. Execute and wait for completion (same pattern as contract creation)
4. Extract Holding contract ID from created events

**IMPORTANT**: The Issue choice is controlled by admin party, not owner party. Use admin's keys for signing.

## Service Layer Architecture

### Backend Services (server/)

- **index.js**: Fastify server setup with CORS, Swagger, logging
- **sdkManager.js**: Singleton manager for Canton SDK instance
- **routes/init.js**: Initialization endpoint
- **routes/daml.js**: DAML operations (create wallet, token, mint)
- **routes/cnQuickstartRoutes.js**: Canton Quickstart integration routes

### Frontend Services (src/services/)

- **cantonConsoleService.js**: Main Canton SDK integration (backend-only, not used in browser)
- **cnQuickstartFrontendService.js**: Frontend service calling backend API
- **frontendCantonService.js**: Alternative frontend service
- **storageService.js**: LocalStorage persistence for wallet/token data
- **mockCantonService.js**: Mock implementation for testing

## State Management

The app uses localStorage to persist:

- **Wallet data**: partyId, keys, partyHint, creation timestamp
- **Token data**: contractId, name, symbol, decimals, admin party

This allows recovery after page refresh. See src/services/storageService.js for details.

## Error Handling Patterns

Canton SDK operations can fail in multiple ways:

1. **Network errors**: LocalNet not running or wrong ports
2. **SDK errors**: Missing party ID, invalid keys, timeout
3. **DAML errors**: Invalid contract arguments, insufficient permissions
4. **Contract ID extraction failures**: Result parsing issues

Always implement fallback strategies when extracting contract IDs from completion results. See createInstrument() for examples of 5+ fallback methods.

## Code Style Conventions

From .cursorrules:

- Use ES6+ features and modern React patterns (hooks, functional components)
- Prefer const over let, avoid var
- Use async/await over promises
- Handle errors explicitly with try/catch blocks
- Use descriptive variable names
- Check for wallet existence before token operations
- Log extensively with emoji prefixes (🔄 for in-progress, ✅ for success, ❌ for errors)

## Known Limitations and Workarounds

### SDK Limitations

- SDK's `waitForCompletion` doesn't always return contract IDs in createdEvents
- Some SDK methods have security restrictions requiring direct API calls
- Token Standard API (`sdk.tokenStandard`) doesn't support custom DAML contracts

### Workarounds Implemented

1. **Direct JSON Ledger API calls**: Bypass SDK restrictions for contract queries
2. **Multiple fallback strategies**: Try 5+ methods to extract contract IDs
3. **Active contracts polling**: Query ledger to find recently created contracts
4. **Key storage in memory**: Store wallet keys in Map for signing operations

## Testing Strategy

**Note**: No test files currently exist in the repository, but the PRD (docs/PRD.md) describes intended test coverage:

- Unit tests for service layer and utilities
- Integration tests for end-to-end workflows
- Mock mode for browser-safe testing without LocalNet
- LocalNet mode for full integration testing

## Important Files to Understand

- **src/services/cantonConsoleService.js**: Core Canton integration logic (1663 lines, heavily documented)
- **server/index.js**: Backend server setup
- **src/App.jsx**: React app with wallet/token UI
- **daml/minimal-token/daml/MinimalToken.daml**: DAML contract templates
- **.cursorrules**: Project conventions and patterns

## Package Manager

This project uses **pnpm** (version 10.12.1). If using npm install, pnpm will be used automatically due to packageManager field in package.json.
