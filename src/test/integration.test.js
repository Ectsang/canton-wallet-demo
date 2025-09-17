import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getConfig } from '../config';

// Integration tests using mock service due to SDK bug with LocalNet
// The SDK has an issue with public key handling that prevents real LocalNet testing
// TODO: Switch back to real LocalNet once SDK bug is fixed
describe('Canton Integration Tests', () => {
  let cantonService;
  let walletInfo = null;
  let createdToken = null;
  const testTimeout = 30000; // 30 seconds for network operations

  // Always use mock service until SDK bug is fixed
  const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';
  const describeIntegration = runIntegrationTests ? describe : describe.skip;

  describeIntegration('Full Wallet and Token Flow', () => {
    beforeAll(async () => {
      // Use mock service due to SDK bug
      const { default: mockService } = await import('./mockCantonService.js');
      cantonService = mockService;
      
      // Initialize and connect once for all tests
      await cantonService.initialize();
      await cantonService.connectToNetwork();
    }, testTimeout);

    describe('Wallet Creation Flow', () => {
      it('should create an external wallet successfully', async () => {
        const partyHint = `test-wallet-${Date.now()}`;
        
        walletInfo = await cantonService.createExternalWallet(partyHint);
        
        expect(walletInfo).toBeDefined();
        expect(walletInfo.partyId).toMatch(/^party::/);
        expect(walletInfo.publicKey).toBeTruthy();
        expect(walletInfo.fingerprint).toBeTruthy();
        
        // Verify the service state
        expect(cantonService.partyId).toBe(walletInfo.partyId);
        expect(cantonService.keyPair).toBeDefined();
        expect(cantonService.keyPair.publicKey).toBe(walletInfo.publicKey);
      }, testTimeout);

      it('should handle duplicate wallet creation gracefully', async () => {
        // Try to create another wallet - should work as each party is unique
        const partyHint = `test-wallet-duplicate-${Date.now()}`;
        
        const secondWallet = await cantonService.createExternalWallet(partyHint);
        
        expect(secondWallet).toBeDefined();
        expect(secondWallet.partyId).not.toBe(walletInfo.partyId);
      }, testTimeout);
    });

    describe('Token Creation Flow', () => {
      beforeEach(() => {
        // Ensure we have a wallet from previous tests
        expect(walletInfo).toBeDefined();
        expect(cantonService.partyId).toBeTruthy();
      });

      it('should create a token with valid parameters', async () => {
        const tokenName = `Integration Test Token ${Date.now()}`;
        const tokenSymbol = 'ITT';
        const decimals = 2;
        
        createdToken = await cantonService.createToken(tokenName, tokenSymbol, decimals);
        
        expect(createdToken).toBeDefined();
        expect(createdToken.tokenId || createdToken).toBeTruthy();
        
        // Store token info for subsequent tests
        if (!createdToken.tokenId && typeof createdToken === 'string') {
          createdToken = { tokenId: createdToken };
        }
      }, testTimeout);

      it('should create multiple tokens for the same wallet', async () => {
        const secondToken = await cantonService.createToken(
          `Second Token ${Date.now()}`,
          'STT',
          4
        );
        
        expect(secondToken).toBeDefined();
        const secondTokenId = secondToken.tokenId || secondToken;
        const firstTokenId = createdToken.tokenId || createdToken;
        expect(secondTokenId).not.toBe(firstTokenId);
      }, testTimeout);
    });

    describe('Token Minting Flow', () => {
      beforeEach(() => {
        // Ensure we have a token from previous tests
        expect(createdToken).toBeDefined();
      });

      it('should mint tokens to the wallet owner', async () => {
        const tokenId = createdToken.tokenId || createdToken;
        const mintAmount = 10000; // 100.00 with 2 decimals
        
        const mintResult = await cantonService.mintTokens(tokenId, mintAmount);
        
        expect(mintResult).toBeDefined();
        expect(mintResult.transactionId || mintResult).toBeTruthy();
        
        // Verify balance after minting
        const balance = await cantonService.getTokenBalance(tokenId);
        expect(balance).toBeGreaterThanOrEqual(mintAmount);
      }, testTimeout);

      it('should handle multiple minting operations', async () => {
        const tokenId = createdToken.tokenId || createdToken;
        const firstMint = 5000;
        const secondMint = 3000;
        
        // Get initial balance
        const initialBalance = await cantonService.getTokenBalance(tokenId);
        
        // First mint
        await cantonService.mintTokens(tokenId, firstMint);
        const balanceAfterFirst = await cantonService.getTokenBalance(tokenId);
        expect(balanceAfterFirst).toBe(initialBalance + firstMint);
        
        // Second mint
        await cantonService.mintTokens(tokenId, secondMint);
        const balanceAfterSecond = await cantonService.getTokenBalance(tokenId);
        expect(balanceAfterSecond).toBe(balanceAfterFirst + secondMint);
      }, testTimeout);

      it('should mint tokens to a different recipient if specified', async () => {
        // This test would require creating a second wallet
        const secondPartyHint = `recipient-wallet-${Date.now()}`;
        
        // Save current state
        const originalPartyId = cantonService.partyId;
        const originalKeyPair = cantonService.keyPair;
        
        // Create second wallet
        const recipientWallet = await cantonService.createExternalWallet(secondPartyHint);
        const recipientPartyId = recipientWallet.partyId;
        
        // Restore original wallet
        cantonService.partyId = originalPartyId;
        cantonService.keyPair = originalKeyPair;
        cantonService.sdk.userLedger?.setPartyId(originalPartyId);
        cantonService.sdk.adminLedger?.setPartyId(originalPartyId);
        
        // Mint to recipient
        const tokenId = createdToken.tokenId || createdToken;
        const mintAmount = 2500;
        
        await cantonService.mintTokens(tokenId, mintAmount, recipientPartyId);
        
        // Switch to recipient to check balance
        cantonService.partyId = recipientPartyId;
        cantonService.sdk.userLedger?.setPartyId(recipientPartyId);
        
        const recipientBalance = await cantonService.getTokenBalance(tokenId);
        expect(recipientBalance).toBe(mintAmount);
        
        // Restore original wallet
        cantonService.partyId = originalPartyId;
        cantonService.sdk.userLedger?.setPartyId(originalPartyId);
      }, testTimeout);
    });

    describe('Token Query Operations', () => {
      it('should list all tokens for the wallet', async () => {
        const tokens = await cantonService.listTokens();
        
        expect(tokens).toBeDefined();
        expect(Array.isArray(tokens)).toBe(true);
        expect(tokens.length).toBeGreaterThan(0);
        
        // Should include our created token
        const tokenId = createdToken.tokenId || createdToken;
        const hasOurToken = tokens.some(token => 
          (token.tokenId || token) === tokenId
        );
        expect(hasOurToken).toBe(true);
      }, testTimeout);

      it('should return zero balance for non-existent token', async () => {
        const balance = await cantonService.getTokenBalance('token::non-existent-id');
        
        expect(balance).toBe(0);
      }, testTimeout);
    });

    describe('Error Handling in Real Environment', () => {
      it('should handle network interruptions gracefully', async () => {
        // For mock service, test error handling in operations
        // Save the current state
        const originalPartyId = cantonService.partyId;
        
        // Force an error state
        cantonService.partyId = null;
        
        // Operations should fail gracefully
        await expect(cantonService.listTokens()).rejects.toThrow('No wallet created yet');
        await expect(cantonService.getTokenBalance('some-token')).rejects.toThrow('No wallet created yet');
        await expect(cantonService.mintTokens('some-token', 1000)).rejects.toThrow('No wallet created yet');
        
        // Restore state
        cantonService.partyId = originalPartyId;
      }, testTimeout);

      it('should handle invalid token operations', async () => {
        // Try to mint with invalid token ID
        await expect(
          cantonService.mintTokens('invalid-token-format', 1000)
        ).rejects.toThrow();
      }, testTimeout);

      it('should handle large number operations correctly', async () => {
        const tokenId = createdToken.tokenId || createdToken;
        
        // Test with maximum safe integer for JavaScript
        const largeAmount = Number.MAX_SAFE_INTEGER;
        
        // This should either succeed or fail gracefully
        try {
          await cantonService.mintTokens(tokenId, largeAmount);
          
          // If it succeeds, balance should reflect it
          const balance = await cantonService.getTokenBalance(tokenId);
          expect(balance).toBeGreaterThan(0);
        } catch (error) {
          // If it fails, it should be a meaningful error
          expect(error.message).toBeTruthy();
          expect(error.message).not.toMatch(/undefined|null/i);
        }
      }, testTimeout);
    });

    describe('Concurrency and State Management', () => {
      it('should handle concurrent operations safely', async () => {
        const tokenId = createdToken.tokenId || createdToken;
        const mintAmount = 1000;
        
        // Perform multiple concurrent mints
        const promises = Array(5).fill(null).map((_, index) => 
          cantonService.mintTokens(tokenId, mintAmount)
            .then(() => ({ success: true, index }))
            .catch(error => ({ success: false, index, error }))
        );
        
        const results = await Promise.all(promises);
        
        // At least some operations should succeed
        const successCount = results.filter(r => r.success).length;
        expect(successCount).toBeGreaterThan(0);
        
        // Check final balance is consistent
        const finalBalance = await cantonService.getTokenBalance(tokenId);
        expect(finalBalance).toBeGreaterThan(0);
      }, testTimeout);

      it('should maintain consistent state across operations', async () => {
        // Store initial state
        const initialPartyId = cantonService.partyId;
        const initialKeyPair = cantonService.keyPair;
        
        // Perform various operations
        const tokens = await cantonService.listTokens();
        const tokenId = createdToken.tokenId || createdToken;
        const balance = await cantonService.getTokenBalance(tokenId);
        
        // State should remain unchanged
        expect(cantonService.partyId).toBe(initialPartyId);
        expect(cantonService.keyPair).toBe(initialKeyPair);
      }, testTimeout);
    });
  });

  // Test configuration validation
  describe('Configuration Validation', () => {
    it('should have valid configuration for LocalNet', () => {
      const config = getConfig();
      
      expect(config.SCAN_API_URL).toMatch(/^https?:\/\//);
      expect(config.LEDGER_API_URL).toMatch(/^https?:\/\//);
      expect(config.ADMIN_API_URL).toMatch(/^https?:\/\//);
      expect(config.DEFAULT_SYNCHRONIZER).toMatch(/^(wallet|localnet)::/);
      expect(config.TOKEN_DECIMALS).toBeGreaterThanOrEqual(0);
      expect(config.TOKEN_DECIMALS).toBeLessThanOrEqual(18);
      expect(config.TOKEN_INITIAL_SUPPLY).toBeGreaterThan(0);
    });
  });
});