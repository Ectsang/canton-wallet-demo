/**
 * CN Quickstart gRPC Ledger Service
 * Uses @daml/ledger package for proper gRPC Ledger API access with authentication
 */

import damlLedgerPkg from '@daml/ledger';
const { Ledger } = damlLedgerPkg;
import { createHmac } from 'crypto';

class CNQuickstartGrpcService {
  constructor() {
    // CN Quickstart App Provider gRPC Ledger API
    this.ledgerHost = 'localhost';
    this.ledgerPort = 3901;
    this.ledgerId = 'PAR::participant::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad';

    // MinimalToken package ID (deployed to LocalNet)
    this.minimalTokenPackageId = 'd8325445c38031336b59afafaf5f01c83494e77884eab47baf3a6436e4be15f6';

    // App Provider party from LocalNet
    this.appProviderParty = 'app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad';

    this.client = null;

    console.log('🔧 CN Quickstart gRPC Ledger Service initialized', {
      host: this.ledgerHost,
      port: this.ledgerPort,
      party: this.appProviderParty.substring(0, 30) + '...'
    });
  }

  /**
   * Generate JWT token for CN Quickstart shared-secret auth
   */
  generateJWT(party) {
    const payload = {
      sub: party,
      aud: "https://canton.network.global"
    };

    console.log('🔑 Generating JWT for party:', party.substring(0, 30) + '...');

    // Create JWT with HMAC-SHA256 (matching jwt-cli behavior)
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', 'unsafe')
      .update(`${header}.${payloadB64}`)
      .digest('base64url');

    const token = `${header}.${payloadB64}.${signature}`;
    console.log('✅ JWT generated');

    return token;
  }

  /**
   * Initialize gRPC Ledger client
   */
  async initialize() {
    if (this.client) {
      return; // Already initialized
    }

    try {
      const token = this.generateJWT(this.appProviderParty);

      console.log('🔄 Connecting to Ledger API via gRPC...');

      this.client = new Ledger({
        token: token,
        httpBaseUrl: `http://${this.ledgerHost}:${this.ledgerPort}/`,
      });

      console.log('✅ Connected to Ledger API');

    } catch (error) {
      console.error('❌ Failed to initialize gRPC client:', error);
      throw error;
    }
  }

  /**
   * Create Instrument contract via gRPC Ledger API
   */
  async createInstrument({ name, symbol, decimals }) {
    try {
      await this.initialize();

      console.log('🔄 Creating Instrument contract via gRPC Ledger API...', {
        admin: this.appProviderParty.substring(0, 30) + '...',
        name,
        symbol,
        decimals,
        packageId: this.minimalTokenPackageId
      });

      const templateId = {
        packageId: this.minimalTokenPackageId,
        moduleName: 'MinimalToken',
        entityName: 'Instrument',
      };

      const createArguments = {
        admin: this.appProviderParty,
        name: name,
        symbol: symbol,
        decimals: decimals.toString(), // DAML Int as string
      };

      console.log('📋 Submitting create command...');

      const result = await this.client.create(
        this.appProviderParty,
        templateId,
        createArguments
      );

      console.log('✅ Instrument contract created!');
      console.log('✅ Contract ID:', result.contractId);

      return {
        success: true,
        contractId: result.contractId,
        admin: this.appProviderParty,
        name: name,
        symbol: symbol,
        decimals: parseInt(decimals, 10),
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Failed to create Instrument contract:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Mint tokens by exercising Issue choice
   */
  async mintTokens({ contractId, owner, amount }) {
    try {
      await this.initialize();

      console.log('🔄 Minting tokens via gRPC Ledger API...', {
        contractId,
        owner: owner.substring(0, 30) + '...',
        amount,
        admin: this.appProviderParty.substring(0, 30) + '...'
      });

      const templateId = {
        packageId: this.minimalTokenPackageId,
        moduleName: 'MinimalToken',
        entityName: 'Instrument',
      };

      const choiceArgument = {
        owner: owner,
        amount: amount.toString(), // DAML Decimal as string
      };

      console.log('📋 Exercising Issue choice...');

      const result = await this.client.exercise(
        this.appProviderParty,
        templateId,
        contractId,
        'Issue',
        choiceArgument
      );

      console.log('✅ Tokens minted successfully!');
      console.log('✅ Exercise result:', result);

      return {
        success: true,
        instrumentId: contractId,
        owner: owner,
        amount: parseFloat(amount),
        result: result,
        createdAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Failed to mint tokens:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Query active contracts for holdings
   */
  async queryHoldings({ owner, instrumentId }) {
    try {
      await this.initialize();

      console.log('🔍 Querying holdings via gRPC Ledger API...', {
        owner: owner.substring(0, 30) + '...',
        instrumentId
      });

      const templateId = {
        packageId: this.minimalTokenPackageId,
        moduleName: 'MinimalToken',
        entityName: 'Holding',
      };

      // Query active contracts
      const contracts = await this.client.query(templateId);

      console.log(`📋 Found ${contracts.length} total Holding contracts`);

      // Filter by owner and optionally by instrument
      const holdings = contracts
        .filter(c => c.payload.owner === owner)
        .filter(c => !instrumentId || c.payload.instrument === instrumentId)
        .map(c => ({
          contractId: c.contractId,
          owner: c.payload.owner,
          instrument: c.payload.instrument,
          amount: parseFloat(c.payload.amount)
        }));

      console.log(`✅ Found ${holdings.length} holdings for owner`);

      const totalBalance = holdings.reduce((sum, h) => sum + h.amount, 0);

      return {
        success: true,
        holdings: holdings,
        totalBalance: totalBalance,
        holdingCount: holdings.length
      };

    } catch (error) {
      console.error('❌ Failed to query holdings:', error);
      throw error;
    }
  }

  /**
   * Get App Provider party ID
   */
  getAppProviderParty() {
    return this.appProviderParty;
  }
}

export default CNQuickstartGrpcService;