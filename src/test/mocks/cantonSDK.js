import { vi } from 'vitest';

/**
 * Reusable Canton SDK mocks for unit testing
 * This provides a consistent mock interface across all unit tests
 */

// Create mock functions that can be easily configured per test
export const mockUserLedger = {
  setPartyId: vi.fn(),
  prepareSubmission: vi.fn(),
  executeSubmission: vi.fn(),
};

export const mockTopology = {
  prepareExternalPartyTopology: vi.fn(),
  submitExternalPartyTopology: vi.fn(),
};

export const mockTokenStandard = {
  setPartyId: vi.fn(),
  getBalance: vi.fn(),
  listTokens: vi.fn(),
  listHoldingUtxos: vi.fn(),
};

export const mockAdminLedger = {
  setPartyId: vi.fn(),
};

// Mock SDK implementation
export const mockSDKInstance = {
  configure: vi.fn().mockReturnThis(),
  connect: vi.fn().mockResolvedValue(true),
  connectAdmin: vi.fn().mockResolvedValue(true),
  connectTopology: vi.fn().mockResolvedValue(true),
  userLedger: mockUserLedger,
  adminLedger: mockAdminLedger,
  topology: mockTopology,
  tokenStandard: mockTokenStandard,
};

// Mock constructor
export const MockWalletSDKImpl = vi.fn().mockImplementation(() => mockSDKInstance);

// Helper function to reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();
  mockUserLedger.setPartyId.mockClear();
  mockUserLedger.prepareSubmission.mockClear();
  mockUserLedger.executeSubmission.mockClear();
  mockTopology.prepareExternalPartyTopology.mockClear();
  mockTopology.submitExternalPartyTopology.mockClear();
  mockTokenStandard.setPartyId.mockClear();
  mockTokenStandard.getBalance.mockClear();
  mockTokenStandard.listTokens.mockClear();
  mockTokenStandard.listHoldingUtxos.mockClear();
  mockAdminLedger.setPartyId.mockClear();
};

// Mock the entire Canton SDK module
export const mockCantonSDK = () => {
  vi.mock('@canton-network/wallet-sdk', () => ({
    WalletSDKImpl: MockWalletSDKImpl,
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
};

// Auto-apply the mock when this module is imported
mockCantonSDK();

// Helper functions for common test scenarios
export const mockSuccessfulWalletCreation = () => {
  const mockPreparedParty = {
    combinedHash: 'deadbeef',
    fingerprint: 'mock-fingerprint',
    partyId: 'party::mock-party-id',
  };

  mockTopology.prepareExternalPartyTopology.mockResolvedValue(mockPreparedParty);
  mockTopology.submitExternalPartyTopology.mockResolvedValue({
    partyId: mockPreparedParty.partyId,
  });

  return mockPreparedParty;
};

export const mockSuccessfulTokenCreation = () => {
  const mockPreparedTransaction = {
    preparedTransactionHash: 'hash123',
  };

  mockUserLedger.prepareSubmission.mockResolvedValue(mockPreparedTransaction);
  mockUserLedger.executeSubmission.mockResolvedValue({
    tokenId: 'token::created-token-id',
    transactionId: 'tx::123',
  });

  return mockPreparedTransaction;
};

export const mockSuccessfulTokenMinting = () => {
  const mockPreparedTransaction = {
    preparedTransactionHash: 'hash456',
  };

  mockUserLedger.prepareSubmission.mockResolvedValue(mockPreparedTransaction);
  mockUserLedger.executeSubmission.mockResolvedValue({
    transactionId: 'tx::mint-123',
    status: 'success',
  });

  return mockPreparedTransaction;
};

export const mockTokenBalance = (balance = 50000) => {
  mockTokenStandard.listHoldingUtxos.mockResolvedValue([
    { amount: balance }
  ]);
  return balance;
};

export const mockTokenList = (tokens = []) => {
  mockTokenStandard.listHoldingUtxos.mockResolvedValue(
    tokens.map(token => ({
      tokenId: token.tokenId,
      amount: token.amount || 1000,
    }))
  );
  return tokens;
};
