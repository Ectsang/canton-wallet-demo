# Canton Wallet Demo Integration Report

## Project Goal

**Objective**: Create a web application demonstrating **real DAML contract operations** on Canton Network LocalNet, specifically:

1. External wallet creation with cryptographic key pairs
2. Custom token deployment using MinimalToken DAML contracts
3. Token minting via DAML Issue choices
4. Balance queries from Active Contract Set (ACS)

**Core Requirement**: 100% real Canton ledger operations - no mocking or simulation.

## Technical Architecture Attempted

- **Frontend**: React 19.1.1 + Vite 7.1.5
- **Backend**: Fastify server as Backend-for-Frontend (BFF)
- **DAML Contracts**: MinimalToken.daml (Instrument + Holding templates)
- **Canton Integration**: Canton Wallet SDK 0.7.0
- **LocalNet**: Initially Splice LocalNet 0.4.15, later CN Quickstart

## Implementation Attempts & Results

### 1. Initial Mock Detection & Elimination ✅

**Problem**: Application appeared to work but was using fake implementations.
**Solution**: Identified and removed all mocking in `CantonConsoleService`.
**Result**: Successfully eliminated fake operations.

### 2. Real Wallet Creation ✅

**Approach**: Used Canton Wallet SDK `prepareSignAndSubmitExternalParty()`.
**Implementation**: Generated Ed25519 key pairs, registered parties with topology controller.
**Result**: **SUCCESS** - Real external parties created on Canton ledger.
**Evidence**: Party IDs in format `1220e::1220xxx...` confirmed as real Canton parties.

### 3. DAML Contract Deployment ✅

**Challenge**: DAML-LF version compatibility.
**Problem**: Splice LocalNet 0.4.15 required DAML-LF 2.1, but user's DAML SDK 2.10.2 only supported up to 1.17.
**Solution**: Used CN Quickstart's DAML SDK 3.3.0-snapshot with `--target=2.1`.
**Result**: **SUCCESS** - MinimalToken DAR compiled and deployed.

### 4. Real Contract Creation ✅

**Approach**: Used Canton Wallet SDK `prepareSignAndExecuteTransaction()` with proper command format.
**Implementation**:

```javascript
const commands = [
  {
    CreateCommand: {
      templateId: `${packageId}:MinimalToken:Instrument`,
      createArguments: { admin, name, symbol, decimals },
    },
  },
];
```

**Result**: **SUCCESS** - Real DAML contracts created on ledger.
**Evidence**: `waitForCompletion()` returns transaction results with `updateId`.

### 5. Contract ID Extraction ❌ **CRITICAL FAILURE**

**Problem**: Cannot extract real contract IDs from transaction results for subsequent operations.

#### Attempted Solutions

1. **SDK TokenStandard Method**: `sdk.tokenStandard.getTransactionById(updateId)`

   - **Limitation**: Canton team confirmed this only works for token standard operations, not custom DAML contracts.

2. **JSON Ledger API**: Direct HTTP calls to `/v2/updates/update-by-id`

   - **Failure**: Security errors on both Splice and CN Quickstart LocalNet.
   - **Error**: "A security-sensitive error has been received"

3. **ActiveContracts Query**: `sdk.userLedger.activeContracts()`

   - **Failure**: Security errors, permission denied.

4. **Direct gRPC API**: Multiple endpoint attempts

   - **Failure**: All endpoints return security errors or authentication failures.

5. **Canton Console Commands**: `execSync` calls to extract contract IDs
   - **Failure**: Complex multi-line commands fail, authentication issues.

**Root Cause**: `waitForCompletion()` returns `updateId` (transaction identifier) in format `1220xxx...`, but `ExerciseCommand` requires `contractId` (contract identifier) in format `00xxx...`. All methods to extract real contract IDs are blocked by LocalNet security restrictions.

### 6. Token Minting ❌ **BLOCKED**

**Problem**: Cannot mint tokens because `ExerciseCommand` rejects `updateId` format as invalid `contractId`.
**Error**: `Invalid field contract_id: cannot parse ContractId "1220xxx..."`
**Status**: **BLOCKED** by contract ID extraction failure.

### 7. LocalNet Environment Switch

**Attempted**: Switched from Splice LocalNet to CN Quickstart LocalNet.
**Motivation**: Hoped CN Quickstart would have different security configurations.
**Result**: **WORSE** - CN Quickstart uses Keycloak JWT authentication instead of simple unsafe auth, adding complexity without solving core issue.

## Current Status

### ✅ Working Components

1. **Wallet Creation**: Real external parties with cryptographic keys
2. **Contract Creation**: Real DAML Instrument contracts on ledger
3. **SDK Integration**: Proper signing flow with `prepareSignAndExecuteTransaction`
4. **Authentication**: Working with Splice LocalNet unsafe auth

