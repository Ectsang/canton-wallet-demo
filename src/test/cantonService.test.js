import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import cantonService from '../cantonService';
import { Buffer } from 'buffer';

// Mock the Canton SDK modules
vi.mock('@canton-network/wallet-sdk', () => ({
  WalletSDKImpl: vi.fn().mockImplementation(() => ({
    configure: vi.fn().mockReturnThis(),
    connect: vi.fn().mockResolvedValue(true),
    connectAdmin: vi.fn().mockResolvedValue(true),
    connectTopology: vi.fn().mockResolvedValue(true),
    userLedger: {
      setPartyId: vi.fn(),
      prepareSubmission: vi.fn(),
      executeSubmission: vi.fn(),
    },
    adminLedger: {
      setPartyId: vi.fn(),
    },
    topology: {
      prepareExternalPartyTopology: vi.fn(),
      submitExternalPartyTopology: vi.fn(),
    },
    tokenStandard: {
      getBalance: vi.fn(),
      listTokens: vi.fn(),
    },
  })),
  createKeyPair: vi.fn(() => ({
    publicKey: 'mock-public-key-' + Math.random().toString(36).substring(7),
    privateKey: 'mock-private-key-' + Math.random().toString(36).substring(7),
  })),
  signTransactionHash: vi.fn((hash, privateKey) => `signed-${hash}-with-${privateKey}`),
  localNetAuthDefault: {},
  localNetLedgerDefault: {},
  localNetTopologyDefault: {},
  localNetTokenStandardDefault: {},
}));

