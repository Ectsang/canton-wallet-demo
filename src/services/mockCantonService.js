/**
 * Mock Canton Service - For testing createdEvents extraction
 * Simulates successful Canton operations with proper response structures
 */

import { v4 as uuidv4 } from 'uuid';

class MockCantonService {
  constructor() {
    this.isConnected = true;
    this.partyId = null;
    // Mock storage for created contracts
    this.mockContracts = new Map();
    this.mockHoldings = new Map();
  }

  /**
   * Initialize the mock service
   */
  async initialize() {
    console.log('🔄 Initializing Mock Canton Service...');
    this.isConnected = true;
    console.log('✅ Mock Canton Service initialized');
    return true;
  }

  /**
   * Create external wallet - mock implementation
   */
  async createExternalWallet(partyHint = 'demo-wallet') {
    console.log('🔄 Creating mock external wallet...', { partyHint });
    
    // Generate mock party ID in Canton format
    const partyId = `1220e::1220${Math.random().toString(16).substring(2, 18)}`;
    
    // Generate mock keys
    const publicKey = `mock-public-${Math.random().toString(16).substring(2, 10)}`;
    const privateKey = `mock-private-${Math.random().toString(16).substring(2, 10)}`;
    const fingerprint = `mock-fp-${Math.random().toString(16).substring(2, 8)}`;
    
    const walletInfo = {
      partyId,
      publicKey,
      privateKey,
      fingerprint,
      partyHint,
      createdAt: new Date().toISOString()
    };
    
    console.log('✅ Mock external wallet created:', {
      partyId: walletInfo.partyId,
      fingerprint: walletInfo.fingerprint
    });
    
    return walletInfo;
  }

  /**
   * Create instrument - mock implementation with proper createdEvents structure
   */
  async createInstrument({ admin, name, symbol, decimals }) {
    console.log('🔄 Creating mock instrument...', { admin, name, symbol, decimals });
    
    // Generate mock contract ID in proper format (00xxx...)
    const contractId = `00${Math.random().toString(16).substring(2, 18)}`;
    const updateId = `1220${Math.random().toString(16).substring(2, 18)}`;
    
    // Store mock contract
    this.mockContracts.set(contractId, {
      contractId,
      admin,
      name,
      symbol,
      decimals,
      createdAt: new Date().toISOString()
    });
    
    // Simulate the completion result with createdEvents structure
    const mockCompletion = {
      updateId,
      // This is the key structure we're testing - createdEvents field
      createdEvents: [
        {
          contractId,
          templateId: `mock-package-id:MinimalToken:Instrument`,
          createArguments: { admin, name, symbol, decimals },
          createdAt: new Date().toISOString()
        }
      ],
      // Legacy events structure (fallback)
      events: [
        {
          created: {
            contractId,
            templateId: `mock-package-id:MinimalToken:Instrument`,
            createArguments: { admin, name, symbol, decimals }
          }
        }
      ]
    };
    
    console.log('✅ Mock instrument created with createdEvents structure:', {
      contractId,
      updateId,
      createdEventsCount: mockCompletion.createdEvents.length
    });
    
    return {
      success: true,
      contractId,
      updateId,
      admin,
      name,
      symbol,
      decimals,
      transactionId: updateId,
      createdAt: new Date().toISOString(),
      message: `Mock instrument contract created successfully with ID: ${contractId}`
    };
  }

  /**
   * Issue tokens - mock implementation with proper createdEvents structure
   */
  async issueTokens({ instrumentId, owner, amount, admin }) {
    console.log('🔄 Issuing mock tokens...', { instrumentId, owner, amount, admin });
    
    // Check if instrument exists
    if (!this.mockContracts.has(instrumentId)) {
      throw new Error(`Instrument contract not found: ${instrumentId}`);
    }
    
    // Generate mock holding contract ID
    const holdingId = `00${Math.random().toString(16).substring(2, 18)}`;
    const updateId = `1220${Math.random().toString(16).substring(2, 18)}`;
    
    // Store mock holding
    this.mockHoldings.set(holdingId, {
      contractId: holdingId,
      owner,
      instrumentId,
      amount,
      createdAt: new Date().toISOString()
    });
    
    // Simulate the completion result with createdEvents structure
    const mockCompletion = {
      updateId,
      // This is the key structure we're testing - createdEvents field
      createdEvents: [
        {
          contractId: holdingId,
          templateId: `mock-package-id:MinimalToken:Holding`,
          createArguments: { owner, instrumentId, amount },
          createdAt: new Date().toISOString()
        }
      ],
      // Legacy events structure (fallback)
      events: [
        {
          created: {
            contractId: holdingId,
            templateId: `mock-package-id:MinimalToken:Holding`,
            createArguments: { owner, instrumentId, amount }
          }
        }
      ]
    };
    
    console.log('✅ Mock tokens issued with createdEvents structure:', {
      holdingId,
      updateId,
      amount,
      createdEventsCount: mockCompletion.createdEvents.length
    });
    
    return {
      success: true,
      contractId: holdingId,
      holdingId,
      instrumentId,
      owner,
      amount,
      admin,
      transactionId: updateId,
      createdAt: new Date().toISOString(),
      message: `Mock tokens issued successfully with holding ID: ${holdingId}`
    };
  }

  /**
   * Get balance - mock implementation
   */
  async getBalance(partyId, instrumentId) {
    console.log('🔄 Getting mock balance...', { partyId, instrumentId });
    
    // Calculate mock balance from holdings
    let totalBalance = 0;
    let holdingCount = 0;
    
    for (const [holdingId, holding] of this.mockHoldings) {
      if (holding.owner === partyId && holding.instrumentId === instrumentId) {
        totalBalance += parseFloat(holding.amount);
        holdingCount++;
      }
    }
    
    console.log('✅ Mock balance calculated:', { totalBalance, holdingCount });
    
    return {
      balance: totalBalance,
      holdingCount,
      partyId,
      instrumentId
    };
  }

  /**
   * List holdings - mock implementation
   */
  async listHoldings(partyId) {
    console.log('🔄 Listing mock holdings...', { partyId });
    
    const holdings = [];
    for (const [holdingId, holding] of this.mockHoldings) {
      if (holding.owner === partyId) {
        holdings.push(holding);
      }
    }
    
    console.log('✅ Mock holdings listed:', { count: holdings.length });
    return holdings;
  }

  /**
   * List instruments - mock implementation
   */
  listInstruments() {
    console.log('🔄 Listing mock instruments...');
    const instruments = Array.from(this.mockContracts.values());
    console.log('✅ Mock instruments listed:', { count: instruments.length });
    return instruments;
  }

  /**
   * Get instrument - mock implementation
   */
  async getInstrument(contractId) {
    console.log('🔄 Getting mock instrument...', { contractId });
    
    const instrument = this.mockContracts.get(contractId);
    if (!instrument) {
      throw new Error(`Instrument not found: ${contractId}`);
    }
    
    console.log('✅ Mock instrument found:', instrument);
    return instrument;
  }

  /**
   * Set party ID
   */
  setPartyId(partyId) {
    this.partyId = partyId;
    console.log('✅ Mock service party ID set:', partyId);
  }

  /**
   * Test connection - always succeeds for mock
   */
  async testConnection() {
    return {
      connected: true,
      mockService: true,
      contractCount: this.mockContracts.size,
      holdingCount: this.mockHoldings.size,
      timestamp: new Date().toISOString()
    };
  }
}

export default MockCantonService;
