# LocalNet Health Check System

This document explains the LocalNet health check system that ensures integration tests only run against a healthy Canton LocalNet instance.

## 🏥 Health Check Components

### 1. Health Check Script (`scripts/check-localnet.js`)

A standalone Node.js script that verifies LocalNet availability and health.

**Usage:**

```bash
# Quick health check
npm run localnet:check

# Detailed status information  
npm run localnet:status

# Wait for LocalNet to become healthy (with timeout)
npm run localnet:wait

# Direct script usage
node scripts/check-localnet.js [options]
```

**Options:**

- `--wait` - Wait for LocalNet to become healthy (with timeout)
- `--timeout=<ms>` - Timeout in milliseconds (default: 30000)
- `--verbose, -v` - Verbose output showing detailed checks
- `--quiet, -q` - Quiet mode for CI/CD scripts
- `--help, -h` - Show help message

### 2. Health Check Helper (`src/test/integration/helpers/localnetSetup.js`)

Provides programmatic health checking functions for integration tests.

**Key Functions:**

- `checkLocalNetHealth()` - Performs comprehensive health check
- `setupIntegrationTests()` - Validates LocalNet before running tests
- `validateLocalNetConfig()` - Detailed configuration validation
- `waitForLocalNet()` - Wait for LocalNet with retries

### 3. Integration Test Protection

Integration tests automatically perform health checks before running.

## 🔍 What Gets Checked

The health check system verifies these Canton LocalNet services:

| Service | Port | Check Type | Purpose |
|---------|------|------------|---------|
| **Ledger API** | 2901 | TCP Connection | Core ledger operations |
| **Admin API** | 2902 | TCP Connection | Administrative functions |
| **Validator API** | 2903 | TCP Connection | Transaction validation |
| **UI Server** | 2000 | HTTP Request | Web interface |

## 🚀 Integration Test Workflow

### Safe Integration Testing

```bash
# 1. Always safe - runs mocked tests only
npm test

# 2. Safe when LocalNet unavailable - tests are skipped  
npm run test:integration

# 3. Health-checked integration tests (RECOMMENDED)
npm run test:integration:real

# 4. Force run without health check (NOT RECOMMENDED)
npm run test:integration:real:force
```

### Automatic Health Check Flow

When you run `npm run test:integration:real`:

1. **Pre-flight Check**: `npm run localnet:check` runs first
2. **Health Validation**: Verifies all Canton services are responsive
3. **Test Execution**: Only proceeds if LocalNet is healthy
4. **Graceful Failure**: Clear error messages if LocalNet is unavailable

## 📊 Health Check Results

### ✅ Healthy LocalNet

```
🏥 Canton LocalNet Health Check
================================
🔍 Checking LocalNet health...
✅ App User Ledger API: OK (Status: Connected)
✅ App User Admin API: OK (Status: Connected)  
✅ App User Validator API: OK (Status: Connected)
✅ App User UI: OK (Status: 200)
✅ LocalNet is healthy!
✅ LocalNet is healthy and ready for integration tests!
```

### ❌ Unhealthy LocalNet

```
🏥 Canton LocalNet Health Check
================================
🔍 Checking LocalNet health...
❌ App User Ledger API: ERROR (Connection refused)
❌ App User Admin API: TIMEOUT (Connection timeout)
❌ App User Validator API: ERROR (Connection refused)
❌ App User UI: ERROR (fetch failed)
❌ LocalNet health check failed!
Please ensure LocalNet is running: docker-compose up
❌ LocalNet is not healthy. Please start LocalNet and try again.
```

## 🛠️ Troubleshooting

### LocalNet Not Available

If health checks fail, follow these steps:

1. **Start LocalNet**:

   ```bash
   canton -c examples/01-simple-topology/simple-topology.conf
   ```

2. **Wait for Services**:

   ```bash
   npm run localnet:wait
   ```

3. **Verify Health**:

   ```bash
   npm run localnet:status
   ```

4. **Run Tests**:

   ```bash
   npm run test:integration:real
   ```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection refused | LocalNet not started | Start Canton LocalNet |
| Connection timeout | Services starting up | Wait longer or use `--wait` |
| HTTP protocol error | Wrong port/service | Check LocalNet configuration |
| Permission denied | Port access issues | Check firewall/port availability |

### Debug Mode

For detailed debugging information:

```bash
# Verbose health check
npm run localnet:status

# Wait with verbose output
node scripts/check-localnet.js --wait --verbose

# Integration tests with debug
DEBUG_TESTS=true npm run test:integration:real
```

## 🔧 Configuration

### LocalNet Ports

The health check system expects these default ports:

```javascript
const LOCALNET_CONFIG = {
  LEDGER_API_PORT: 2901,
  ADMIN_API_PORT: 2902, 
  VALIDATOR_API_PORT: 2903,
  UI_PORT: 2000,
};
```

### Timeouts

Default timeouts can be customized:

```javascript
const HEALTH_CHECK_TIMEOUT = 30000; // 30 seconds
const RETRY_INTERVAL = 2000; // 2 seconds
```

## 🎯 Best Practices

### Development Workflow

1. **Start LocalNet**: Always start LocalNet before integration testing
2. **Health Check**: Use `npm run localnet:wait` to ensure readiness
3. **Run Tests**: Use `npm run test:integration:real` for safe execution
4. **CI/CD**: Use quiet mode for automated environments

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
- name: Check LocalNet Health
  run: npm run localnet:check --quiet
  
- name: Run Integration Tests  
  run: npm run test:integration:real
  if: success()
```

### Error Handling

The health check system provides:

- **Clear error messages** with actionable solutions
- **Graceful failures** that don't break CI/CD
- **Timeout protection** to prevent hanging builds
- **Detailed logging** for debugging issues

## 📈 Benefits

✅ **Prevents Test Failures**: No more integration test failures due to LocalNet unavailability  
✅ **Clear Feedback**: Obvious distinction between infrastructure and code issues  
✅ **Developer Friendly**: Can develop without LocalNet running  
✅ **CI/CD Safe**: Automated builds won't hang or fail unexpectedly  
✅ **Production Ready**: Comprehensive validation before running expensive tests  

This health check system ensures your integration tests are **reliable**, **fast**, and **maintainable**!
