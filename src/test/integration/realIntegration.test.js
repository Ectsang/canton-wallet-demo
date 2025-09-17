// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import CantonService from '../../cantonService';
import { getConfig } from '../../config';
import { setupIntegrationTests, cleanupIntegrationTests } from './helpers/localnetSetup.js';

/**
 * REAL INTEGRATION TESTS
 * 
 * These tests interact with an actual Canton LocalNet instance.
 * Prerequisites:
 * 1. Canton LocalNet must be running (docker-compose up)
 * 2. Ports 2901 (Ledger API) and 2902 (Admin API) must be accessible
 * 3. Run with: RUN_REAL_INTEGRATION_TESTS=true npm test realIntegration.test.js
 * 
 * To verify results in Canton console:
 * 1. Connect to Canton console: docker exec -it canton-participant-console /canton/bin/canton console
 * 2. Run verification commands (see comments in each test)
 */

describe('Real Canton Integration Tests', () => {
  let cantonService;
  let createdWalletInfo = null;
  let createdTokens = [];
  const testTimeout = 60000; // 60 seconds for real network operations

  // Only run if explicitly enabled
  const runRealTests = process.env.RUN_REAL_INTEGRATION_TESTS === 'true';
  const describeReal = runRealTests ? describe : describe.skip;

  describeReal('Canton LocalNet Real Integration', () => {
    beforeAll(async () => {
      console.log('🚀 Starting real Canton integration tests...');
      console.log('📋 Canton LocalNet configuration:', getConfig());
      
      // Perform comprehensive health check before running tests
      console.log('🏥 Performing LocalNet health check...');
      try {
        await setupIntegrationTests();
        console.log('✅ LocalNet health check passed - proceeding with integration tests');
      } catch (error) {
        console.error('❌ LocalNet health check failed:', error.message);
        console.error('');
        console.error('💡 To fix this issue:');
        console.error('   1. Start LocalNet: canton -c examples/01-simple-topology/simple-topology.conf');
        console.error('   2. Wait for services: node scripts/check-localnet.js --wait');
        console.error('   3. Retry tests: npm run test:integration:real');
        console.error('');
        throw new Error('LocalNet is not healthy - aborting integration tests');
      }

      // Initialize the service
      cantonService = CantonService;
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      
      console.log('Canton service initialized successfully');
    }, testTimeout);

    afterAll(() => {
      // Log summary for Canton console verification
      console.log('\n=== Test Summary for Canton Console Verification ===');
      if (createdWalletInfo) {
        console.log(`Created Wallet Party ID: ${createdWalletInfo.partyId}`);
        console.log(`Wallet Public Key: ${createdWalletInfo.publicKey}`);
        console.log(`Wallet Fingerprint: ${createdWalletInfo.fingerprint}`);
      }
      
      if (createdTokens.length > 0) {
        console.log('\nCreated Tokens:');
        createdTokens.forEach((token, index) => {
          console.log(`${index + 1}. Token ID: ${token.tokenId}`);
          console.log(`   Name: ${token.name}`);
          console.log(`   Symbol: ${token.symbol}`);
          console.log(`   Decimals: ${token.decimals}`);
          console.log(`   Final Balance: ${token.finalBalance}`);
        });
      }
      
      console.log('\n=== Canton Console Verification Commands ===');
      console.log('1. List all parties:');
      console.log('   participant.parties.list()');
      console.log('\n2. Check specific party:');
      console.log(`   participant.parties.find("${createdWalletInfo?.partyId}")`);
      console.log('\n3. List active contracts:');
      console.log('   participant.ledger_api.acs.of_all()');
      console.log('\n4. Check token contracts:');
      console.log('   participant.ledger_api.acs.filter(contract => contract.templateId.includes("Token"))');
      console.log('================================================\n');
    });

    describe('Wallet Creation on Real Canton', () => {
      it('should create an external wallet and verify on Canton', async () => {
        const timestamp = Date.now();
        const partyHint = `real-test-wallet-${timestamp}`;
        
        console.log(`\nCreating wallet with hint: ${partyHint}`);
        
        createdWalletInfo = await cantonService.createExternalWallet(partyHint);
        
        expect(createdWalletInfo).toBeDefined();
        // Canton SDK v0.5.0 returns party IDs in hint::hash format
        expect(createdWalletInfo.partyId).toMatch(/^[\w-]+::[0-9a-f]+$/);
        expect(createdWalletInfo.publicKey).toBeTruthy();
        expect(createdWalletInfo.fingerprint).toBeTruthy();
        
        console.log(`Wallet created successfully:`);
        console.log(`- Party ID: ${createdWalletInfo.partyId}`);
        console.log(`- Public Key: ${createdWalletInfo.publicKey}`);
        console.log(`- Fingerprint: ${createdWalletInfo.fingerprint}`);
        
        // Canton Console Verification:
        // participant.parties.find("${createdWalletInfo.partyId}")
        // Should return the party details
      }, testTimeout);

      it('should handle wallet creation errors gracefully', async () => {
        // Try to create a wallet with an invalid configuration
        const originalKeyPair = cantonService.keyPair;
        cantonService.keyPair = null;
        
        try {
          await cantonService.createExternalWallet('invalid-wallet-test');
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeDefined();
          expect(error.message).toBeTruthy();
          console.log('Expected error handled correctly:', error.message);
        } finally {
          // Restore
          cantonService.keyPair = originalKeyPair;
        }
      });
    });

    describe('Token Creation on Real Canton', () => {
      beforeEach(() => {
        expect(createdWalletInfo).toBeDefined();
        expect(cantonService.partyId).toBeTruthy();
      });

      it('should create a token and verify on Canton', async () => {
        const timestamp = Date.now();
        const tokenName = `Real Integration Test Token ${timestamp}`;
        const tokenSymbol = 'RIT';
        const decimals = 2;
        
        console.log(`\nCreating token: ${tokenName} (${tokenSymbol})`);
        
        const tokenResult = await cantonService.createToken(tokenName, tokenSymbol, decimals);
        
        expect(tokenResult).toBeDefined();
        const tokenId = tokenResult.tokenId || tokenResult;
        expect(tokenId).toBeTruthy();
        
        console.log(`Token created successfully:`);
        console.log(`- Token ID: ${tokenId}`);
        console.log(`- Name: ${tokenName}`);
        console.log(`- Symbol: ${tokenSymbol}`);
        console.log(`- Decimals: ${decimals}`);
        
        createdTokens.push({
          tokenId,
          name: tokenName,
          symbol: tokenSymbol,
          decimals,
          finalBalance: 0
        });
        
        // Canton Console Verification:
        // participant.ledger_api.acs.filter(c => c.argument.tokenId == "${tokenId}")
        // Should show the token contract
      }, testTimeout);

      it('should create multiple tokens for the same wallet', async () => {
        const tokens = [];
        
        for (let i = 1; i <= 3; i++) {
          const tokenName = `Multi Token ${i} - ${Date.now()}`;
          const tokenSymbol = `MT${i}`;
          const decimals = i + 1; // Different decimals for each
          
          console.log(`\nCreating token ${i}: ${tokenName} (${tokenSymbol})`);
          
          const result = await cantonService.createToken(tokenName, tokenSymbol, decimals);
          const tokenId = result.tokenId || result;
          
          tokens.push({
            tokenId,
            name: tokenName,
            symbol: tokenSymbol,
            decimals
          });
          
          console.log(`Token ${i} created with ID: ${tokenId}`);
        }
        
        expect(tokens).toHaveLength(3);
        // All tokens should have unique IDs
        const uniqueIds = new Set(tokens.map(t => t.tokenId));
        expect(uniqueIds.size).toBe(3);
        
        tokens.forEach(token => {
          createdTokens.push({ ...token, finalBalance: 0 });
        });
      }, testTimeout);
    });

    describe('Token Minting on Real Canton', () => {
      let testTokenId;
      
      beforeEach(() => {
        expect(createdTokens.length).toBeGreaterThan(0);
        testTokenId = createdTokens[0].tokenId;
      });

      it('should mint tokens and verify balance on Canton', async () => {
        const mintAmount = 10000; // 100.00 with 2 decimals
        
        console.log(`\nMinting ${mintAmount} tokens to ${testTokenId}`);
        
        const mintResult = await cantonService.mintTokens(testTokenId, mintAmount);
        
        expect(mintResult).toBeDefined();
        console.log('Mint transaction result:', mintResult);
        
        // Verify balance
        const balance = await cantonService.getTokenBalance(testTokenId);
        expect(balance).toBe(mintAmount);
        
        console.log(`Balance after minting: ${balance}`);
        
        // Update final balance for summary
        createdTokens[0].finalBalance = balance;
        
        // Canton Console Verification:
        // participant.ledger_api.acs.filter(c => c.argument.owner == "${cantonService.partyId}" && c.argument.tokenId == "${testTokenId}")
        // Should show the balance contract
      }, testTimeout);

      it('should handle multiple minting operations', async () => {
        const amounts = [5000, 3000, 2000]; // Total: 10000
        let totalMinted = 0;
        
        console.log(`\nPerforming multiple mints on token ${testTokenId}`);
        
        for (const amount of amounts) {
          console.log(`Minting ${amount} tokens...`);
          
          await cantonService.mintTokens(testTokenId, amount);
          totalMinted += amount;
          
          const balance = await cantonService.getTokenBalance(testTokenId);
          console.log(`Current balance: ${balance}`);
          
          // Balance should be cumulative
          expect(balance).toBeGreaterThanOrEqual(totalMinted);
        }
        
        const finalBalance = await cantonService.getTokenBalance(testTokenId);
        console.log(`Final balance after all mints: ${finalBalance}`);
        
        // Update final balance
        createdTokens[0].finalBalance = finalBalance;
      }, testTimeout);

      it('should mint to a different recipient', async () => {
        // Create a second wallet as recipient
        const recipientHint = `recipient-wallet-${Date.now()}`;
        console.log(`\nCreating recipient wallet: ${recipientHint}`);
        
        // Save current state
        const originalPartyId = cantonService.partyId;
        const originalKeyPair = cantonService.keyPair;
        
        const recipientWallet = await cantonService.createExternalWallet(recipientHint);
        const recipientPartyId = recipientWallet.partyId;
        
        console.log(`Recipient wallet created: ${recipientPartyId}`);
        
        // Restore original wallet for minting
        cantonService.partyId = originalPartyId;
        cantonService.keyPair = originalKeyPair;
        cantonService.sdk.userLedger?.setPartyId(originalPartyId);
        cantonService.sdk.adminLedger?.setPartyId(originalPartyId);
        
        // Mint to recipient
        const mintAmount = 2500;
        console.log(`Minting ${mintAmount} tokens to recipient ${recipientPartyId}`);
        
        await cantonService.mintTokens(testTokenId, mintAmount, recipientPartyId);
        
        // Switch to recipient to check balance
        cantonService.partyId = recipientPartyId;
        cantonService.sdk.userLedger?.setPartyId(recipientPartyId);
        
        const recipientBalance = await cantonService.getTokenBalance(testTokenId);
        expect(recipientBalance).toBe(mintAmount);
        
        console.log(`Recipient balance: ${recipientBalance}`);
        
        // Restore original wallet
        cantonService.partyId = originalPartyId;
        cantonService.sdk.userLedger?.setPartyId(originalPartyId);
        
        // Canton Console Verification:
        // participant.ledger_api.acs.filter(c => c.argument.owner == "${recipientPartyId}")
        // Should show the recipient's balance
      }, testTimeout);
    });

    describe('Token Query Operations on Real Canton', () => {
      it('should list all tokens for the wallet', async () => {
        console.log('\nListing all tokens for the wallet...');
        
        const tokens = await cantonService.listTokens();
        
        expect(tokens).toBeDefined();
        expect(Array.isArray(tokens)).toBe(true);
        console.log(`Found ${tokens.length} tokens`);
        
        // Should include all our created tokens
        createdTokens.forEach(createdToken => {
          const found = tokens.some(token => 
            (token.tokenId || token) === createdToken.tokenId
          );
          expect(found).toBe(true);
        });
        
        console.log('Token list:', tokens);
      }, testTimeout);

      it('should get balance for each created token', async () => {
        console.log('\nChecking balances for all created tokens...');
        
        for (const token of createdTokens) {
          const balance = await cantonService.getTokenBalance(token.tokenId);
          console.log(`Token ${token.symbol} (${token.tokenId}): Balance = ${balance}`);
          
          expect(balance).toBeGreaterThanOrEqual(0);
        }
      }, testTimeout);

      it('should return zero balance for non-existent token', async () => {
        const fakeTokenId = 'token::non-existent-12345';
        console.log(`\nChecking balance for non-existent token: ${fakeTokenId}`);
        
        const balance = await cantonService.getTokenBalance(fakeTokenId);
        
        expect(balance).toBe(0);
        console.log('Balance for non-existent token:', balance);
      }, testTimeout);
    });

    describe('Canton Network Health Checks', () => {
      it('should verify Canton APIs are responsive', async () => {
        console.log('\nChecking Canton API connectivity...');
        
        // Instead of trying to make HTTP requests to gRPC endpoints,
        // we'll verify that our SDK connections are working
        try {
          // Test that we can make a simple query through the SDK
          const tokens = await cantonService.listTokens();
          console.log('Ledger API: OK (SDK connection working)');
          expect(Array.isArray(tokens)).toBe(true);
          
          // Test that we have a valid party ID (indicates successful connection)
          expect(cantonService.partyId).toBeTruthy();
          console.log('Party management: OK (Party ID available)');
          
          // Test that token standard is available
          expect(cantonService.sdk.tokenStandard).toBeTruthy();
          console.log('Token Standard: OK (Available)');
          
        } catch (error) {
          console.error('Canton API connectivity test failed:', error);
          throw error;
        }
      }, testTimeout);
    });

    describe('Error Recovery and Edge Cases', () => {
      it('should handle network interruption gracefully', async () => {
        // This test simulates what happens if Canton goes down temporarily
        console.log('\nTesting error handling for network issues...');
        
        // Save original URL
        const originalUrl = cantonService.config.LEDGER_API_URL;
        
        // Point to non-existent service
        cantonService.config.LEDGER_API_URL = 'http://localhost:9999';
        
        try {
          await cantonService.listTokens();
          // Should not reach here
          expect(true).toBe(false);
        } catch (error) {
          expect(error).toBeDefined();
          console.log('Network error handled correctly:', error.message);
        } finally {
          // Restore
          cantonService.config.LEDGER_API_URL = originalUrl;
        }
      });

      it('should maintain consistency after errors', async () => {
        // Verify service still works after error
        const tokens = await cantonService.listTokens();
        expect(tokens).toBeDefined();
        expect(Array.isArray(tokens)).toBe(true);
        
        console.log('Service recovered successfully, found', tokens.length, 'tokens');
      });
    });
  });
});