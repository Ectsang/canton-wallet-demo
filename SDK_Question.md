# Canton Wallet SDK v0.5.0 - Technical Questions for Canton Team

## Context

We are implementing a wallet demo application using the Canton Wallet SDK v0.5.0 (`@canton-network/wallet-sdk` and `@canton-network/core-ledger-client`) with Canton LocalNet. During integration, we encountered several technical issues that required workarounds. We would like to understand if these are known issues and whether they have been addressed in later versions.

## Environment

- **SDK Versions**:
  - `@canton-network/wallet-sdk`: ^0.5.0
  - `@canton-network/core-ledger-client`: ^0.5.0
- **Target Environment**: Canton LocalNet (docker-compose setup)
- **Runtime**: Node.js (for integration tests) and Browser (for UI)
- **Authentication**: Unsafe auth for LocalNet development

## Technical Issues Encountered

### 1. Buffer Type Handling in `topology-write-service.js`

**Issue**: The `createFingerprintFromKey` function in `topology-write-service.js` fails when `key.publicKey` is not a Buffer object.

**Error**:

```text
TypeError: "list" argument must be an Array of Buffers
  at Buffer.concat
  at computeSha256CantonHash
  at TopologyWriteService.createFingerprintFromKey
```

**Root Cause**: When `prepareExternalPartyTopology()` is called with a base64 string public key, the internal conversion creates a key object where `key.publicKey` may not be a Buffer, causing `Buffer.concat()` to fail in `computeSha256CantonHash()`.

**Our Workaround**:

```javascript
// Ensure publicKey is a Buffer before passing to computeSha256CantonHash
const publicKeyBuffer = Buffer.isBuffer(key.publicKey) 
  ? key.publicKey 
  : Buffer.from(key.publicKey, 'base64');
```

**Question**: Is this a known issue? Has it been fixed in versions after 0.5.0?

### 2. JWT Token Creation in Node.js Environment

**Issue**: The `_createJwtToken` method in `authController.js` uses `TextEncoder` which behaves differently in Node.js vs browser environments, causing authentication failures with LocalNet.

**Our Workaround**: We implemented a simplified JWT token creation that works with LocalNet's unsafe auth mechanism.

**Question**: Is there a recommended approach for JWT token creation in Node.js environments when using unsafe auth with LocalNet?

### 3. gRPC Authentication Header Handling

**Issue**: We observed potential duplicate authorization header issues when connecting to LocalNet's gRPC endpoints.

**Our Workaround**: We modified the gRPC transport configuration to ensure proper authorization header handling.

**Question**: What is the correct way to configure gRPC authentication for LocalNet in SDK v0.5.0?

## Current Status

With our workarounds applied via automated patches, we have achieved:

- ✅ Successful connection to Canton LocalNet
- ✅ External wallet creation working (parties successfully allocated)
- ✅ Authentication functional with LocalNet
- ❌ Token operations failing due to template naming (see below)

## Additional Question: Token Operations

We're encountering this error when attempting token operations:

```text
code: 'INVALID_ARGUMENT',
cause: 'The submitted request has invalid arguments: Expected <package>:<moduleName>:<entityName>, got Token:Token'
```

**Question**:

1. Does the SDK expect specific DAML template names to be deployed on LocalNet for token operations?
2. What is the correct format for template identifiers when using the SDK's token methods?
3. Are there example DAML contracts or template configurations for LocalNet token operations?

## Request

1. **Confirmation**: Are the issues we encountered in points 1-3 known bugs in SDK v0.5.0?
2. **Version Status**: Have these issues been addressed in versions newer than 0.5.0?
3. **Best Practices**: What are the recommended approaches for the scenarios described above?
4. **Token Operations**: Guidance on proper DAML template configuration for token operations with LocalNet.

## Additional Information

If helpful, we can provide:

- Complete error stack traces
- Minimal reproduction cases
- Our current working patch implementations
- Test results showing successful wallet creation with workarounds

We appreciate any guidance on whether our workarounds are necessary or if there are better approaches available in the current SDK versions.
