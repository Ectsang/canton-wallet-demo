/**
 * CN Quickstart Ledger API Service
 * Direct JSON Ledger API integration for custom DAML contracts
 *
 * Uses App Provider party and authentication from CN Quickstart LocalNet
 * Located at: /Users/e/code/sbc/canton/cn-quickstart/quickstart
 */

import { createHmac } from 'crypto';
import MINIMAL_TOKEN_PACKAGE_CONFIG from '../config/packageConfig.js';

class CNQuickstartLedgerService {
  constructor() {
    // CN Quickstart App Provider endpoints
    this.jsonApiUrl = 'http://localhost:3975';  // App Provider JSON API (prefix 3 + suffix 975)

    // App Provider participant ID - get from logs with: docker logs canton 2>&1 | grep "PAR::participant::1220a57d9319"
    this.participantId = 'PAR::participant::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad';

    // For backward compatibility (some APIs use ledgerId)
    this.ledgerId = this.participantId;

    // MinimalToken package ID from centralized config
    this.minimalTokenPackageId = MINIMAL_TOKEN_PACKAGE_CONFIG.currentPackageId;

    // App Provider party - fetched dynamically on initialization
    // This is the party with admin rights on App Provider participant
    this.appProviderParty = null;

    // Timeout for JSON API calls (30 seconds)
    this.timeout = 30000;

    console.log('🔧 CN Quickstart Ledger Service constructed', {
      jsonApiUrl: this.jsonApiUrl,
      participantId: this.participantId.substring(0, 50) + '...',
      packageId: this.minimalTokenPackageId,
      timeout: `${this.timeout}ms`,
      note: 'appProviderParty will be fetched dynamically on first use'
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
   * Initialize by fetching App Provider party dynamically from Canton
   * This is crucial because party IDs change when Canton LocalNet restarts
   */
  async initialize() {
    if (this.appProviderParty) {
      return; // Already initialized
    }

    try {
      console.log('🔄 Fetching App Provider party from Canton logs...');

      // Option 1: Try to get from Canton logs via shell command
      // This is the most reliable method for LocalNet
      try {
        const { execSync } = await import('child_process');
        const result = execSync(
          'docker logs canton 2>&1 | grep "app_provider_quickstart-e-1::" | tail -1 | grep -o "app_provider_quickstart-e-1::[a-f0-9]*" | head -1',
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();

        if (result && result.startsWith('app_provider_quickstart-e-1::')) {
          this.appProviderParty = result;
          console.log('✅ Found App Provider party from logs:', this.appProviderParty);
          return;
        }
      } catch (logError) {
        console.log('⚠️  Could not extract from logs, trying API...');
      }

      // Option 2: Try CN Quickstart backend API (requires auth)
      try {
        const backendResponse = await fetch('http://localhost:8080/admin/tenant-registrations', {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (backendResponse.ok) {
          const data = await backendResponse.json();
          if (Array.isArray(data) && data.length > 0) {
            this.appProviderParty = data[0].party;
            console.log('✅ Got App Provider party from backend:', this.appProviderParty);
            return;
          }
        }
      } catch (backendError) {
        console.log('⚠️  Backend API not available, trying environment variable...');
      }

      // Option 3: Use environment variable
      if (process.env.APP_PROVIDER_PARTY) {
        this.appProviderParty = process.env.APP_PROVIDER_PARTY;
        console.log('✅ Using APP_PROVIDER_PARTY from env:', this.appProviderParty);
        return;
      }

      // Option 4: Extract from Canton logs (last resort)
      console.error('❌ Could not determine App Provider party automatically');
      throw new Error(
        'Could not determine App Provider party. Please:\n' +
        '1. Set APP_PROVIDER_PARTY environment variable, OR\n' +
        '2. Check Canton logs: docker logs canton 2>&1 | grep "app_provider_quickstart-e-1::" | tail -1'
      );

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
   * Propose to burn a Holding contract (cross-participant pattern)
   * Owner exercises ProposeBurn choice on Holding to create BurnProposal
   *
   * @param {string} holdingId - Holding contract ID to propose burning
   * @param {string} owner - Party ID of the owner (controller of ProposeBurn choice)
   * @returns {Promise<Object>} { success, proposalId, holdingId, owner }
   */
  async proposeBurnHolding({ holdingId, owner }) {
    try {
      await this.initialize();

      console.log('🔥 Proposing burn via ProposeBurn choice...', {
        holdingId,
        owner
      });

      const holdingTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Holding`;
      const commandId = `propose-burn-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Determine which participant the owner is on and use their JSON API
      const isAppProviderParty = owner.startsWith('app_provider');
      const apiUrl = isAppProviderParty
        ? 'http://localhost:3975'  // app-provider JSON API
        : 'http://localhost:2975'; // app-user JSON API (for demo-wallet-X)

      console.log(`📍 Using ${isAppProviderParty ? 'app-provider' : 'app-user'} JSON API for owner: ${owner}`);

      // Generate JWT: actAs owner (controller of ProposeBurn)
      const token = this.generateJWT([owner], []);

      const exerciseCommand = {
        templateId: holdingTemplateId,
        contractId: holdingId,
        choice: 'ProposeBurn',
        choiceArgument: {}  // ProposeBurn choice takes no arguments
      };

      const requestBody = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [owner],
          readAs: [],
          commands: [{
            ExerciseCommand: exerciseCommand
          }]
        }
      };

      console.log('📋 Exercise ProposeBurn command:', JSON.stringify(requestBody, null, 2));

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
        30000
      );

      const responseText = await response.text();
      console.log('📥 Raw ProposeBurn response:', responseText);
      console.log('📥 Response status:', response.status);

      const result = JSON.parse(responseText);
      console.log('📥 ProposeBurn command response:', JSON.stringify(result, null, 2));

      // Extract BurnProposal contract ID from created events
      if (result?.transaction?.events) {
        const createdEvent = result.transaction.events.find(e => e.CreatedEvent);
        if (createdEvent) {
          const proposalId = createdEvent.CreatedEvent.contractId;
          console.log('✅ BurnProposal created:', proposalId);

          return {
            success: true,
            proposalId,
            holdingId,
            owner,
            transactionId: result.transaction.updateId || result.transaction.commandId,
            proposedAt: new Date().toISOString()
          };
        }
      }

      throw new Error('ProposeBurn succeeded but could not extract proposalId from response');

    } catch (error) {
      console.error('❌ Failed to propose burn:', error);
      throw error;
    }
  }

  /**
   * Burn a Holding contract (reduce supply) - LEGACY METHOD
   * Owner exercises the Burn choice on Holding
   * NOTE: This may not work for cross-participant Holdings with dual signatories.
   * Use proposeBurnHolding() + acceptBurnProposal() for cross-participant burns.
   *
   * @param {string} holdingId - Holding contract ID to burn
   * @param {string} owner - Party ID of the owner (must be authorized to burn)
   */
  async burnHolding({ holdingId, owner }) {
    try {
      await this.initialize();

      console.log('🔥 Burning holding via JSON Ledger API v2...', {
        holdingId,
        owner
      });

      const holdingTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Holding`;
      const commandId = `burn-holding-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Determine which participant the owner is on and use their JSON API
      const isAppProviderParty = owner.startsWith('app_provider');
      const apiUrl = isAppProviderParty
        ? 'http://localhost:3975'  // app-provider JSON API
        : 'http://localhost:2975'; // app-user JSON API (for demo-wallet-X)

      console.log(`📍 Using ${isAppProviderParty ? 'app-provider' : 'app-user'} JSON API for owner: ${owner}`);

      // Generate JWT: actAs owner (controller) only
      // NOTE: readAs admin doesn't work for cross-participant burns
      const token = this.generateJWT([owner], []);

      const exerciseCommand = {
        templateId: holdingTemplateId,
        contractId: holdingId,
        choice: 'Burn',
        choiceArgument: {}  // Burn choice takes no arguments
      };

      const requestBody = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [owner],  // Only controller acts
          readAs: [],      // No readAs for cross-participant operations
          commands: [{
            ExerciseCommand: exerciseCommand
          }]
        }
      };

      console.log('📋 Exercise Burn command:', JSON.stringify(requestBody, null, 2));

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
      console.log('📥 Raw Burn response:', responseText);
      console.log('📥 Response status:', response.status);

      const result = JSON.parse(responseText);

      console.log('📥 Burn command response:', JSON.stringify(result, null, 2));

      // Check if transaction was successful
      if (result?.transaction) {
        console.log('✅ Burn transaction successful!');
        console.log('📋 Transaction ID:', result.transaction.updateId || result.transaction.commandId);

        // Burn archives the contract - check for ArchivedEvent
        if (result.transaction.events && result.transaction.events.length > 0) {
          console.log(`🔍 Found ${result.transaction.events.length} events in burn response`);
          const archivedEvent = result.transaction.events.find(e => e.ArchivedEvent);
          if (archivedEvent) {
            console.log('✅ Archived contract ID:', archivedEvent.ArchivedEvent.contractId);
          }
        } else {
          console.log('ℹ️ No events in response (Burn returns (), which is expected)');
        }

        return {
          success: true,
          holdingId: holdingId,
          owner: owner,
          transactionId: result.transaction.updateId || result.transaction.commandId,
          burnedAt: new Date().toISOString()
        };
      }

      throw new Error('Burn transaction failed - no transaction in response');

    } catch (error) {
      console.error('❌ Failed to burn holding:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Accept a BurnProposal (admin exercises AcceptBurn choice)
   * This completes the cross-participant burn by archiving the underlying Holding
   *
   * @param {string} proposalId - BurnProposal contract ID to accept
   * @param {string} admin - Party ID of the admin (controller of AcceptBurn choice)
   * @returns {Promise<Object>} { success, proposalId, admin, transactionId, acceptedAt }
   */
  async acceptBurnProposal({ proposalId, admin }) {
    try {
      await this.initialize();

      console.log('✅ Accepting burn proposal via AcceptBurn choice...', {
        proposalId,
        admin
      });

      const burnProposalTemplateId = `${this.minimalTokenPackageId}:MinimalToken:BurnProposal`;
      const commandId = `accept-burn-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Determine which participant the admin is on and use their JSON API
      const isAppProviderParty = admin.startsWith('app_provider');
      const apiUrl = isAppProviderParty
        ? 'http://localhost:3975'  // app-provider JSON API
        : 'http://localhost:2975'; // app-user JSON API

      console.log(`📍 Using ${isAppProviderParty ? 'app-provider' : 'app-user'} JSON API for admin: ${admin}`);

      // Generate JWT: actAs admin (controller of AcceptBurn)
      const token = this.generateJWT([admin], []);

      const exerciseCommand = {
        templateId: burnProposalTemplateId,
        contractId: proposalId,
        choice: 'AcceptBurn',
        choiceArgument: {}  // AcceptBurn choice takes no arguments
      };

      const requestBody = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [admin],
          readAs: [],
          commands: [{
            ExerciseCommand: exerciseCommand
          }]
        }
      };

      console.log('📋 Exercise AcceptBurn command:', JSON.stringify(requestBody, null, 2));

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
        30000
      );

      const responseText = await response.text();
      console.log('📥 Raw AcceptBurn response:', responseText);
      console.log('📥 Response status:', response.status);

      const result = JSON.parse(responseText);
      console.log('📥 AcceptBurn command response:', JSON.stringify(result, null, 2));

      // Check if transaction was successful
      if (result?.transaction) {
        console.log('✅ AcceptBurn transaction successful!');
        console.log('📋 Transaction ID:', result.transaction.updateId || result.transaction.commandId);

        // AcceptBurn archives both the BurnProposal and the underlying Holding
        if (result.transaction.events && result.transaction.events.length > 0) {
          console.log(`🔍 Found ${result.transaction.events.length} events in AcceptBurn response`);
          const archivedEvents = result.transaction.events.filter(e => e.ArchivedEvent);
          console.log(`✅ Archived ${archivedEvents.length} contracts (BurnProposal + Holding)`);
        }

        return {
          success: true,
          proposalId,
          admin,
          transactionId: result.transaction.updateId || result.transaction.commandId,
          acceptedAt: new Date().toISOString()
        };
      }

      throw new Error('AcceptBurn transaction failed - no transaction in response');

    } catch (error) {
      console.error('❌ Failed to accept burn proposal:', error);
      throw error;
    }
  }

  /**
   * Transfer holding by exercising Transfer choice
   *
   * @param {Object} params - Transfer parameters
   * @param {string} params.holdingId - Holding contract ID
   * @param {string} params.owner - Owner party ID (controller)
   * @param {string} params.recipient - Recipient party ID
   * @param {string} params.amount - Amount to transfer
   * @returns {Promise<Object>} Transfer result with new holding IDs
   */
  async transferHolding({ holdingId, owner, recipient, amount }) {
    try {
      await this.initialize();

      console.log('🔄 Transferring holding...', { holdingId, owner, recipient, amount });

      // Determine which participant the owner is on and use their JSON API
      const isAppProviderParty = owner.startsWith('app_provider');
      const apiUrl = isAppProviderParty
        ? 'http://localhost:3975'  // app-provider JSON API
        : 'http://localhost:2975'; // app-user JSON API (for demo-wallet-X)

      console.log(`📍 Using ${isAppProviderParty ? 'app-provider' : 'app-user'} JSON API for owner: ${owner}`);

      // Generate JWT: actAs owner (controller) only
      // NOTE: readAs admin doesn't work for cross-participant transfers
      const token = this.generateJWT([owner], []);

      // Create Transfer exercise command
      const exerciseCommand = {
        templateId: `${this.minimalTokenPackageId}:MinimalToken:Holding`,
        contractId: holdingId,
        choice: 'Transfer',
        choiceArgument: {
          recipient: recipient,
          transferAmount: amount
        }
      };

      const commandId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const requestBody = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [owner],  // Only controller acts
          readAs: [],      // No readAs for cross-participant operations
          commands: [{
            ExerciseCommand: exerciseCommand
          }]
        }
      };

      console.log('📋 Exercise Transfer command:', JSON.stringify(requestBody, null, 2));

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
        30000
      );

      const responseText = await response.text();
      console.log('📥 Raw Transfer response:', responseText);
      console.log('📥 Response status:', response.status);

      const result = JSON.parse(responseText);

      console.log('📥 Transfer command response:', JSON.stringify(result, null, 2));

      if (result?.transaction) {
        console.log('✅ Transfer transaction successful!');
        console.log('📋 Transaction ID:', result.transaction.updateId || result.transaction.commandId);

        // Extract created holding IDs from events
        let newHoldingId = null;
        let changeHoldingId = null;

        if (result.transaction.events && result.transaction.events.length > 0) {
          console.log(`🔍 Found ${result.transaction.events.length} events in transfer response`);

          const createdEvents = result.transaction.events.filter(e => e.CreatedEvent);
          console.log(`🔍 Found ${createdEvents.length} created events`);

          // First created event is the new holding (recipient)
          if (createdEvents[0]) {
            newHoldingId = createdEvents[0].CreatedEvent.contractId;
            console.log('✅ New holding (recipient):', newHoldingId);
          }

          // Second created event is the change holding (sender), if any
          if (createdEvents[1]) {
            changeHoldingId = createdEvents[1].CreatedEvent.contractId;
            console.log('✅ Change holding (sender):', changeHoldingId);
          }
        }

        return {
          success: true,
          holdingId: holdingId,
          owner: owner,
          recipient: recipient,
          amount: parseFloat(amount),
          newHoldingId: newHoldingId,
          changeHoldingId: changeHoldingId,
          transactionId: result.transaction.updateId || result.transaction.commandId,
          transferredAt: new Date().toISOString()
        };
      }

      throw new Error('Transfer transaction failed - no transaction in response');

    } catch (error) {
      console.error('❌ Failed to transfer holding:', error);
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

      // Query for Holdings across ALL deployed package versions from centralized config
      const allPackageIds = Object.values(MINIMAL_TOKEN_PACKAGE_CONFIG.versions);

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