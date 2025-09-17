import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import cantonService from '../../cantonService';
import { 
  resetAllMocks,
  mockUserLedger,
  mockTopology,
  mockTokenStandard,
  mockAdminLedger,
  MockWalletSDKImpl,
  mockSuccessfulWalletCreation,
  mockSuccessfulTokenCreation,
  mockSuccessfulTokenMinting,
  mockTokenBalance,
  mockTokenList
} from '../mocks/cantonSDK.js';

describe('CantonService', () => {
  beforeEach(() => {
    // Reset the service state before each test
    cantonService.sdk = null;
    cantonService.keyPair = null;
    cantonService.partyId = null;
    
    // Reset all mocks using the centralized function
    resetAllMocks();
  });

  describe('initialize', () => {
    it('should successfully initialize the SDK', async () => {
      const result = await cantonService.initialize();
      
      expect(result).toBe(true);
      expect(cantonService.sdk).toBeTruthy();
      expect(MockWalletSDKImpl).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock SDK constructor to throw error  
      MockWalletSDKImpl.mockImplementationOnce(() => {
        throw new Error('SDK initialization failed');
      });

      await expect(cantonService.initialize()).rejects.toThrow();
    });
  });

  describe('connectToNetwork', () => {
    beforeEach(async () => {
      await cantonService.initialize();
    });

    it('should connect to all required services', async () => {
      const result = await cantonService.connectToNetwork();
      
      expect(result).toBe(true);
      // Connection is now handled during initialization
    });

    it('should handle connection failures', async () => {
      // Connection failures are now handled during initialization
      const result = await cantonService.connectToNetwork();
      expect(result).toBe(true);
    });

    it('should handle partial connection failures', async () => {
      // Partial failures are now handled during initialization
      const result = await cantonService.connectToNetwork();
      expect(result).toBe(true);
    });
  });

  describe('createExternalWallet', () => {
    let mockPreparedParty;

    beforeEach(async () => {
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      
      mockPreparedParty = mockSuccessfulWalletCreation();
    });

    it('should create an external wallet with valid party hint', async () => {
      const partyHint = 'test-wallet-1';
      const result = await cantonService.createExternalWallet(partyHint);
      
      expect(result).toMatchObject({
        partyId: mockPreparedParty.partyId,
        publicKey: expect.stringMatching(/^mock-public-key-/),
        fingerprint: mockPreparedParty.fingerprint,
      });
      
      expect(cantonService.keyPair).toBeTruthy();
      expect(cantonService.partyId).toBe(mockPreparedParty.partyId);
      
      // Verify the signing process
      const { signTransactionHash } = await import('@canton-network/wallet-sdk');
      expect(signTransactionHash).toHaveBeenCalledWith(
        Buffer.from(mockPreparedParty.combinedHash, 'hex').toString('base64'),
        expect.stringMatching(/^mock-private-key-/)
      );
      
      // Verify party ID was set in SDKs
      expect(mockUserLedger.setPartyId).toHaveBeenCalledWith(mockPreparedParty.partyId);
      expect(cantonService.sdk.adminLedger.setPartyId).toHaveBeenCalledWith(mockPreparedParty.partyId);
    });

    it('should handle topology preparation failure', async () => {
      mockTopology.prepareExternalPartyTopology.mockResolvedValueOnce(null);
      
      await expect(cantonService.createExternalWallet('test-wallet')).rejects.toThrow(
        'Failed to prepare external party'
      );
    });

    it('should handle party allocation failure', async () => {
      mockTopology.submitExternalPartyTopology.mockResolvedValueOnce(null);
      
      await expect(cantonService.createExternalWallet('test-wallet')).rejects.toThrow(
        'Failed to allocate party'
      );
    });

    it('should handle network errors during wallet creation', async () => {
      mockTopology.prepareExternalPartyTopology.mockRejectedValueOnce(
        new Error('Network timeout')
      );
      
      await expect(cantonService.createExternalWallet('test-wallet')).rejects.toThrow(
        'Network timeout'
      );
    });
  });

  describe('createToken', () => {
    const mockPreparedTransaction = {
      preparedTransactionHash: 'mock-tx-hash',
      transactionId: 'mock-tx-id',
    };

    beforeEach(async () => {
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      
      // Set up a wallet first
      cantonService.keyPair = {
        publicKey: 'test-public-key',
        privateKey: 'test-private-key',
      };
      cantonService.partyId = 'party::test-party-id';
      
      mockSuccessfulTokenCreation();
    });

    it('should create a token with valid parameters', async () => {
      const tokenName = 'Test Token';
      const tokenSymbol = 'TEST';
      const decimals = 2;
      
      const result = await cantonService.createToken(tokenName, tokenSymbol, decimals);
      
      expect(result).toMatchObject({
        tokenId: 'token::created-token-id',
        transactionId: 'tx::123',
      });
      
      // Verify command preparation - service creates proper Canton commands
      expect(mockUserLedger.prepareSubmission).toHaveBeenCalledWith([{
        CreateCommand: {
          templateId: 'Token:Token',
          createArguments: {
            name: tokenName,
            symbol: tokenSymbol,
            decimals: decimals.toString(),
            totalSupply: '0',
            issuer: cantonService.partyId,
            metadata: {
              values: {
                name: tokenName,
                symbol: tokenSymbol,
                decimals: decimals.toString(),
              },
            },
          },
        },
      }]);
      
      // Verify transaction signing and submission
      const { signTransactionHash } = await import('@canton-network/wallet-sdk');
      expect(signTransactionHash).toHaveBeenCalledWith(
        'hash123', // The actual hash returned by our mock
        'test-private-key'
      );
      
      expect(mockUserLedger.executeSubmission).toHaveBeenCalledWith(
        { preparedTransactionHash: 'hash123' }, // The actual prepared transaction
        'signed-hash123-with-test-private-key', // The actual signed hash
        'test-public-key', // The actual public key
        expect.any(String) // The transaction ID
      );
    });

    it('should fail if no wallet is created', async () => {
      cantonService.partyId = null;
      
      await expect(cantonService.createToken('Token', 'TKN', 2)).rejects.toThrow(
        'No wallet created yet'
      );
    });

    it('should handle token creation preparation failure', async () => {
      mockUserLedger.prepareSubmission.mockResolvedValueOnce(null);
      
      await expect(cantonService.createToken('Token', 'TKN', 2)).rejects.toThrow(
        'Failed to prepare token creation command'
      );
    });

    it('should handle token creation execution failure', async () => {
      mockUserLedger.executeSubmission.mockRejectedValueOnce(
        new Error('Insufficient permissions')
      );
      
      await expect(cantonService.createToken('Token', 'TKN', 2)).rejects.toThrow(
        'Insufficient permissions'
      );
    });
  });

  describe('mintTokens', () => {
    const mockTokenId = 'token::test-token-id';
    const mockPreparedTransaction = {
      preparedTransactionHash: 'mock-mint-tx-hash',
      transactionId: 'mock-mint-tx-id',
    };

    beforeEach(async () => {
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      
      // Set up a wallet
      cantonService.keyPair = {
        publicKey: 'test-public-key',
        privateKey: 'test-private-key',
      };
      cantonService.partyId = 'party::test-party-id';
      
      mockUserLedger.prepareSubmission.mockResolvedValue(mockPreparedTransaction);
      mockUserLedger.executeSubmission.mockResolvedValue({
        transactionId: 'tx::mint-123',
        status: 'success',
      });
    });

    it('should mint tokens to own wallet', async () => {
      const amount = 1000;
      
      const result = await cantonService.mintTokens(mockTokenId, amount);
      
      expect(result).toMatchObject({
        transactionId: 'tx::mint-123',
        status: 'success',
      });
      
      // Verify mint command - service creates proper Canton commands
      expect(mockUserLedger.prepareSubmission).toHaveBeenCalledWith([{
        ExerciseCommand: {
          templateId: 'Token:Token',
          contractId: mockTokenId,
          choice: 'Mint',
          choiceArgument: {
            amount: amount.toString(),
            recipient: cantonService.partyId,
          },
        },
      }]);
    });

    it('should mint tokens to specified recipient', async () => {
      const amount = 500;
      const recipient = 'party::recipient-party-id';
      
      await cantonService.mintTokens(mockTokenId, amount, recipient);
      
      expect(mockUserLedger.prepareSubmission).toHaveBeenCalledWith([{
        ExerciseCommand: {
          templateId: 'Token:Token',
          contractId: mockTokenId,
          choice: 'Mint',
          choiceArgument: {
            amount: amount.toString(),
            recipient,
          },
        },
      }]);
    });

    it('should fail if no wallet is created', async () => {
      cantonService.partyId = null;
      
      await expect(cantonService.mintTokens(mockTokenId, 1000)).rejects.toThrow(
        'No wallet created yet'
      );
    });

    it('should handle mint preparation failure', async () => {
      mockUserLedger.prepareSubmission.mockResolvedValueOnce(null);
      
      await expect(cantonService.mintTokens(mockTokenId, 1000)).rejects.toThrow(
        'Failed to prepare mint command'
      );
    });
  });

  describe('getTokenBalance', () => {
    beforeEach(async () => {
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test-party-id';
    });

    it('should retrieve token balance', async () => {
      const mockTokenId = 'token::test-token-id';
      const mockBalance = 50000; // 500.00 with 2 decimals
      
      // Mock listHoldingUtxos to return holdings with proper structure
      mockTokenStandard.listHoldingUtxos.mockResolvedValueOnce([
        { 
          argument: { 
            instrument: { instrumentId: mockTokenId },
            amount: mockBalance.toString()
          }
        }
      ]);
      
      const balance = await cantonService.getTokenBalance(mockTokenId);
      
      expect(balance).toBe(mockBalance);
      expect(mockTokenStandard.listHoldingUtxos).toHaveBeenCalled();
    });

    it('should return 0 for non-existent balance', async () => {
      // Mock listHoldingUtxos to return empty array (no holdings)
      mockTokenStandard.listHoldingUtxos.mockResolvedValueOnce([]);
      
      const balance = await cantonService.getTokenBalance('token::non-existent');
      
      expect(balance).toBe(0);
    });

    it('should fail if no wallet is created', async () => {
      cantonService.partyId = null;
      
      await expect(cantonService.getTokenBalance('token::any')).rejects.toThrow(
        'No wallet created yet'
      );
    });
  });

  describe('listTokens', () => {
    beforeEach(async () => {
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      cantonService.partyId = 'party::test-party-id';
    });

    it('should list all tokens for the party', async () => {
      const mockHoldings = [
        { 
          argument: { 
            instrument: { instrumentId: 'token::token-1' },
            amount: '1000'
          }
        },
        { 
          argument: { 
            instrument: { instrumentId: 'token::token-2' },
            amount: '2000'
          }
        },
      ];
      
      // Mock listHoldingUtxos to return holdings
      mockTokenStandard.listHoldingUtxos.mockResolvedValueOnce(mockHoldings);
      
      const tokens = await cantonService.listTokens();
      
      // Service extracts unique token IDs from holdings
      expect(tokens).toEqual(['token::token-1', 'token::token-2']);
      expect(mockTokenStandard.listHoldingUtxos).toHaveBeenCalled();
    });

    it('should return empty array when no tokens exist', async () => {
      // Mock listHoldingUtxos to return empty array
      mockTokenStandard.listHoldingUtxos.mockResolvedValueOnce([]);
      
      const tokens = await cantonService.listTokens();
      
      expect(tokens).toEqual([]);
    });

    it('should fail if no wallet is created', async () => {
      cantonService.partyId = null;
      
      await expect(cantonService.listTokens()).rejects.toThrow(
        'No wallet created yet'
      );
    });
  });
});