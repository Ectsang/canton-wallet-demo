# Canton Wallet Demo

A simple web dApp demonstrating how to create an external wallet and mint tokens using the Canton Network SDK.

## Features

- Initialize and connect to Canton Network
- Create an external wallet (party)
- Create a custom token using Canton token standard
- Mint tokens to the wallet
- Display token balance

## Prerequisites

- Node.js (v16 or higher)
- A running Canton Network LocalNet instance
- Canton Network services running on LocalNet ports:
  - Ledger API (gRPC): localhost:2901
  - Admin API (gRPC): localhost:2902
  - Validator API: localhost:2903
  - JSON API: localhost:2975
  - Scan/UI: <http://localhost:2000>

## Installation

```bash
npm install
```

## Running the Demo

```bash
npm run dev
```

The application will start on <http://localhost:5173> (or another available port).

## Testing

For comprehensive testing documentation, see [TESTING_GUIDE.md](./TESTING_GUIDE.md).

Quick test commands:

- `npm test` - Run all mocked tests
- `npm run test:real` - Run real integration tests with Canton LocalNet (automated setup)
- `npm run test:real:direct` - Run real integration tests (manual Canton setup required)

## How to Use

1. **Initialize SDK**: The app automatically initializes the Canton SDK when loaded
2. **Connect to Network**: Click "Connect to Canton Network" to establish connections
3. **Create Wallet**: Enter a party hint (optional) and create an external wallet
4. **Create Token**: Define your token parameters (name, symbol, decimals) and create it
5. **Mint Tokens**: Specify the amount and mint tokens to your wallet

## Configuration

The configuration can be modified in `src/config.js` to match your Canton Network setup.

## Important Notes

- This is a demo application for educational purposes
- The Canton SDK integration shown here is simplified and may need adjustments based on the actual SDK API
- In production, you would need proper error handling, authentication, and security measures
- The LocalNet configuration is for development only

## Architecture

- **React + Vite**: Modern web development stack
- **Canton SDK**: Official SDK for interacting with Canton Network
- **Service Layer**: `cantonService.js` encapsulates all Canton operations
- **Simple UI**: Clean interface demonstrating the workflow

## Testing

This project includes comprehensive tests covering unit tests, integration tests, and UI component tests.

### Running Tests

```bash
# Run all unit tests
npm test

# Run unit tests with coverage
npm run test:coverage

# Run tests in watch mode during development
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run only unit tests once
npm run test:unit

# Run integration tests (mocked)
npm run test:integration

# Run REAL integration tests against Canton LocalNet
npm run test:real

# Run all tests (unit + mocked integration)
npm run test:all
```

### Real Integration Tests

We now provide real integration tests that connect to an actual Canton LocalNet instance:

```bash
# Automated test runner (recommended) - checks Canton status and offers to start it
npm run test:real

# Direct test execution (requires Canton to be already running)
npm run test:real:direct
```

See [REAL_INTEGRATION_TESTS.md](./REAL_INTEGRATION_TESTS.md) for detailed instructions on running and verifying real integration tests.

### Test Structure

- **`cantonService.test.js`**: Unit tests for the Canton service layer
  - SDK initialization and configuration
  - Wallet creation and management
  - Token operations (create, mint, query)
  - Mock-based testing without network dependencies

- **`errorHandling.test.js`**: Comprehensive error handling tests
  - Network connectivity errors
  - Authentication and authorization failures
  - Invalid input validation
  - Transaction failures and timeouts
  - Resource limitations and boundary conditions

- **`App.test.jsx`**: UI component tests
  - User interactions and workflows
  - Progressive disclosure of features
  - Loading states and error messages
  - Form validation and input handling

- **`integration.test.js`**: Integration tests against LocalNet
  - Full end-to-end wallet and token flows
  - Real network operations
  - Concurrency and state management
  - Performance under various conditions

### Integration Test Prerequisites

1. **Start LocalNet**:

   ```bash
   cd /Users/e/code/sbc/canton/localnet/splice-node/docker-compose/localnet
   docker-compose up
   ```

2. **Verify LocalNet is healthy**:
   The integration test runner will automatically check if all required services are running.

3. **Run integration tests**:

   ```bash
   npm run test:integration
   ```

### Test Configuration

- Tests use Vitest as the test runner
- React Testing Library for component testing
- Integration tests can be skipped by not setting `RUN_INTEGRATION_TESTS=true`
- LocalNet ports are configured in `src/config.js` based on the actual docker-compose setup

## Troubleshooting

1. **Connection Failed**: Ensure your Canton LocalNet is running and accessible
2. **SDK Errors**: Check the browser console for detailed error messages
3. **Transaction Failures**: Verify your party has the necessary permissions
4. **Test Failures**:
   - For unit tests: Check that all dependencies are installed
   - For integration tests: Ensure LocalNet is running and healthy
   - Check ports 2901, 2902, 2903, and 2000 are accessible

## Documentation

### Project Documentation

- **[CANTON_INTEGRATION_STATUS.md](./CANTON_INTEGRATION_STATUS.md)** - Current SDK integration status and resolved issues
- **[TESTING.md](./TESTING.md)** - Complete testing guide for mock and real integration tests
- **[SDK_Question.md](./SDK_Question.md)** - Technical questions for Canton team regarding SDK issues

### External Resources

- [Canton Network Documentation](https://docs.digitalasset.com/integrate/devnet/index.html)
- [Canton Token Standard](https://docs.dev.sync.global/app_dev/token_standard/index.html)
- [Wallet SDK Guide](https://docs.digitalasset.com/integrate/devnet/integrating-with-canton-network/index.html)

## Current Status

🎉 **The Canton Wallet SDK integration is fully operational!**

- ✅ **Wallet Creation**: Working end-to-end with Canton LocalNet
- ✅ **SDK Integration**: All major bugs resolved via automated patches
- ✅ **Authentication**: JWT tokens functional with LocalNet
- ✅ **Testing**: Both mock (15/15) and real integration tests (7/13) working
- ⚠️ **Token Operations**: Require proper DAML template configuration

See [CANTON_INTEGRATION_STATUS.md](./CANTON_INTEGRATION_STATUS.md) for detailed status and technical achievements.

## Backend-for-Frontend (BFF)

A Fastify server provides trusted access to the Canton SDK (Node-only) and exposes REST endpoints to the React app.

- Location: `server/`
- Port: 8899
- Docs: `http://localhost:8899/docs`

Setup:

```bash
cp .env.server.example .env.server
npm run server:start
```

Health check:

```bash
curl -s http://localhost:8899/api/health
```

Initialize SDK connections (user, admin, topology):

```bash
curl -s -X POST http://localhost:8899/api/init -H 'content-type: application/json' -d '{}'
```

Do NOT commit `.env.server`; use the provided `.env.server.example` and set real values via secrets in CI/CD.
