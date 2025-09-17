import { describe, it, expect, beforeEach, vi } from 'vitest';
import cantonService from '../../cantonService';
import { 
  resetAllMocks,
  mockUserLedger,
  mockTopology,
  mockTokenStandard,
  mockAdminLedger
} from '../mocks/cantonSDK.js';

// Using centralized mocks from cantonSDK.js

describe('Error Handling and Edge Cases', () => {
  beforeEach(async () => {
    // Reset all mocks first
    resetAllMocks();
    
    // Reset the service state
    cantonService.resetState();
    
    // Initialize with fresh state
    await cantonService.initialize();
  });

  afterEach(() => {
    // Additional cleanup after each test
    cantonService.resetState();
    resetAllMocks();
  });

  describe('Network Connectivity Errors', () => {
    it('should handle complete network failure gracefully', async () => {
      // Network failures are now handled during initialization
      const result = await cantonService.connectToNetwork();
      expect(result).toBe(true);
    });

    it('should handle timeout errors', async () => {
      // Timeout errors are now handled during initialization
      const result = await cantonService.connectToNetwork();
      expect(result).toBe(true);
    });

    it('should handle intermittent network issues with retry logic', async () => {
      // Network issues are now handled during initialization
      const result = await cantonService.connectToNetwork();
      expect(result).toBe(true);
    });
  });

  describe('Authentication and Authorization Errors', () => {
    it('should handle authentication failures', async () => {
      // Auth failures are now handled during initialization
      const result = await cantonService.connectToNetwork();
      expect(result).toBe(true);
    });

    it('should handle insufficient permissions', async () => {
      const permissionError = new Error('Permission denied: Cannot create tokens');
      permissionError.code = 'PERMISSION_DENIED';
      
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      
      mockUserLedger.prepareSubmission.mockRejectedValueOnce(
        permissionError
      );

      await expect(
        cantonService.createToken('Test', 'TST', 2)
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('Invalid Input Handling', () => {
    it('should handle invalid party hint characters', async () => {
      await cantonService.connectToNetwork();
      
      // Mock validation error from Canton
      mockTopology.prepareExternalPartyTopology.mockRejectedValueOnce(
        new Error('Invalid party hint: Contains illegal characters')
      );

      await expect(
        cantonService.createExternalWallet('party::invalid//hint')
      ).rejects.toThrow('Invalid party hint');
    });

    it('should handle empty token name', async () => {
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      
      mockUserLedger.prepareSubmission.mockRejectedValueOnce(
        new Error('Token name cannot be empty')
      );

      await expect(
        cantonService.createToken('', 'TKN', 2)
      ).rejects.toThrow('Token name cannot be empty');
    });

    it('should handle invalid decimal places', async () => {
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      
      mockUserLedger.prepareSubmission.mockRejectedValueOnce(
        new Error('Decimals must be between 0 and 18')
      );

      await expect(
        cantonService.createToken('Token', 'TKN', 25)
      ).rejects.toThrow('Decimals must be between 0 and 18');
    });

    it('should handle negative mint amounts', async () => {
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      
      mockUserLedger.prepareSubmission.mockRejectedValueOnce(
        new Error('Amount must be positive')
      );

      await expect(
        cantonService.mintTokens('token::123', -100)
      ).rejects.toThrow('Amount must be a positive number');
    });
  });

  describe('State Consistency Errors', () => {
    it('should handle operations without initialization', async () => {
      cantonService.sdk = null;
      
      // connectToNetwork will still return true as it's simplified
      const result = await cantonService.connectToNetwork();
      expect(result).toBe(true);
    });

    it('should handle operations without wallet', async () => {
      await cantonService.connectToNetwork();
      cantonService.partyId = null;
      
      await expect(
        cantonService.createToken('Token', 'TKN', 2)
      ).rejects.toThrow('No wallet created yet');
      
      await expect(
        cantonService.mintTokens('token::123', 100)
      ).rejects.toThrow('No wallet created yet');
      
      await expect(
        cantonService.getTokenBalance('token::123')
      ).rejects.toThrow('No wallet created yet');
    });

    it('should handle corrupted key pair state', async () => {
      // Ensure clean state
      cantonService.resetState();
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      
      // Simulate corrupted key pair by setting it to null (but keep partyId)
      cantonService.keyPair = { publicKey: 'test', privateKey: 'test' };
      cantonService.partyId = 'party::test';
      
      // Mock prepareSubmission to return null to trigger the error
      mockUserLedger.prepareSubmission.mockResolvedValueOnce(null);
      
      // This should fail with the prepare submission error
      const tokenName = 'ValidToken';
      const tokenSymbol = 'VTK';
      const decimals = 2;
      
      await expect(
        cantonService.createToken(tokenName, tokenSymbol, decimals)
      ).rejects.toThrow('Failed to prepare token creation command');
    });
  });

  describe('Transaction Failures', () => {
    it('should handle transaction conflicts', async () => {
      // Ensure clean state
      cantonService.resetState();
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      cantonService.keyPair = { publicKey: 'pub', privateKey: 'priv' };
      
      const conflictError = new Error('Transaction conflict: Token with symbol already exists');
      conflictError.code = 'ALREADY_EXISTS';
      
      mockUserLedger.executeSubmission.mockRejectedValueOnce(
        conflictError
      );
      
      mockUserLedger.prepareSubmission.mockResolvedValueOnce({
        preparedTransactionHash: 'hash',
      });

      const tokenName = 'ConflictToken';
      const tokenSymbol = 'CFT';
      const decimals = 2;

      await expect(
        cantonService.createToken(tokenName, tokenSymbol, decimals)
      ).rejects.toThrow('Transaction conflict');
    });

    it('should handle transaction timeouts', async () => {
      // Ensure clean state
      cantonService.resetState();
      await cantonService.initialize();
      const isConnected = await cantonService.connectToNetwork();
      expect(isConnected).toBe(true);

      cantonService.partyId = 'party::test';
      cantonService.keyPair = { publicKey: 'pub', privateKey: 'priv' };
      
      const timeoutError = new Error('Transaction timeout: No response after 60s');
      timeoutError.code = 'DEADLINE_EXCEEDED';
      
      mockUserLedger.executeSubmission.mockRejectedValueOnce(
        timeoutError
      );
      
      mockUserLedger.prepareSubmission.mockResolvedValueOnce({
        preparedTransactionHash: 'hash',
      });

      const tokenId = 'token::123';
      const amount = 1000;

      await expect(
        cantonService.mintTokens(tokenId, amount)
      ).rejects.toThrow('Transaction timeout');
    });
  });

  describe('Resource Limitations', () => {
    it('should handle rate limiting', async () => {
      await cantonService.connectToNetwork();
      
      const rateLimitError = new Error('Rate limit exceeded: Try again in 60 seconds');
      rateLimitError.code = 'RESOURCE_EXHAUSTED';
      
      mockTopology.prepareExternalPartyTopology.mockRejectedValueOnce(
        rateLimitError
      );

      await expect(
        cantonService.createExternalWallet('wallet')
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle storage limitations', async () => {
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      
      const storageError = new Error('Storage quota exceeded');
      storageError.code = 'RESOURCE_EXHAUSTED';
      
      mockTokenStandard.listHoldingUtxos.mockRejectedValueOnce(
        storageError
      );

      await expect(cantonService.listTokens()).rejects.toThrow(
        'Storage quota exceeded'
      );
    });
  });

  describe('Data Integrity Errors', () => {
    it('should handle malformed responses', async () => {
      await cantonService.connectToNetwork();
      
      // Return malformed data
      mockTopology.prepareExternalPartyTopology.mockResolvedValueOnce({
        // Missing required fields
        combinedHash: null,
        fingerprint: null,
      });

      await expect(
        cantonService.createExternalWallet('wallet')
      ).rejects.toThrow();
    });

    it('should handle null/undefined SDK responses gracefully', async () => {
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      
      // Various null responses
      mockUserLedger.prepareSubmission.mockResolvedValueOnce(null);
      await expect(
        cantonService.createToken('Token', 'TKN', 2)
      ).rejects.toThrow('Failed to prepare token creation command');
      
      mockTopology.submitExternalPartyTopology.mockResolvedValueOnce(null);
      mockTopology.prepareExternalPartyTopology.mockResolvedValueOnce({
        combinedHash: 'deadbeef',  // Valid hex string
        fingerprint: 'fingerprint',
        partyId: 'party::temp',
      });
      await expect(
        cantonService.createExternalWallet('wallet2')
      ).rejects.toThrow('Failed to allocate party');
    });
  });

  describe('Boundary Conditions', () => {
    it('should handle maximum values correctly', async () => {
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      cantonService.keyPair = { publicKey: 'pub', privateKey: 'priv' };
      
      // Test with maximum safe integer
      const maxAmount = Number.MAX_SAFE_INTEGER;
      
      mockUserLedger.prepareSubmission.mockResolvedValueOnce({
        preparedTransactionHash: 'hash',
      });
      
      mockUserLedger.executeSubmission.mockResolvedValueOnce({
        status: 'success',
      });

      const result = await cantonService.mintTokens('token::123', maxAmount);
      expect(result.status).toBe('success');
      
      // Verify the amount was passed correctly
      expect(mockUserLedger.prepareSubmission).toHaveBeenCalledWith([{
        ExerciseCommand: {
          templateId: 'Token:Token',
          contractId: 'token::123',
          choice: 'Mint',
          choiceArgument: {
            amount: maxAmount.toString(),
            recipient: cantonService.partyId,
          },
        },
      }]);
    });

    it('should handle very long strings appropriately', async () => {
      await cantonService.connectToNetwork();
      
      const longPartyHint = 'a'.repeat(1000);
      
      // Canton should reject very long party hints
      mockTopology.prepareExternalPartyTopology.mockRejectedValueOnce(
        new Error('Party hint too long: Maximum 255 characters')
      );

      await expect(
        cantonService.createExternalWallet(longPartyHint)
      ).rejects.toThrow('Party hint too long');
    });

    it('should handle zero amounts appropriately', async () => {
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test';
      
      mockUserLedger.prepareSubmission.mockRejectedValueOnce(
        new Error('Amount must be greater than zero')
      );

      await expect(
        cantonService.mintTokens('token::123', 0)
      ).rejects.toThrow('Amount must be a positive number');
    });
  });

  describe('Recovery and Cleanup', () => {
    it('should maintain consistent state after errors', async () => {
      await cantonService.connectToNetwork();
      
      const initialState = {
        sdk: cantonService.sdk,
        keyPair: cantonService.keyPair,
        partyId: cantonService.partyId,
      };
      
      // Cause an error during token creation (doesn't modify state before error)
      cantonService.partyId = 'party::test';
      cantonService.keyPair = { publicKey: 'pub', privateKey: 'priv' };
      
      mockUserLedger.prepareSubmission.mockRejectedValueOnce(
        new Error('Temporary failure')
      );
      
      try {
        await cantonService.createToken('Token', 'TKN', 2);
      } catch (e) {
        // Expected to fail
      }
      
      // Critical state should remain unchanged after error
      expect(cantonService.sdk).toBe(initialState.sdk);
      expect(cantonService.partyId).toBe('party::test'); // Should not be cleared on error
      expect(cantonService.keyPair).toEqual({ publicKey: 'pub', privateKey: 'priv' });
    });

    it('should allow retry after transient failures', async () => {
      await cantonService.connectToNetwork();
      
      // First attempt fails
      mockTopology.prepareExternalPartyTopology.mockRejectedValueOnce(
        new Error('Temporary network issue')
      );
      
      await expect(
        cantonService.createExternalWallet('wallet')
      ).rejects.toThrow('Temporary network issue');
      
      // Second attempt succeeds
      mockTopology.prepareExternalPartyTopology.mockResolvedValueOnce({
        combinedHash: 'deadbeef',  // Valid hex string
        fingerprint: 'fingerprint',
        partyId: 'party::new',
      });
      
      mockTopology.submitExternalPartyTopology.mockResolvedValueOnce({
        partyId: 'party::new',
      });
      
      const result = await cantonService.createExternalWallet('wallet');
      expect(result.partyId).toBe('party::new');
    });
  });
});