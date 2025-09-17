// Mock implementation of CantonService for integration tests without LocalNet
export class MockCantonService {
  constructor() {
    this.sdk = null;
    this.keyPair = null;
    this.partyId = null;
    this.config = {
      SCAN_API_URL: 'http://localhost:2000/api/scan',
      LEDGER_API_URL: 'http://localhost:2901',
      ADMIN_API_URL: 'http://localhost:2902',
      DEFAULT_SYNCHRONIZER: 'localnet::1220e7b23ea52eb5c672fb0b1cdbc916922ffed3dd7676c223a605664315e2d43edd',
      TOKEN_DECIMALS: 2,
      TOKEN_INITIAL_SUPPLY: 1000000,
    };
    this.walletCounter = 0;
    this.tokenCounter = 0;
    this.balances = new Map();
    this.tokens = new Map();
  }

  async initialize() {
    console.log('Mock Canton SDK initialized');
    this.sdk = {
      connect: async () => true,
      connectAdmin: async () => true,
      connectTopology: async () => true,
      userLedger: {
        setPartyId: () => {},
        prepareSubmission: async () => ({
          preparedTransactionHash: 'mock-tx-hash',
          transactionId: `tx-${Date.now()}`,
        }),
        executeSubmission: async () => ({
          transactionId: `tx-${Date.now()}`,
          status: 'success',
        }),
      },
      adminLedger: {
        setPartyId: () => {},
      },
      topology: {
        prepareExternalPartyTopology: async () => {
          this.walletCounter++;
          return {
            combinedHash: 'deadbeef',
            fingerprint: `fingerprint-${this.walletCounter}`,
            partyId: `party::wallet-${this.walletCounter}`,
          };
        },
        submitExternalPartyTopology: async (signedHash, preparedParty) => ({
          partyId: preparedParty.partyId,
        }),
      },
      tokenStandard: {
        getBalance: async (partyId, tokenId) => {
          const key = `${partyId}-${tokenId}`;
          return this.balances.get(key) || 0;
        },
        listTokens: async (partyId) => {
          return Array.from(this.tokens.values()).filter(t => t.owner === partyId);
        },
      },
    };
    return true;
  }

  async connectToNetwork() {
    console.log('Mock connected to Canton Network');
    return true;
  }

  async createExternalWallet(partyHint) {
    // Generate mock key pair
    this.keyPair = {
      publicKey: `mock-public-key-${Date.now()}`,
      privateKey: `mock-private-key-${Date.now()}`,
    };

    const preparedParty = await this.sdk.topology.prepareExternalPartyTopology();
    const allocatedParty = await this.sdk.topology.submitExternalPartyTopology(
      'mock-signed-hash',
      preparedParty
    );

    this.partyId = allocatedParty.partyId;
    this.sdk.userLedger.setPartyId(this.partyId);
    this.sdk.adminLedger.setPartyId(this.partyId);

    return {
      partyId: this.partyId,
      publicKey: this.keyPair.publicKey,
      fingerprint: preparedParty.fingerprint,
    };
  }

  async createToken(tokenName, tokenSymbol, decimals = 2) {
    if (!this.partyId) {
      throw new Error('No wallet created yet');
    }

    this.tokenCounter++;
    const tokenId = `token::${tokenSymbol}-${this.tokenCounter}`;
    
    this.tokens.set(tokenId, {
      tokenId,
      name: tokenName,
      symbol: tokenSymbol,
      decimals,
      owner: this.partyId,
    });

    return {
      tokenId,
      transactionId: `tx-create-${Date.now()}`,
    };
  }

  async mintTokens(tokenId, amount, recipient = null) {
    if (!this.partyId) {
      throw new Error('No wallet created yet');
    }

    // Validate token format
    if (!tokenId.startsWith('token::')) {
      throw new Error('Invalid token ID format');
    }

    const mintRecipient = recipient || this.partyId;
    const key = `${mintRecipient}-${tokenId}`;
    const currentBalance = this.balances.get(key) || 0;
    this.balances.set(key, currentBalance + amount);

    return {
      transactionId: `tx-mint-${Date.now()}`,
      status: 'success',
    };
  }

  async getTokenBalance(tokenId) {
    if (!this.partyId) {
      throw new Error('No wallet created yet');
    }

    return this.sdk.tokenStandard.getBalance(this.partyId, tokenId);
  }

  async listTokens() {
    if (!this.partyId) {
      throw new Error('No wallet created yet');
    }

    return this.sdk.tokenStandard.listTokens(this.partyId);
  }
}

export default new MockCantonService();