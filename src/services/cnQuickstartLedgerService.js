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
    this.jsonApiUrl = 'http://localhost:3975';  // App Provider JSON API (prefix 3 + suffix 975)

    // App Provider participant ID - get from logs with: docker logs canton 2>&1 | grep "PAR::participant::1220a57d9319"
    this.participantId = 'PAR::participant::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad';

    // For backward compatibility (some APIs use ledgerId)
    this.ledgerId = this.participantId;

    // MinimalToken package ID from DAR manifest
    // Using minimal-token-autoaccept v2.1.0 package with both signatories pattern (Holding: signatory admin, owner)
    this.minimalTokenPackageId = 'c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d';

    // App Provider party from LocalNet (PARTY_HINT=quickstart-e-1)
    // This is the party with admin rights on App Provider participant
    this.appProviderParty = 'app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad';

    // Timeout for JSON API calls (30 seconds)
    this.timeout = 30000;

    console.log('🔧 CN Quickstart Ledger Service initialized', {
      jsonApiUrl: this.jsonApiUrl,
      participantId: this.participantId.substring(0, 50) + '...',
      appProviderParty: this.appProviderParty.substring(0, 50) + '...',
      packageId: this.minimalTokenPackageId,
      timeout: `${this.timeout}ms`
    });
  }

  /**
   * Fetch with timeout support
   * @private
   */
  async fetchWithTimeout(url, options = {}, timeoutMs = this.timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
      }
      throw error;
    }
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
   *
   * @param {string|string[]} parties - Party ID(s) to act as
   * @param {string|string[]} readAsParties - Party ID(s) to read as (for observer access)
   */
  generateJWT(parties, readAsParties = null) {
    const now = Math.floor(Date.now() / 1000);
    const actAsArray = Array.isArray(parties) ? parties : [parties];
    const payload = {
      sub: "ledger-api-user",  // User ID from AUTH_APP_PROVIDER_VALIDATOR_USER_NAME
      aud: "https://canton.network.global",
      actAs: actAsArray,  // Party/parties go in actAs array
      exp: now + 3600,  // Expires in 1 hour
      iat: now  // Issued at
    };

    // Add readAs for observer access to contracts
    if (readAsParties) {
      const readAsArray = Array.isArray(readAsParties) ? readAsParties : [readAsParties];
      payload.readAs = readAsArray;
    }

    console.log('🔑 Generating JWT for parties:', actAsArray);
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

      // Validate inputs
      if (!name || typeof name !== 'string') {
        throw new Error(`Invalid token name: ${name}`);
      }
      if (!symbol || typeof symbol !== 'string') {
        throw new Error(`Invalid token symbol: ${symbol}`);
      }
      const decimalsInt = parseInt(decimals, 10);
      if (isNaN(decimalsInt) || decimalsInt < 0 || decimalsInt > 18) {
        throw new Error(`Invalid decimals: ${decimals}. Must be integer 0-18.`);
      }

      console.log('🔄 Creating Instrument contract via JSON Ledger API v2...', {
        admin: this.appProviderParty,
        name,
        symbol,
        decimals: decimalsInt,
        packageId: this.minimalTokenPackageId,
        jsonApiUrl: this.jsonApiUrl
      });

      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      const commandId = `create-instrument-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      console.log('📋 Template ID:', templateId);
      console.log('📋 Command ID:', commandId);

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

      const response = await this.fetchWithTimeout(
        `${this.jsonApiUrl}/v2/commands/submit-and-wait-for-transaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        }
      );

      const responseText = await response.text();
      console.log('📋 Response status:', response.status);
      console.log('📋 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
      console.log('📋 Response body:', responseText);

      if (!response.ok) {
        console.error('❌ JSON Ledger API request failed');
        console.error('❌ Request was:', JSON.stringify(request, null, 2));
        console.error('❌ URL was:', `${this.jsonApiUrl}/v2/commands/submit-and-wait-for-transaction`);
        throw new Error(`JSON Ledger API failed: ${response.status} - ${responseText}`);
      }

      const result = JSON.parse(responseText);

      console.log('🔍 Full parsed result structure:', JSON.stringify(result, null, 2));
      console.log('🔍 Result keys:', Object.keys(result || {}));

      // Extract contract ID from created events
      // Canton JSON Ledger API v2 returns events under 'transaction' key
      if (result?.transaction?.events && result.transaction.events.length > 0) {
        console.log(`🔍 Found ${result.transaction.events.length} events in response`);
        const createdEvent = result.transaction.events.find(e => e.CreatedEvent);

        if (createdEvent && createdEvent.CreatedEvent) {
          const contractId = createdEvent.CreatedEvent.contractId;
          console.log('✅ Instrument contract created successfully!');
          console.log('✅ Contract ID:', contractId);

          return {
            success: true,
            contractId: contractId,
            admin: this.appProviderParty,
            name: name,
            symbol: symbol,
            decimals: parseInt(decimals, 10),
            transactionId: result.transaction.updateId || result.transaction.commandId,
            createdAt: new Date().toISOString()
          };
        } else {
          console.error('❌ No created event found. Events structure:', JSON.stringify(result.transaction.events, null, 2));
        }
      } else {
        console.error('❌ No events in result. Result structure:', JSON.stringify(result, null, 2));
      }

      throw new Error('No created event found in response. Check logs for response structure.');

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
   * Mint tokens by exercising IssueAndAccept choice (auto-accept pattern)
   *
   * @param {string} contractId - Instrument contract ID (from createInstrument)
   * @param {string} owner - External wallet party ID
   * @param {string|number} amount - Amount to mint
   */
  async mintTokens({ contractId, owner, amount }) {
    try {
      await this.initialize();

      console.log('🔄 Minting tokens via Issue choice (cross-participant) via JSON Ledger API v2...', {
        contractId,
        owner,
        amount,
        admin: this.appProviderParty
      });

      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      const commandId = `mint-tokens-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Generate JWT for admin only (Issue choice only requires admin authorization)
      const token = this.generateJWT([this.appProviderParty]);

      // JSON Ledger API v2 format
      const request = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [this.appProviderParty],  // Only admin - Issue choice has controller admin
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

      const response = await this.fetchWithTimeout(
        `${this.jsonApiUrl}/v2/commands/submit-and-wait-for-transaction`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request)
        }
      );

      const responseText = await response.text();
      console.log('📋 Mint response status:', response.status);
      console.log('📋 Mint response body:', responseText);

      if (!response.ok) {
        throw new Error(`Mint failed: ${response.status} - ${responseText}`);
      }

      const result = JSON.parse(responseText);

      console.log('🔍 Full mint result structure:', JSON.stringify(result, null, 2));
      console.log('🔍 Mint result keys:', Object.keys(result || {}));

      // Extract Holding contract ID from created events (auto-accepted)
      // Canton JSON Ledger API v2 returns events under 'transaction' key
      if (result?.transaction?.events && result.transaction.events.length > 0) {
        console.log(`🔍 Found ${result.transaction.events.length} events in mint response`);
        const createdEvent = result.transaction.events.find(e => e.CreatedEvent);

        if (createdEvent && createdEvent.CreatedEvent) {
          const proposalId = createdEvent.CreatedEvent.contractId;
          console.log('✅ HoldingProposal created successfully via Issue choice!');
          console.log('✅ Proposal contract ID:', proposalId);

          return {
            success: true,
            proposalId: proposalId,  // HoldingProposal ID (needs Accept)
            instrumentId: contractId,
            owner: owner,
            amount: parseFloat(amount),
            transactionId: result.transaction.updateId || result.transaction.commandId,
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
   * Accept a HoldingProposal to create a Holding contract
   * Owner exercises the Accept choice on HoldingProposal
   *
   * @param {string} proposalId - HoldingProposal contract ID to accept
   * @param {string} owner - Party ID of the owner (must be authorized to accept)
   */
  async acceptProposal({ proposalId, owner }) {
    try {
      await this.initialize();

      console.log('🔄 Accepting holding proposal via JSON Ledger API v2...', {
        proposalId,
        owner
      });

      const proposalTemplateId = `${this.minimalTokenPackageId}:MinimalToken:HoldingProposal`;
      const commandId = `accept-proposal-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // For cross-participant Accept, owner exercises on their own participant
      // HoldingProposal has signatory admin, observer owner - Canton automatically shares to owner's participant
      const token = this.generateJWT([owner], [this.appProviderParty]);

      // Determine which participant the owner is on and use their JSON API
      const isAppProviderParty = owner.startsWith('app_provider');
      const apiUrl = isAppProviderParty
        ? 'http://localhost:3975'  // app-provider JSON API
        : 'http://localhost:2975'; // app-user JSON API (for demo-wallet-X)

      console.log(`📍 Using ${isAppProviderParty ? 'app-provider' : 'app-user'} JSON API for owner: ${owner}`);

      const exerciseCommand = {
        templateId: proposalTemplateId,
        contractId: proposalId,
        choice: 'Accept',
        choiceArgument: {}  // Accept choice takes no arguments (JSON API uses choiceArgument not argument)
      };

      const requestBody = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [owner],
          readAs: [this.appProviderParty],  // Admin readAs to see HoldingProposal
          commands: [{
            ExerciseCommand: exerciseCommand
          }]
        }
      };

      console.log('📋 Exercise Accept command:', JSON.stringify(requestBody, null, 2));

      const response = await this.fetchWithTimeout(
        `${apiUrl}/v2/commands/submit-and-wait-for-transaction`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        },
        30000  // 30 second timeout for command submission
      );

      // Log raw response for debugging
      const responseText = await response.text();
      console.log('📥 Raw Accept response:', responseText);
      console.log('📥 Response status:', response.status);

      const result = JSON.parse(responseText);

      console.log('📥 Accept command response:', JSON.stringify(result, null, 2));

      // Extract Holding contract ID from created events
      if (result?.transaction?.events && result.transaction.events.length > 0) {
        console.log(`🔍 Found ${result.transaction.events.length} events in accept response`);
        const createdEvent = result.transaction.events.find(e => e.CreatedEvent);

        if (createdEvent && createdEvent.CreatedEvent) {
          const holdingId = createdEvent.CreatedEvent.contractId;
          const createArg = createdEvent.CreatedEvent.createArgument || {};

          console.log('✅ Holding created successfully from accepted proposal!');
          console.log('✅ Holding contract ID:', holdingId);
          console.log('✅ Holding payload:', JSON.stringify(createArg, null, 2));

          return {
            success: true,
            holdingId: holdingId,
            proposalId: proposalId,
            owner: createArg.owner || owner,
            amount: parseFloat(createArg.amount || 0),
            instrumentId: createArg.instrument || null,
            transactionId: result.transaction.updateId || result.transaction.commandId,
            createdAt: new Date().toISOString()
          };
        }
      }

      throw new Error('No created Holding contract found in response');

    } catch (error) {
      console.error('❌ Failed to accept proposal:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Query holdings using /v2/state/active-contracts endpoint
   * Observer access: admin is actAs, owner is readAs
   *
   * @param {string} owner - Party ID to query holdings for (observer)
   * @param {string} [instrumentId] - Optional instrument contract ID filter
   */
  async queryHoldings({ owner, instrumentId }) {
    try {
      await this.initialize();

      console.log('🔍 Querying active holdings via JSON API /v2/state/active-contracts...', { owner, instrumentId });

      // Query for Holdings across ALL deployed package versions
      // v2.0.0: eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de
      // v2.0.1: 2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118
      // v2.1.0: c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d
      const allPackageIds = [
        'c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d', // v2.1.0 (current)
        '2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118', // v2.0.1
        'eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de'  // v2.0.0
      ];

      const holdingTemplateIds = allPackageIds.map(pkgId => `${pkgId}:MinimalToken:Holding`);

      // Query app-user participant (where external wallet owner is registered)
      const apiUrl = 'http://localhost:2975';  // app-user JSON API (not app-provider)

      // Generate JWT: actAs owner
      const token = this.generateJWT(owner);

      const requestBody = {
        filter: {
          filtersByParty: {
            [owner]: {  // Query for contracts visible to owner
              inclusive: holdingTemplateIds.map(tid => ({ templateId: tid }))
            }
          }
        },
        verbose: true,  // Required field
        activeAtOffset: 0  // Query from beginning of ledger (0 = participant's begin offset)
      };

      console.log('📋 Active contracts request:', JSON.stringify(requestBody, null, 2));

      const response = await this.fetchWithTimeout(
        `${apiUrl}/v2/state/active-contracts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        },
        10000
      );

      const responseText = await response.text();
      console.log('📋 Active contracts response status:', response.status);
      console.log('📋 Response (first 1000 chars):', responseText.substring(0, 1000));

      if (!response.ok) {
        throw new Error(`Active contracts query failed: ${response.status} - ${responseText}`);
      }

      const result = JSON.parse(responseText);
      const contracts = result.result || [];

      console.log(`🔍 Found ${contracts.length} active contracts`);

      // Filter and map to holdings
      const holdings = [];
      for (const contract of contracts) {
        const payload = contract.payload || contract.createArguments;

        // Filter by owner and optional instrumentId
        if (payload && payload.owner === owner) {
          if (!instrumentId || payload.instrument === instrumentId) {
            holdings.push({
              contractId: contract.contractId,
              owner: payload.owner,
              admin: payload.admin,
              instrument: payload.instrument,
              amount: parseFloat(payload.amount)
            });
          }
        }
      }

      console.log(`✅ Found ${holdings.length} holdings for owner ${owner}`);

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