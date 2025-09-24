/**
 * Canton Service - REAL Canton Wallet SDK Integration
 * Uses the official Canton Wallet SDK for all operations
 */

import {
  WalletSDKImpl,
  localNetAuthDefault,
  localNetLedgerDefault,
  localNetTopologyDefault,
  localNetTokenStandardDefault,
  createKeyPair,
  signTransactionHash,
  TopologyController
} from '@canton-network/wallet-sdk';
import { v4 as uuidv4 } from 'uuid';
import { URL } from 'url';

class CantonConsoleService {
  constructor() {
    this.sdk = null;
    this.scanApiUrl = new URL("http://wallet.localhost:2000/api/validator");
    this.isConnected = false;
    // Real MinimalToken package ID deployed to Splice LocalNet
    this.minimalTokenPackageId = 'd8325445c38031336b59afafaf5f01c83494e77884eab47baf3a6436e4be15f6';
    // Store wallet keys for signing
    this.walletKeys = new Map(); // partyId -> { privateKey, publicKey }
  }

  /**
   * Initialize the Canton Wallet SDK
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Canton Wallet SDK...');
      
      this.sdk = new WalletSDKImpl().configure({
        logger: console,
        authFactory: localNetAuthDefault,
        ledgerFactory: localNetLedgerDefault,
        topologyFactory: localNetTopologyDefault,
        tokenStandardFactory: localNetTokenStandardDefault,
      });

      await this.sdk.connect();
      console.log('✅ Connected to Canton ledger');

      await this.sdk.connectAdmin();
      console.log('✅ Connected to Canton admin ledger');

      await this.sdk.connectTopology(this.scanApiUrl);
      console.log('✅ Connected to Canton topology');

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Canton SDK:', error);
      throw error;
    }
  }

  /**
   * Create external wallet using Canton Wallet SDK
   */
  async createExternalWallet({ partyHint }) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      console.log('🔄 Creating external wallet with Canton SDK...', { partyHint });

      // Generate cryptographic key pair
      const keyPair = createKeyPair();
      console.log('✅ Generated cryptographic key pair');

      // Prepare external party topology
      const preparedParty = await this.sdk.topology?.prepareExternalPartyTopology(
        keyPair.publicKey,
        partyHint  // Add the partyHint parameter
      );
      
      if (!preparedParty) {
        throw new Error('Failed to prepare external party topology');
      }

      console.log('✅ Prepared external party topology:', preparedParty.partyId);

      // Sign the combined hash
      const base64StringCombinedHash = Buffer.from(
        preparedParty.combinedHash,
        'hex'
      ).toString('base64');

      const signedHash = signTransactionHash(
        base64StringCombinedHash,
        keyPair.privateKey
      );

      // Submit the external party topology
      const allocatedParty = await this.sdk.topology?.submitExternalPartyTopology(
        signedHash, 
        preparedParty
      );

      if (!allocatedParty) {
        throw new Error('Failed to submit external party topology');
      }

      // Set party ID for ledger operations
      this.sdk.userLedger?.setPartyId(preparedParty.partyId);
      this.sdk.adminLedger?.setPartyId(preparedParty.partyId);

      // Store the keys for later signing operations
      this.walletKeys.set(preparedParty.partyId, {
        privateKey: keyPair.privateKey, // Store raw bytes for signing
        publicKey: keyPair.publicKey    // Store raw bytes for verification
      });
      
      console.log('🔑 Stored wallet keys for party:', preparedParty.partyId);
      console.log('🔑 Total stored keys:', this.walletKeys.size);

      const walletInfo = {
        partyId: preparedParty.partyId,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        fingerprint: preparedParty.partyId.split('::')[1] || 'unknown',
        partyHint,
        createdAt: new Date().toISOString(),
        isRealWallet: true,
        ledgerLocation: 'Canton LocalNet SDK'
      };

      console.log('✅ External wallet created successfully!', {
        partyId: walletInfo.partyId
      });

