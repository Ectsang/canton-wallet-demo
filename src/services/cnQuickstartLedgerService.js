/**
 * CN Quickstart Ledger API Service
 * Direct JSON Ledger API integration for custom DAML contracts
 *
 * Uses App Provider party and authentication from CN Quickstart LocalNet
 * Located at: /Users/e/code/sbc/canton/cn-quickstart/quickstart
 */

import { createHmac } from 'crypto';

class CNQuickstartLedgerService {
  constructor() {
    // CN Quickstart App Provider endpoints
    this.jsonApiUrl = 'http://localhost:3975';  // App Provider JSON API
    this.ledgerId = 'PAR::participant::1220975d30b6a9c9a03f8ec9e9e851c08cc51da86d2b2a32d8a45e54d731c1da819f';

    // MinimalToken package ID (deployed to LocalNet)
    this.minimalTokenPackageId = 'd8325445c38031336b59afafaf5f01c83494e77884eab47baf3a6436e4be15f6';

    // App Provider party from LocalNet
    // This is the party with admin rights on App Provider participant
    this.appProviderParty = 'app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad';

    console.log('🔧 CN Quickstart Ledger Service initialized', {
      jsonApiUrl: this.jsonApiUrl,
      ledgerId: this.ledgerId.substring(0, 50) + '...'
    });
  }

