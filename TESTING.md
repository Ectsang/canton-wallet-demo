# Canton Wallet Demo - Testing Guide

## Overview

This guide covers all testing scenarios for the Canton wallet demo, including both mocked tests and real integration tests with Canton LocalNet.

## Test Types

### 1. Mock Integration Tests (15/15 ✅ PASSING)

- Use mock Canton service for testing without LocalNet dependency
- Test all application logic and error handling
- Fast execution, no external dependencies

### 2. Real Integration Tests (7/13 ✅ CORE WORKING)

- Connect to actual Canton LocalNet instance
- Create real wallets and verify on blockchain
- Test SDK integration with real Canton services

### 3. Unit Tests

- Test individual components and services
- Mock all external dependencies
- Focus on business logic

## Quick Start

### Prerequisites

1. **For Mock Tests**: None (self-contained)
2. **For Real Integration Tests**:
   - Docker Desktop running
   - Canton LocalNet at `/Users/e/code/sbc/canton/localnet/`
   - Ports 2901, 2902, 2903, 2975, 2000 available

### Run All Tests

```bash
# Mock integration tests (recommended for development)
npm run test:integration

# Real integration tests (requires LocalNet)
npm run test:real:direct

# All unit tests
npm run test:unit

# All tests with coverage
npm run test:coverage
```

## Real Integration Tests

### Automated Setup (Recommended)

The test runner automatically checks Canton status and offers to start it:

```bash
npm run test:real
```

This will:

1. Check if Docker is running
2. Check if Canton LocalNet is running
3. Offer to start Canton if needed
4. Wait for Canton to be healthy
5. Run the integration tests
6. Show verification instructions

### Manual Setup

1. **Start Canton LocalNet**:

   ```bash
   cd /Users/e/code/sbc/canton/localnet/splice-node/docker-compose/localnet
   docker-compose up -d
   ```

2. **Wait for Health Check**:

   ```bash
   docker ps | grep canton
   # Wait until status shows "healthy"
   ```

3. **Run Tests**:

   ```bash
   npm run test:real:direct
   ```

### Direct Test Execution

```bash
# Run specific real integration test
RUN_REAL_INTEGRATION_TESTS=true vitest run --config vitest.config.integration.js src/test/realIntegration.test.js

# Run with verbose output
RUN_REAL_INTEGRATION_TESTS=true vitest run --reporter=verbose --config vitest.config.integration.js src/test/realIntegration.test.js
```

## Test Results Interpretation

### Expected Results

**Mock Integration Tests:**

- ✅ All 15 tests should pass
- Tests wallet creation, token operations, error handling

**Real Integration Tests:**

- ✅ 7/13 tests passing (core functionality working)
- ✅ Wallet creation tests (2/2 passing)
- ❌ Token operation tests (6/13 failing - expected due to DAML template issues)

### Common Issues

1. **"window is not defined" Error**:
   - Cause: Test using browser setup instead of Node.js
   - Solution: Use `npm run test:real:direct` instead of `npm run test:integration`

2. **"Canton not running" Error**:
   - Cause: LocalNet not started
   - Solution: Start LocalNet with `docker-compose up -d`

3. **"Connection timeout" Error**:
   - Cause: Canton services not fully initialized
   - Solution: Wait for "healthy" status in `docker ps`

## Verification

### Canton Console Verification

After running real integration tests, verify results in Canton console:

1. **Connect to Canton**:

   ```bash
   docker exec -it canton /canton/bin/canton console
   ```

2. **List Created Parties**:

   ```scala
   participant.parties.list()
   ```

3. **Find Specific Party**:

   ```scala
   participant.parties.find("real-test-wallet-...")
   ```

4. **List Active Contracts**:

   ```scala
   participant.ledger_api.acs.of_all()
   ```

### Health Check Verification

```bash
# Check Canton container status
docker ps | grep canton

# Check port accessibility
lsof -i :2901 -i :2902 -i :2903

# Test API endpoints (note: 2901/2902 are gRPC, not HTTP)
nc -z localhost 2901 && echo "Ledger API (gRPC) accessible" || echo "Ledger API not accessible"
nc -z localhost 2902 && echo "Admin API (gRPC) accessible" || echo "Admin API not accessible"
curl -f http://localhost:2000 > /dev/null && echo "Scan UI accessible" || echo "Scan UI not accessible"
```

## Test Configuration

### Environment Variables

- `RUN_INTEGRATION_TESTS=true` - Enable mock integration tests
- `RUN_REAL_INTEGRATION_TESTS=true` - Enable real integration tests
- `NODE_ENV=test` - Set test environment

### Test Files

- `src/test/integration.test.js` - Mock integration tests
- `src/test/realIntegration.test.js` - Real integration tests
- `src/test/cantonService.test.js` - Unit tests for Canton service
- `src/test/errorHandling.test.js` - Error handling tests
- `src/test/App.test.jsx` - React component tests

### Configuration Files

- `vite.config.js` - Main test configuration (jsdom environment)
- `vitest.config.integration.js` - Node.js environment for real integration tests
- `src/test/setup.js` - Browser environment setup
- `src/test/setup.node.js` - Node.js environment setup

## Troubleshooting

### SDK Patches Not Applied

```bash
# Check if patches are applied
grep -n "PATCHED" node_modules/@canton-network/core-ledger-client/dist/topology-write-service.js

# If not found, reinstall
rm -rf node_modules package-lock.json
npm install
```

### Canton LocalNet Issues

```bash
# Check Canton logs
docker-compose logs -f

# Restart Canton
docker-compose down
docker-compose up -d

# Check Canton health
docker exec canton /canton/bin/canton console --help
```

### Port Conflicts

```bash
# Check what's using Canton ports
lsof -i :2901 -i :2902 -i :2903 -i :2975 -i :2000

# Kill conflicting processes if needed
sudo lsof -ti:2901 | xargs kill -9
```

## Development Workflow

1. **During Development**: Use mock integration tests (`npm run test:integration`)
2. **Before Commits**: Run all tests (`npm run test:all`)
3. **Integration Verification**: Run real tests (`npm run test:real`)
4. **Production Readiness**: Ensure wallet creation tests pass on real LocalNet

## Performance

- **Mock Tests**: ~500ms (fast feedback loop)
- **Real Integration Tests**: ~8-10s (includes network operations)
- **Full Test Suite**: ~15-20s (all tests combined)

The mock tests are ideal for development and CI/CD, while real integration tests provide confidence in the actual Canton integration.
