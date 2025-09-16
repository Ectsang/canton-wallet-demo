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
- Canton Network services running on default ports:
  - Ledger API: http://localhost:5011
  - Admin API: http://localhost:5012
  - Scan API: http://localhost:5014

## Installation

```bash
npm install
```

## Running the Demo

```bash
npm run dev
```

The application will start on http://localhost:5173 (or another available port).

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

# Run integration tests (requires LocalNet)
npm run test:integration

# Run all tests (unit + integration)
npm run test:all
```

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

## Learn More

- [Canton Network Documentation](https://docs.digitalasset.com/integrate/devnet/index.html)
- [Canton Token Standard](https://docs.dev.sync.global/app_dev/token_standard/index.html)
- [Wallet SDK Guide](https://docs.digitalasset.com/integrate/devnet/integrating-with-canton-network/index.html)