  /**
   * Initialize by fetching App Provider party from CN Quickstart backend
   */
  async initialize() {
    if (this.appProviderParty) {
      return; // Already initialized
    }

    try {
      // Option 1: Get from CN Quickstart backend API
      const response = await fetch('http://localhost:8080/admin/tenant-registrations', {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Tenant registrations:', data);

        // Extract App Provider party from tenant registrations
        // This is the party that has admin rights
        if (Array.isArray(data) && data.length > 0) {
          this.appProviderParty = data[0].party;
          console.log('✅ Got App Provider party:', this.appProviderParty);
          return;
        }
      }

      // Option 2: Use environment variable
      if (process.env.APP_PROVIDER_PARTY) {
        this.appProviderParty = process.env.APP_PROVIDER_PARTY;
        console.log('✅ Using APP_PROVIDER_PARTY from env:', this.appProviderParty);
        return;
      }

      // Option 3: Use shared volume file (if running in Docker)
      // This is set by splice-onboarding service
      throw new Error('Could not determine App Provider party. Set APP_PROVIDER_PARTY environment variable.');

    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Generate JWT token for CN Quickstart shared-secret auth
   *
   * CN Quickstart uses HMAC-SHA256 with secret "unsafe" for LocalNet
   * Format matches jwt-cli encode: {"sub": "party", "aud": "audience"}
   */
  generateJWT(party) {
    const payload = {
      sub: party,
      aud: "https://canton.network.global"
    };

    console.log('🔑 Generating JWT for party:', party);
    console.log('🔍 JWT payload:', JSON.stringify(payload, null, 2));

    // Create JWT with HMAC-SHA256 (matching jwt-cli behavior)
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', 'unsafe')
      .update(`${header}.${payloadB64}`)
      .digest('base64url');

    const token = `${header}.${payloadB64}.${signature}`;
    console.log('✅ JWT generated:', token.substring(0, 50) + '...');

    return token;
  }

  /**
   * Create Instrument contract via JSON Ledger API v2
   *
   * Uses submit-and-wait-for-transaction endpoint which returns events
   */
  async createInstrument({ name, symbol, decimals }) {
    try {
      await this.initialize();

      console.log('🔄 Creating Instrument contract via JSON Ledger API v2...', {
        admin: this.appProviderParty,
        name,
        symbol,
        decimals,
        packageId: this.minimalTokenPackageId
      });

      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      const commandId = `create-instrument-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Generate JWT for App Provider party
      const token = this.generateJWT(this.appProviderParty);

      // JSON Ledger API v2 format
      const request = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [this.appProviderParty],
          commands: [{
            CreateCommand: {
              templateId: templateId,
              createArguments: {
                admin: this.appProviderParty,
                name: name,
                symbol: symbol,
                decimals: parseInt(decimals, 10)
              }
            }
          }]
        }
      };

      console.log('📋 Request to JSON API:', JSON.stringify(request, null, 2));

      const response = await fetch(`${this.jsonApiUrl}/v2/commands/submit-and-wait-for-transaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const responseText = await response.text();
      console.log('📋 Response status:', response.status);
      console.log('📋 Response body:', responseText);

      if (!response.ok) {
        throw new Error(`JSON Ledger API failed: ${response.status} - ${responseText}`);
      }

      const result = JSON.parse(responseText);

      // Extract contract ID from created events
      if (result?.result?.events && result.result.events.length > 0) {
        const createdEvent = result.result.events.find(e => e.created);

        if (createdEvent && createdEvent.created) {
          const contractId = createdEvent.created.contractId;
          console.log('✅ Instrument contract created successfully!');
          console.log('✅ Contract ID:', contractId);

          return {
            success: true,
            contractId: contractId,
            admin: this.appProviderParty,
            name: name,
            symbol: symbol,
            decimals: parseInt(decimals, 10),
            transactionId: result.result.transactionId || commandId,
            createdAt: new Date().toISOString()
          };
        }
      }

      throw new Error('No created event found in response');

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
   *
   * @param {string} contractId - Instrument contract ID (from createInstrument)
   * @param {string} owner - External wallet party ID
   * @param {string|number} amount - Amount to mint
   */
  async mintTokens({ contractId, owner, amount }) {
    try {
      await this.initialize();

      console.log('🔄 Minting tokens via JSON Ledger API v2...', {
        contractId,
        owner,
        amount,
        admin: this.appProviderParty
      });

      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      const commandId = `mint-tokens-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Generate JWT for App Provider party (admin exercises Issue choice)
      const token = this.generateJWT(this.appProviderParty);

      // JSON Ledger API v2 format
      const request = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [this.appProviderParty],  // Admin party exercises choice
          commands: [{
            ExerciseCommand: {
              templateId: templateId,
              contractId: contractId,
              choice: 'Issue',
              choiceArgument: {
                owner: owner,
                amount: amount.toString()  // DAML Decimal as string
              }
            }
          }]
        }
      };

      console.log('📋 Mint request to JSON API:', JSON.stringify(request, null, 2));

      const response = await fetch(`${this.jsonApiUrl}/v2/commands/submit-and-wait-for-transaction`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const responseText = await response.text();
      console.log('📋 Mint response status:', response.status);
      console.log('📋 Mint response body:', responseText);

      if (!response.ok) {
        throw new Error(`Mint failed: ${response.status} - ${responseText}`);
      }

      const result = JSON.parse(responseText);

      // Extract Holding contract ID from created events
      if (result?.result?.events && result.result.events.length > 0) {
        const createdEvent = result.result.events.find(e => e.created);

        if (createdEvent && createdEvent.created) {
          const holdingId = createdEvent.created.contractId;
          console.log('✅ Tokens minted successfully!');
          console.log('✅ Holding contract ID:', holdingId);

          return {
            success: true,
            holdingId: holdingId,
            instrumentId: contractId,
            owner: owner,
            amount: parseFloat(amount),
            transactionId: result.result.transactionId || commandId,
            createdAt: new Date().toISOString()
          };
        }
      }

      throw new Error('No created Holding contract found in response');

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
   * Query active contracts (for balance checks)
   *
   * @param {string} owner - Party ID to query holdings for
   * @param {string} [instrumentId] - Optional instrument contract ID filter
   */
  async queryHoldings({ owner, instrumentId }) {
    try {
      await this.initialize();

      console.log('🔍 Querying holdings via JSON Ledger API v2...', { owner, instrumentId });

      const holdingTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Holding`;

      // Generate JWT for the owner party (to see their holdings)
      const token = this.generateJWT(owner);

      // JSON Ledger API v2 query format
      const request = {
        templateIds: [holdingTemplateId]
      };

      console.log('📋 Query request:', JSON.stringify(request, null, 2));

      const response = await fetch(`${this.jsonApiUrl}/v2/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const responseText = await response.text();
      console.log('📋 Query response status:', response.status);
      console.log('📋 Query response body:', responseText);

      if (!response.ok) {
        throw new Error(`Query failed: ${response.status} - ${responseText}`);
      }

      const result = JSON.parse(responseText);

      // Parse holdings from result
      const holdings = [];
      if (result?.result && Array.isArray(result.result)) {
        for (const contract of result.result) {
          if (contract.payload) {
            // Filter by instrument if specified
            if (!instrumentId || contract.payload.instrument === instrumentId) {
              holdings.push({
                contractId: contract.contractId,
                owner: contract.payload.owner,
                instrument: contract.payload.instrument,
                amount: parseFloat(contract.payload.amount)
              });
            }
          }
        }
      }

      console.log(`✅ Found ${holdings.length} holdings for owner ${owner}`);

      // Calculate total balance
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
   * Get App Provider party ID (after initialization)
   */
  getAppProviderParty() {
    return this.appProviderParty;
  }
}

export default CNQuickstartLedgerService;