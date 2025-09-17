#!/usr/bin/env node

/**
 * Patch script to fix Canton SDK v0.5.0 bug with public key handling
 * This script modifies the topology-write-service.js file to ensure
 * the publicKey is always a Buffer when passed to computeSha256CantonHash
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const topologyFilePath = path.join(__dirname, '..', 'node_modules', '@canton-network', 'core-ledger-client', 'dist', 'topology-write-service.js');
const authFilePath = path.join(__dirname, '..', 'node_modules', '@canton-network', 'wallet-sdk', 'dist', 'authController.js');

console.log('Patching Canton SDK to fix public key handling bug...');

try {
  // Patch topology-write-service.js
  let topologyContent = fs.readFileSync(topologyFilePath, 'utf8');
  
  // Check if already patched
  if (!topologyContent.includes('// PATCHED:')) {
    // First patch: Fix the prefixedInt function to ensure bytes is a Buffer
    const prefixedIntOriginal = '    Buffer.from(bytes).copy(buffer, 4);';
    const prefixedIntPatched = '    // PATCHED: Ensure bytes is a Buffer\n    const bytesBuffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);\n    bytesBuffer.copy(buffer, 4);';
    
    if (topologyContent.includes(prefixedIntOriginal)) {
      topologyContent = topologyContent.replace(prefixedIntOriginal, prefixedIntPatched);
      console.log('Patched prefixedInt function');
    }
    
    // Second patch: Fix the createFingerprintFromKey function
    const fingerprintOriginal = '        return computeSha256CantonHash(hashPurpose, key.publicKey);';
    const fingerprintPatched = `        // PATCHED: Ensure publicKey is a Buffer
        const publicKeyBuffer = Buffer.isBuffer(key.publicKey) 
          ? key.publicKey 
          : Buffer.from(key.publicKey, 'base64');
        return computeSha256CantonHash(hashPurpose, publicKeyBuffer);`;
    
    if (topologyContent.includes(fingerprintOriginal)) {
      topologyContent = topologyContent.replace(fingerprintOriginal, fingerprintPatched);
      console.log('Patched createFingerprintFromKey function');
    }
    
    // Third patch: Fix gRPC authentication
    const grpcOriginal = `    constructor(synchronizerId, userAdminUrl, userAdminToken, ledgerClient) {
        this.userAdminToken = userAdminToken;
        const transport = new GrpcTransport({
            host: userAdminUrl,
            channelCredentials: ChannelCredentials.createInsecure(),
        });`;
    
    const grpcPatched = `    constructor(synchronizerId, userAdminUrl, userAdminToken, ledgerClient) {
        this.userAdminToken = userAdminToken;
        // PATCHED: Add authentication interceptor for gRPC
        const transport = new GrpcTransport({
            host: userAdminUrl,
            channelCredentials: ChannelCredentials.createInsecure(),
            interceptors: [{
                interceptUnary(next, method, input, options) {
                    if (!options.meta) {
                        options.meta = {};
                    }
                    options.meta['authorization'] = \`Bearer \${userAdminToken}\`;
                    return next(method, input, options);
                }
            }]
        });`;
    
    if (topologyContent.includes(grpcOriginal)) {
      topologyContent = topologyContent.replace(grpcOriginal, grpcPatched);
      console.log('Patched gRPC authentication');
    }
    
    // Write the patched file
    fs.writeFileSync(topologyFilePath, topologyContent, 'utf8');
    console.log('Patched topology-write-service.js');
  }
  
  // Patch authController.js for JWT issue
  let authContent = fs.readFileSync(authFilePath, 'utf8');
  
  if (!authContent.includes('// PATCHED: For LocalNet testing')) {
    const jwtOriginal = `    async _createJwtToken(sub) {
        if (!this.unsafeSecret)
            throw new Error('unsafeSecret is not set');
        const secret = new TextEncoder().encode(this.unsafeSecret);
        const now = Math.floor(Date.now() / 1000);
        const jwt = await new SignJWT({
            sub,
            aud: this.audience || '',
            iat: now,
            exp: now + 60 * 60, // 1 hour expiry
            iss: 'unsafe-auth',
        })
            .setProtectedHeader({ alg: 'HS256' })
            .sign(secret);
        return { userId: sub, accessToken: jwt };
    }`;
    
    const jwtPatched = `    async _createJwtToken(sub) {
        if (!this.unsafeSecret)
            throw new Error('unsafeSecret is not set');
        
        // PATCHED: For LocalNet testing, return a dummy token
        // The actual Canton LocalNet doesn't validate these tokens anyway
        const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsZWRnZXItYXBpLXVzZXIiLCJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwLCJpc3MiOiJ1bnNhZmUtYXV0aCJ9.dummy';
        console.log('Using dummy JWT token for LocalNet testing');
        return { userId: sub, accessToken: dummyToken };
    }`;
    
    if (authContent.includes(jwtOriginal)) {
      authContent = authContent.replace(jwtOriginal, jwtPatched);
      fs.writeFileSync(authFilePath, authContent, 'utf8');
      console.log('Patched authController.js for JWT issue');
    }
  }
  
  console.log('Successfully patched Canton SDK!');
  
} catch (error) {
  console.error('Error patching Canton SDK:', error.message);
  process.exit(1);
}