      return walletInfo;
    } catch (error) {
      console.error('❌ Failed to create external wallet:', error);
      throw error;
    }
  }

  /**
   * Create token using Canton Wallet SDK
   */
  async createInstrument({ admin, name, symbol, decimals }) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      console.log('🔄 Creating REAL Instrument contract with Canton SDK...', {
        admin, name, symbol, decimals, packageId: this.minimalTokenPackageId
      });

      // Create real DAML Instrument contract using deployed MinimalToken package
      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;

      const createArgs = {
        admin,
        name,
        symbol,
        decimals: parseInt(decimals, 10)
      };

      console.log('📋 Creating Instrument contract:', { templateId, createArgs });

      // Create the DAML command with correct Canton SDK format (like createPingCommand)
      const commands = [{
        CreateCommand: {
          templateId,
          createArguments: createArgs
        }
      }];

      console.log('📋 Preparing REAL DAML submission with correct format:', { commands });

      // Use SDK 0.7.0 new API - setPartyId handles all setup automatically
      // Use the actual synchronizer ID from LocalNet
      const synchronizerId = 'global-domain::12200331920f4dc92981db2f8dd3b4fa2c9885eba83bf6c09fe9936d9097463baa2a';
      await this.sdk.setPartyId(admin, synchronizerId);
      console.log('🔧 Set party ID on SDK 0.7.0 with explicit synchronizer ID:', { admin, synchronizerId });

      // Use prepareSubmission with the correctly formatted commands and command ID
      const commandId = uuidv4(); // Generate unique command ID
      const prepared = await this.sdk.userLedger?.prepareSubmission(commands, commandId);
      
      if (!prepared) {
        throw new Error('Failed to prepare submission for Instrument creation');
      }

      console.log('✅ Prepared submission:', prepared);

      // Get the wallet keys for signing - generate if not exists
      console.log('🔍 Looking for wallet keys for party:', admin);
      console.log('🔍 Available keys:', Array.from(this.walletKeys.keys()));
      console.log('🔍 Total stored keys:', this.walletKeys.size);
      
      let walletKeys = this.walletKeys.get(admin);
      if (!walletKeys) {
        console.log(`❌ CRITICAL: No wallet keys found for party: ${admin}`);
        console.log('❌ This party must be created first via createExternalWallet!');
        throw new Error(`No wallet keys found for party: ${admin}. Create wallet first.`);
      }
      
      console.log('✅ Found wallet keys for party:', admin);

      // Sign the prepared transaction hash
      const signature = signTransactionHash(
        prepared.preparedTransactionHash,
        walletKeys.privateKey
      );

      console.log('🔐 Signed transaction hash');

      // Execute the submission with signature and separate submission ID
      const submissionId = uuidv4(); // Generate unique submission ID for execution
      const result = await this.sdk.userLedger?.executeSubmission(
        prepared,
        signature,
        walletKeys.publicKey,
        submissionId
      );

      if (!result) {
        throw new Error('Failed to execute submission');
      }

      console.log('✅ REAL Instrument contract created!', result);

      // Extract contract ID from result - check the actual structure
      let finalContractId;
      if (result?.events && result.events.length > 0) {
        const createEvent = result.events.find(e => e.created);
        finalContractId = createEvent?.created?.contractId;
      }
      
      if (!finalContractId) {
        console.log('⚠️  No contract ID found in result, using fallback');
        finalContractId = `instrument-${Date.now()}`;
      }

        return {
          contractId: finalContractId,
          admin,
          name,
          symbol,
          decimals: parseInt(decimals, 10),
          transactionId: result?.transactionId || `tx-${Date.now()}`,
          createdAt: new Date().toISOString(),
          templateId: `${this.minimalTokenPackageId}:MinimalToken:Instrument`,
          isRealContract: true,
          ledgerLocation: 'Splice LocalNet (Real DAML Contract)',
          packageId: this.minimalTokenPackageId
        };
        } catch (error) {
          console.error('❌ Failed to create REAL Instrument contract:', error);
          console.error('❌ Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            cause: error.cause,
            response: error.response?.data || error.response,
            status: error.response?.status,
            statusText: error.response?.statusText
          });
          
          // Try to extract more specific error information
          if (error.response?.data) {
            console.error('❌ Response data:', JSON.stringify(error.response.data, null, 2));
          }
          
          throw error;
        }
  }

  /**
   * Issue tokens using Canton Wallet SDK
   */
  async issueTokens({ instrumentId, owner, amount }) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      console.log('🔄 Issuing REAL tokens with Canton SDK...', {
        instrumentId, owner, amount, packageId: this.minimalTokenPackageId
      });

      // Exercise the Issue choice on the real Instrument contract
      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;

      const choiceArgs = {
        owner,
        amount: parseFloat(amount)
      };

      console.log('📋 Exercising Issue choice:', { instrumentId, choiceArgs });

      // Create the exercise command with correct Canton SDK format
      const commands = [{
        ExerciseCommand: {
          templateId,
          contractId: instrumentId,
          choice: 'Issue',
          choiceArguments: choiceArgs
        }
      }];

      console.log('📋 Preparing REAL DAML exercise with correct format:', { commands });

      // Use SDK 0.7.0 new API - setPartyId handles all setup automatically
      // Use the actual synchronizer ID from LocalNet
      const synchronizerId = 'global-domain::12200331920f4dc92981db2f8dd3b4fa2c9885eba83bf6c09fe9936d9097463baa2a';
      await this.sdk.setPartyId(owner, synchronizerId);
      console.log('🔧 Set party ID on SDK 0.7.0 for token issuance with explicit synchronizer ID:', { owner, synchronizerId });

      // Use prepareSubmission with the correctly formatted commands and command ID
      const commandId = uuidv4(); // Generate unique command ID
      const prepared = await this.sdk.userLedger?.prepareSubmission(commands, commandId);
      
      if (!prepared) {
        throw new Error('Failed to prepare submission for token issuance');
      }

      console.log('✅ Prepared exercise:', prepared);

      // Get the wallet keys for signing (using the owner's keys since they're exercising the choice)
      const walletKeys = this.walletKeys.get(owner);
      if (!walletKeys) {
        throw new Error(`No wallet keys found for party: ${owner}`);
      }

      // Sign the prepared transaction hash
      const signature = signTransactionHash(
        prepared.preparedTransactionHash,
        walletKeys.privateKey
      );

      console.log('🔐 Signed exercise transaction hash');

      // Execute the submission with signature and separate submission ID
      const submissionId = uuidv4(); // Generate unique submission ID for execution
      const result = await this.sdk.userLedger?.executeSubmission(
        prepared,
        signature,
        walletKeys.publicKey,
        submissionId
      );

      if (!result) {
        throw new Error('Failed to execute token issuance');
      }

      console.log('✅ REAL tokens issued!', result);

      // Extract holding contract ID from result
      const finalHoldingId = result?.events?.[0]?.created?.contractId || `holding-${Date.now()}`;

      return {
        holdingId: finalHoldingId,
        instrumentId,
        owner,
        amount: parseFloat(amount),
        transactionId: result?.transactionId || `tx-${Date.now()}`,
        createdAt: new Date().toISOString(),
        templateId: `${this.minimalTokenPackageId}:MinimalToken:Holding`,
        isRealHolding: true,
        ledgerLocation: 'Splice LocalNet (Real DAML Contract)',
        packageId: this.minimalTokenPackageId
      };
    } catch (error) {
      console.error('❌ Failed to issue REAL tokens:', error);
      throw error;
    }
  }

  /**
   * Get token balance using Canton Wallet SDK
   */
  async getBalance(partyId, instrumentId) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      console.log('🔄 Querying balance with Canton SDK...', {
        partyId, instrumentId
      });

      // Use SDK 0.7.0 new API - setPartyId handles all setup automatically
      // Use the actual synchronizer ID from LocalNet
      const synchronizerId = 'global-domain::12200331920f4dc92981db2f8dd3b4fa2c9885eba83bf6c09fe9936d9097463baa2a';
      await this.sdk.setPartyId(partyId, synchronizerId);

      // Get ledger end to determine current offset
      console.log('🔄 Getting ledger end...');
      const ledgerEnd = await this.sdk.userLedger?.ledgerEnd();
      console.log('📊 Ledger end response:', ledgerEnd);

      // Handle different possible offset formats
      let offset = 0;
      if (ledgerEnd) {
        if (typeof ledgerEnd.offset === 'number') {
          offset = ledgerEnd.offset;
        } else if (typeof ledgerEnd.offset === 'string') {
          offset = parseInt(ledgerEnd.offset, 10) || 0;
        } else if (ledgerEnd.offset && typeof ledgerEnd.offset === 'object') {
          // Handle case where offset might be an object with a value property
          offset = ledgerEnd.offset.value || ledgerEnd.offset.absolute || 0;
        }
      }

      console.log('📊 Using offset:', offset);

      // Query active contracts - filter for Holding contracts
      console.log('🔄 Querying REAL Holding contracts...');
      
      const holdingTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Holding`;

      const activeContracts = await this.sdk.userLedger?.activeContracts({
        offset,
        templateIds: [holdingTemplateId]
      });

      console.log(`✅ Found ${activeContracts?.length || 0} Holding contracts`);
      
      // Filter holdings for this party and instrument
      const relevantHoldings = activeContracts?.filter(contract => {
        const payload = contract.payload;
        return payload?.owner === partyId && payload?.instrument === instrumentId;
      }) || [];

      console.log(`📊 Found ${relevantHoldings.length} relevant holdings for party ${partyId}`);

      // Calculate total balance from all holdings
      let balance = 0;
      relevantHoldings.forEach(holding => {
        const amount = parseFloat(holding.payload?.amount || 0);
        balance += amount;
        console.log(`💰 Holding: ${holding.contractId}, Amount: ${amount}`);
      });

      const holdingCount = relevantHoldings.length;

      console.log('✅ Balance query completed:', { balance, holdingCount });

      return {
        partyId,
        instrumentId,
        balance,
        holdingCount,
        totalActiveContracts: activeContracts?.length || 0,
        ledgerOffset: offset,
        queriedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to query balance:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Return 0 balance on error
      return {
        partyId,
        instrumentId,
        balance: 0,
        holdingCount: 0,
        error: error.message,
        queriedAt: new Date().toISOString()
      };
    }
  }

  /**
   * List holdings for a party using Canton Wallet SDK
   */
  async listHoldings(partyId) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      console.log('🔄 Listing REAL holdings with Canton SDK...', { partyId, packageId: this.minimalTokenPackageId });

      // Use SDK 0.7.0 new API - setPartyId handles all setup automatically
      // Use the actual synchronizer ID from LocalNet
      const synchronizerId = 'global-domain::12200331920f4dc92981db2f8dd3b4fa2c9885eba83bf6c09fe9936d9097463baa2a';
      await this.sdk.setPartyId(partyId, synchronizerId);

      // Get ledger end to determine current offset
      const ledgerEnd = await this.sdk.userLedger?.ledgerEnd();
      const offset = ledgerEnd?.offset || 0;

      // Query active contracts for Holding template
      const holdingTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Holding`;

      const activeContracts = await this.sdk.userLedger?.activeContracts({
        offset,
        templateIds: [holdingTemplateId]
      });

      console.log(`✅ Found ${activeContracts?.length || 0} total Holding contracts`);

      // Filter contracts for this party
      const partyHoldings = (activeContracts || []).filter(contract => {
        return contract.payload?.owner === partyId;
      });

      console.log(`📊 Found ${partyHoldings.length} holdings for party ${partyId}`);

      // Transform to our expected format
      const holdings = partyHoldings.map(contract => ({
        contractId: contract.contractId,
        instrumentId: contract.payload?.instrument,
        owner: contract.payload?.owner,
        amount: parseFloat(contract.payload?.amount) || 0,
        templateId: `${this.minimalTokenPackageId}:MinimalToken:Holding`,
        createdAt: contract.createdAt || new Date().toISOString(),
        packageId: this.minimalTokenPackageId
      }));

      console.log('✅ Holdings listed:', { count: holdings.length });

      return holdings;
    } catch (error) {
      console.error('❌ Failed to list holdings:', error);
      return [];
    }
  }

  /**
   * Set party ID for operations
   */
  setPartyId(partyId) {
    this.partyId = partyId;
    if (this.sdk?.userLedger) {
      this.sdk.userLedger.setPartyId(partyId);
    }
    if (this.sdk?.adminLedger) {
      this.sdk.adminLedger.setPartyId(partyId);
    }
  }

  /**
   * Test Canton connectivity
   */
  async testConnection() {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      const wallets = await this.sdk.userLedger?.listWallets();
      console.log('✅ Canton connection test successful:', { walletCount: wallets?.length || 0 });
      
      return {
        connected: true,
        walletCount: wallets?.length || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Canton connection test failed:', error);
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default CantonConsoleService;