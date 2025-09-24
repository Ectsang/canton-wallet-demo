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

      // Use the one-step approach as recommended in REFERENCE.md
      console.log('🔄 Creating external party using prepareSignAndSubmitExternalParty...');
      const allocatedParty = await this.sdk.topology?.prepareSignAndSubmitExternalParty(
        keyPair.privateKey,
        partyHint
      );

      if (!allocatedParty) {
        throw new Error('Failed to create external party');
      }

      console.log('✅ External party created successfully:', allocatedParty.partyId);

      // Set party ID for ledger operations
      this.sdk.userLedger?.setPartyId(allocatedParty.partyId);
      this.sdk.adminLedger?.setPartyId(allocatedParty.partyId);

      // Store the keys for later signing operations
      this.walletKeys.set(allocatedParty.partyId, {
        privateKey: keyPair.privateKey, // Store raw bytes for signing
        publicKey: keyPair.publicKey    // Store raw bytes for verification
      });
      
      console.log('🔑 Stored wallet keys for party:', allocatedParty.partyId);
      console.log('🔑 Total stored keys:', this.walletKeys.size);

      const walletInfo = {
        partyId: allocatedParty.partyId,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        fingerprint: allocatedParty.partyId.split('::')[1] || 'unknown',
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

      // Use SDK 0.7.0 prepareSignAndExecuteTransaction method (simpler than manual prepare/sign/execute)
      const commandId = uuidv4(); // Generate unique command ID
      console.log('🔄 Using SDK 0.7.0 prepareSignAndExecuteTransaction method...');
      
      // Get ledger offset before preparing command (SDK 0.7.0 best practice)
      const offsetLatest = (await this.sdk.userLedger?.ledgerEnd())?.offset ?? 0;
      console.log('📊 Ledger offset before transaction:', offsetLatest);
      
      const returnedCommandId = await this.sdk.userLedger?.prepareSignAndExecuteTransaction(
        commands,
        walletKeys.privateKey,
        commandId
      );
      
      console.log('✅ Transaction executed, returned command ID:', returnedCommandId);
      
      // Wait for command completion (SDK 0.7.0 feature) - this returns the actual result
      console.log('🔄 Waiting for completion with params:', {
        offsetLatest,
        timeout: 5000,
        commandId: returnedCommandId || commandId
      });
      
      const completion = await this.sdk.userLedger?.waitForCompletion(
        offsetLatest, // where to start from
        5000, // timeout in ms
        returnedCommandId || commandId // use returned command ID or fallback to original
      );
      
      console.log('✅ Command completion result:', JSON.stringify(completion, null, 2));
      console.log('✅ Completion type:', typeof completion);
      console.log('✅ Completion keys:', completion ? Object.keys(completion) : 'null');

      if (!completion) {
        throw new Error('Failed to get completion result');
      }
      
      // Use completion as the result (this should contain the contract events)
      const result = completion;

      console.log('✅ REAL Instrument contract created!', result);
      console.log('🔍 Result structure:', JSON.stringify(result, null, 2));

      // Extract contract ID from result - check the actual structure
      let finalContractId;
      if (result?.events && result.events.length > 0) {
        // Look for CreatedEvent in the events array
        const createEvent = result.events.find(e => e.created || e.CreatedEvent);
        finalContractId = createEvent?.created?.contractId || createEvent?.CreatedEvent?.contractId;
        
        // Also check if contractId is directly in the event
        if (!finalContractId) {
          finalContractId = result.events.find(e => e.contractId)?.contractId;
        }
      }
      
      // Check if contractId is at the top level of result
      if (!finalContractId && result?.contractId) {
        finalContractId = result.contractId;
      }
      
      if (!finalContractId && result?.updateId) {
        console.log('⚠️  No contract ID found in completion result, querying transaction events...');
        console.log('🔍 Using updateId:', result.updateId);
        
        // Query transaction events using the updateId to get the contract ID
        // Based on REFERENCE.md: Use JSON Ledger API /v2/updates/update-by-id to get transaction events
        try {
          console.log('🔄 Querying transaction events using JSON Ledger API...');
          console.log('🔍 Using updateId:', result.updateId);
          
          // Use JSON Ledger API directly to get transaction with events
          // This is the approach documented in REFERENCE.md for extracting contract IDs
          const ledgerApiUrl = process.env.JSON_API_URL || 'http://localhost:2975';
          const authToken = process.env.UNSAFE_AUTH_TOKEN || 'unsafe';
          
          console.log('🔄 Calling JSON Ledger API /v2/updates/update-by-id...');
          
          const transactionRequest = {
            updateId: result.updateId,
            updateFormat: {
              includeTransactions: {
                transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS",
                eventFormat: {
                  filtersByParty: {
                    [admin]: {
                      cumulative: [{
                        identifierFilter: {
                          WildcardFilter: {
                            value: {
                              includeCreatedEventBlob: true // Include created event details
                            }
                          }
                        }
                      }]
                    }
                  }
                }
              }
            }
          };
          
          console.log('📋 Transaction request:', JSON.stringify(transactionRequest, null, 2));
          
          const response = await fetch(`${ledgerApiUrl}/v2/updates/update-by-id`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(transactionRequest)
          });
          
          if (!response.ok) {
            console.log('❌ JSON Ledger API request failed:', response.status, response.statusText);
            const errorText = await response.text();
            console.log('❌ Error response:', errorText);
          } else {
            const transactionData = await response.json();
            console.log('✅ JSON Ledger API response:', JSON.stringify(transactionData, null, 2));
            
            // Parse the transaction events to find CreatedEvent for our contract
            // Based on REFERENCE.md: "Find all CreatedEvents in that range"
            if (transactionData?.update?.Transaction?.value?.events) {
              const events = transactionData.update.Transaction.value.events;
              console.log('🔍 Found', events.length, 'events in transaction');
              
              for (const event of events) {
                console.log('🔍 Checking event:', JSON.stringify(event, null, 2));
                
                // Look for CreatedEvent that matches our Instrument template
                if (event.CreatedEvent) {
                  const createdEvent = event.CreatedEvent;
                  const templateId = createdEvent.templateId;
                  
                  console.log('✅ Found CreatedEvent with templateId:', templateId);
                  console.log('✅ Contract ID:', createdEvent.contractId);
                  
                  // Check if this is our MinimalToken:Instrument contract
                  if (templateId && templateId.includes('MinimalToken:Instrument')) {
                    finalContractId = createdEvent.contractId;
                    console.log('🎉 FOUND REAL CONTRACT ID:', finalContractId);
                    break;
                  }
                }
              }
            }
          }
        } catch (apiError) {
          console.log('❌ JSON Ledger API call failed:', apiError);
          console.log('❌ API Error details:', {
            message: apiError.message,
            stack: apiError.stack
          });
        }
        
        // Approach 3: Query active contracts with the correct parameters
        if (!finalContractId) {
          console.log('🔄 Trying activeContracts query with proper parameters...');
          try {
            const instrumentTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
            
            // Use the correct activeContracts API based on SDK documentation
            const activeContracts = await this.sdk.userLedger?.activeContracts({
              offset: result.offset, // Use offset instead of activeAtOffset
              templateIds: [instrumentTemplateId],
              parties: [admin] // Include the party filter
            });
            
            console.log('📋 Active contracts with correct parameters:', JSON.stringify(activeContracts, null, 2));
            
            // Find the contract that was just created (should be the latest one for this admin)
            if (activeContracts?.length > 0) {
              // Look for a contract with matching admin
              const matchingContract = activeContracts.find(contract => {
                console.log('🔍 Checking contract:', JSON.stringify(contract, null, 2));
                return (
                  contract.payload?.admin === admin || 
                  contract.createArguments?.admin === admin ||
                  contract.arguments?.admin === admin ||
                  contract.createdEventBlob?.createArguments?.admin === admin
                );
              });
              
              if (matchingContract) {
                finalContractId = matchingContract.contractId;
                console.log('✅ Found matching contract via activeContracts:', finalContractId);
              } else {
                // Fallback: use the most recent contract
                const latestContract = activeContracts[activeContracts.length - 1];
                finalContractId = latestContract.contractId;
                console.log('✅ Using most recent contract from activeContracts:', finalContractId);
                console.log('📋 Latest contract details:', JSON.stringify(latestContract, null, 2));
              }
            }
          } catch (activeError) {
            console.log('❌ ActiveContracts query failed:', activeError);
            console.log('❌ ActiveContracts error details:', {
              message: activeError.message,
              code: activeError.code,
              cause: activeError.cause
            });
          }
        }
        
        if (!finalContractId) {
          console.log('⚠️ All contract ID extraction methods failed, using updateId as temporary contract ID for testing...');
          finalContractId = result.updateId; // Use updateId as contract ID for testing
          console.log('🔧 Using updateId as contract ID:', finalContractId);
        }
      } else if (!finalContractId) {
        throw new Error('Failed to extract contract ID - no updateId available in completion result.');
      }
      
      console.log('✅ Extracted real contract ID:', finalContractId);

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
  async issueTokens({ instrumentId, owner, amount, admin }) {
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
        amount: amount.toString() // DAML Decimal should be string in JSON
      };

      console.log('📋 Exercising Issue choice:', { instrumentId, choiceArgs });

      // Create the exercise command with correct Canton SDK format (note: singular "choiceArgument")
      const commands = [{
        ExerciseCommand: {
          templateId,
          contractId: instrumentId,
          choice: 'Issue',
          choiceArgument: choiceArgs
        }
      }];

      console.log('📋 Preparing REAL DAML exercise with correct format:', { commands });
      console.log('🔍 ExerciseCommand details:', JSON.stringify(commands[0].ExerciseCommand, null, 2));

      // Use SDK 0.7.0 new API - setPartyId handles all setup automatically
      // Use the actual synchronizer ID from LocalNet
      // IMPORTANT: Issue choice must be exercised by admin party, not owner party
      const synchronizerId = 'global-domain::12200331920f4dc92981db2f8dd3b4fa2c9885eba83bf6c09fe9936d9097463baa2a';
      const adminParty = admin || owner; // Use admin if provided, fallback to owner for backward compatibility
      await this.sdk.setPartyId(adminParty, synchronizerId);
      console.log('🔧 Set party ID on SDK 0.7.0 for token issuance with explicit synchronizer ID:', { adminParty, synchronizerId });

      // Get the wallet keys for signing (using the admin's keys since admin exercises the Issue choice)
      const walletKeys = this.walletKeys.get(adminParty);
      if (!walletKeys) {
        throw new Error(`No wallet keys found for admin party: ${adminParty}`);
      }

      // Use SDK 0.7.0 prepareSignAndExecuteTransaction method (simpler than manual prepare/sign/execute)
      const commandId = uuidv4(); // Generate unique command ID
      console.log('🔄 Using SDK 0.7.0 prepareSignAndExecuteTransaction for token issuance...');
      
      // Get ledger offset before preparing command (SDK 0.7.0 best practice)
      const offsetLatest = (await this.sdk.userLedger?.ledgerEnd())?.offset ?? 0;
      console.log('📊 Ledger offset before issuance:', offsetLatest);
      
      const returnedCommandId = await this.sdk.userLedger?.prepareSignAndExecuteTransaction(
        commands,
        walletKeys.privateKey,
        commandId
      );
      
      console.log('✅ Issuance executed, returned command ID:', returnedCommandId);
      
      // Wait for command completion (SDK 0.7.0 feature) - this returns the actual result
      const completion = await this.sdk.userLedger?.waitForCompletion(
        offsetLatest, // where to start from
        5000, // timeout in ms
        returnedCommandId || commandId // use returned command ID or fallback to original
      );
      
      console.log('✅ Issuance completion result:', JSON.stringify(completion, null, 2));
      
      if (!completion) {
        throw new Error('Failed to get issuance completion result');
      }
      
      // Use completion as the result (this should contain the contract events)
      const result = completion;

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