describe('CantonService', () => {
  beforeEach(() => {
    // Reset the service state before each test
    cantonService.sdk = null;
    cantonService.keyPair = null;
    cantonService.partyId = null;
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should successfully initialize the SDK', async () => {
      const result = await cantonService.initialize();
      
      expect(result).toBe(true);
      expect(cantonService.sdk).toBeTruthy();
      expect(cantonService.sdk.configure).toHaveBeenCalledWith({
        logger: console,
        authFactory: expect.any(Object),
        ledgerFactory: expect.any(Object),
        topologyFactory: expect.any(Object),
        tokenStandardFactory: expect.any(Object),
      });
    });

    it('should handle initialization errors gracefully', async () => {
      const mockError = new Error('SDK initialization failed');
      cantonService.sdk = null;
      
      // Force an error by making configure throw
      const { WalletSDKImpl } = await import('@canton-network/wallet-sdk');
      WalletSDKImpl.mockImplementationOnce(() => ({
        configure: vi.fn(() => {
          throw mockError;
        }),
      }));

      await expect(cantonService.initialize()).rejects.toThrow('SDK initialization failed');
    });
  });

  describe('connectToNetwork', () => {
    beforeEach(async () => {
      await cantonService.initialize();
    });

    it('should connect to all required services', async () => {
      const result = await cantonService.connectToNetwork();
      
      expect(result).toBe(true);
      expect(cantonService.sdk.connect).toHaveBeenCalled();
      expect(cantonService.sdk.connectAdmin).toHaveBeenCalled();
      expect(cantonService.sdk.connectTopology).toHaveBeenCalledWith(
        cantonService.config.SCAN_API_URL
      );
    });

    it('should handle connection failures', async () => {
      cantonService.sdk.connect.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(cantonService.connectToNetwork()).rejects.toThrow('Connection refused');
    });

    it('should handle partial connection failures', async () => {
      cantonService.sdk.connectAdmin.mockRejectedValueOnce(new Error('Admin connection failed'));

      await expect(cantonService.connectToNetwork()).rejects.toThrow('Admin connection failed');
      expect(cantonService.sdk.connect).toHaveBeenCalled();
    });
  });

  describe('createExternalWallet', () => {
    const mockPreparedParty = {
      combinedHash: 'deadbeef',
      fingerprint: 'mock-fingerprint',
      partyId: 'party::mock-party-id',
    };

    beforeEach(async () => {
      await cantonService.initialize();
      await cantonService.connectToNetwork();
      
      cantonService.sdk.topology.prepareExternalPartyTopology.mockResolvedValue(mockPreparedParty);
      cantonService.sdk.topology.submitExternalPartyTopology.mockResolvedValue({
        partyId: mockPreparedParty.partyId,
      });
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
      expect(cantonService.sdk.userLedger.setPartyId).toHaveBeenCalledWith(mockPreparedParty.partyId);
      expect(cantonService.sdk.adminLedger.setPartyId).toHaveBeenCalledWith(mockPreparedParty.partyId);
    });

    it('should handle topology preparation failure', async () => {
      cantonService.sdk.topology.prepareExternalPartyTopology.mockResolvedValueOnce(null);
      
      await expect(cantonService.createExternalWallet('test-wallet')).rejects.toThrow(
        'Failed to prepare external party'
      );
    });

    it('should handle party allocation failure', async () => {
      cantonService.sdk.topology.submitExternalPartyTopology.mockResolvedValueOnce(null);
      
      await expect(cantonService.createExternalWallet('test-wallet')).rejects.toThrow(
        'Failed to allocate party'
      );
    });

    it('should handle network errors during wallet creation', async () => {
      cantonService.sdk.topology.prepareExternalPartyTopology.mockRejectedValueOnce(
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
      
      cantonService.sdk.userLedger.prepareSubmission.mockResolvedValue(mockPreparedTransaction);
      cantonService.sdk.userLedger.executeSubmission.mockResolvedValue({
        tokenId: 'token::created-token-id',
        transactionId: 'tx::123',
      });
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
      
      // Verify command preparation
      expect(cantonService.sdk.userLedger.prepareSubmission).toHaveBeenCalledWith({
        tokenName,
        tokenSymbol,
        decimals,
        issuer: cantonService.partyId,
      });
      
      // Verify transaction signing and submission
      const { signTransactionHash } = await import('@canton-network/wallet-sdk');
      expect(signTransactionHash).toHaveBeenCalledWith(
        mockPreparedTransaction.preparedTransactionHash,
        cantonService.keyPair.privateKey
      );
      
      expect(cantonService.sdk.userLedger.executeSubmission).toHaveBeenCalledWith(
        mockPreparedTransaction,
        expect.stringMatching(/^signed-/),
        cantonService.keyPair.publicKey,
        expect.any(String)
      );
    });

    it('should fail if no wallet is created', async () => {
      cantonService.partyId = null;
      
      await expect(cantonService.createToken('Token', 'TKN', 2)).rejects.toThrow(
        'No wallet created yet'
      );
    });

    it('should handle token creation preparation failure', async () => {
      cantonService.sdk.userLedger.prepareSubmission.mockResolvedValueOnce(null);
      
      await expect(cantonService.createToken('Token', 'TKN', 2)).rejects.toThrow(
        'Failed to prepare token creation command'
      );
    });

    it('should handle token creation execution failure', async () => {
      cantonService.sdk.userLedger.executeSubmission.mockRejectedValueOnce(
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
      
      cantonService.sdk.userLedger.prepareSubmission.mockResolvedValue(mockPreparedTransaction);
      cantonService.sdk.userLedger.executeSubmission.mockResolvedValue({
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
      
      // Verify mint command
      expect(cantonService.sdk.userLedger.prepareSubmission).toHaveBeenCalledWith({
        tokenId: mockTokenId,
        amount,
        recipient: cantonService.partyId,
      });
    });

    it('should mint tokens to specified recipient', async () => {
      const amount = 500;
      const recipient = 'party::recipient-party-id';
      
      await cantonService.mintTokens(mockTokenId, amount, recipient);
      
      expect(cantonService.sdk.userLedger.prepareSubmission).toHaveBeenCalledWith({
        tokenId: mockTokenId,
        amount,
        recipient,
      });
    });

    it('should fail if no wallet is created', async () => {
      cantonService.partyId = null;
      
      await expect(cantonService.mintTokens(mockTokenId, 1000)).rejects.toThrow(
        'No wallet created yet'
      );
    });

    it('should handle mint preparation failure', async () => {
      cantonService.sdk.userLedger.prepareSubmission.mockResolvedValueOnce(null);
      
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
      
      cantonService.sdk.tokenStandard.getBalance.mockResolvedValueOnce(mockBalance);
      
      const balance = await cantonService.getTokenBalance(mockTokenId);
      
      expect(balance).toBe(mockBalance);
      expect(cantonService.sdk.tokenStandard.getBalance).toHaveBeenCalledWith(
        cantonService.partyId,
        mockTokenId
      );
    });

    it('should return 0 for non-existent balance', async () => {
      cantonService.sdk.tokenStandard.getBalance.mockResolvedValueOnce(null);
      
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
      const mockTokens = [
        { tokenId: 'token::token-1', name: 'Token 1', symbol: 'TK1' },
        { tokenId: 'token::token-2', name: 'Token 2', symbol: 'TK2' },
      ];
      
      cantonService.sdk.tokenStandard.listTokens.mockResolvedValueOnce(mockTokens);
      
      const tokens = await cantonService.listTokens();
      
      expect(tokens).toEqual(mockTokens);
      expect(cantonService.sdk.tokenStandard.listTokens).toHaveBeenCalledWith(
        cantonService.partyId
      );
    });

    it('should return empty array when no tokens exist', async () => {
      cantonService.sdk.tokenStandard.listTokens.mockResolvedValueOnce(null);
      
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