### ❌ Blocked Components

1. **Contract ID Extraction**: All methods fail due to security restrictions
2. **Token Minting**: Cannot proceed without real contract IDs
3. **Balance Queries**: Dependent on successful minting
4. **End-to-End Workflow**: Incomplete due to minting failure

## Technical Limitations Identified

### 1. Canton Wallet SDK Limitations

- `sdk.tokenStandard.getTransactionById()` only supports token standard operations
- No documented method for extracting contract IDs from custom DAML contracts
- Limited documentation on transaction result structures

### 2. LocalNet Security Restrictions

- JSON Ledger API blocked by security policies on both Splice and CN Quickstart
- ActiveContracts queries fail with permission errors
- Direct gRPC API calls rejected

### 3. Authentication Complexity

- Splice LocalNet: Uses unsafe auth but has security restrictions
- CN Quickstart: Uses Keycloak JWT, incompatible with current SDK configuration

### 4. Documentation Gaps

- Insufficient examples of custom DAML contract operations with Canton Wallet SDK
- Limited guidance on LocalNet security configuration
- No clear path for contract ID extraction from transaction results

## Knowledge Gaps & Required Resources

### 1. Canton Wallet SDK Documentation

**Gap**: How to extract contract IDs from custom DAML contract transactions.
**Need**:

- Complete API reference for transaction result structures
- Examples of custom DAML contract operations beyond token standard
- Best practices for contract ID extraction

### 2. LocalNet Configuration

**Gap**: How to configure LocalNet security for development use cases.
**Need**:

- Documentation on disabling security restrictions for development
- Configuration examples for different authentication modes
- Comparison of Splice vs CN Quickstart LocalNet capabilities

### 3. Canton Network Architecture

**Gap**: Understanding of transaction ID vs contract ID relationship.
**Need**:

- Technical documentation on Canton's transaction and contract identifier systems
- Explanation of when and how contract IDs are generated vs transaction IDs

### 4. Alternative Integration Approaches

**Gap**: Other methods for Canton integration beyond Canton Wallet SDK.
**Need**:

- Direct Ledger API integration examples
- Canton Console automation patterns
- Alternative SDKs or tools for custom DAML operations

## Recommendations for Additional Resources

1. **Canton Wallet SDK Examples Repository**

   - Real-world examples of custom DAML contract operations
   - Transaction result parsing examples
   - Contract ID extraction patterns

2. **LocalNet Development Guide**

   - Step-by-step setup for development environments
   - Security configuration options
   - Troubleshooting common authentication issues

3. **Canton Network Developer Documentation**

   - Complete API reference for all Canton components
   - Architecture diagrams showing data flow
   - Integration patterns and best practices

4. **Direct Canton Team Consultation**
   - Technical support for custom DAML contract operations
   - Guidance on LocalNet configuration for development
   - Clarification on SDK limitations and alternatives

## Detailed Error Analysis

### Authentication Failures (Current CN Quickstart Issue)

```
❌ Failed to initialize Canton SDK: The supplied authentication is invalid
Error: 401 Unauthorized
WWW-Authenticate: Bearer realm="splice scan proxy realm"
URL: http://wallet.localhost:2000/api/validator/v0/scan-proxy/amulet-rules
```

**Analysis**: CN Quickstart LocalNet uses Keycloak JWT authentication, but Canton Wallet SDK is configured for simple unsafe auth. This represents a fundamental authentication mismatch.

### Contract ID Format Issue (Core Blocking Problem)

```
❌ Invalid field contract_id: cannot parse ContractId "1220xxx..."
```

**Analysis**:

- `waitForCompletion()` returns `updateId` in format `1220xxx...` (transaction identifier)
- `ExerciseCommand` expects `contractId` in format `00xxx...` (contract identifier)
- No available method successfully extracts real contract IDs from transaction results

## Conclusion

The project successfully demonstrates **real Canton ledger integration** for wallet creation and contract deployment. However, it is **fundamentally blocked** by the inability to extract contract IDs for subsequent operations. This is not a limitation that can be "mocked away" - it represents a core gap in either:

1. **Our understanding** of how to properly extract contract IDs from Canton transactions
2. **The Canton Wallet SDK's capabilities** for custom DAML contracts
3. **LocalNet security configurations** that prevent necessary API access

The project requires either:

- **Technical guidance** from Canton team on proper contract ID extraction
- **Alternative integration approach** beyond Canton Wallet SDK
- **LocalNet reconfiguration** to enable necessary API access

## Next Steps Recommendations

**Short-term**: Consult Canton team on contract ID extraction for custom DAML contracts
**Medium-term**: Explore alternative integration approaches (direct Ledger API, Canton Console automation)
**Long-term**: Re-evaluate project scope based on Canton Wallet SDK capabilities vs requirements
