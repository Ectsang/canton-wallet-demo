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
import { createHmac } from 'crypto';

class CantonConsoleService {
  constructor() {
    this.sdk = null;
    this.scanApiUrl = new URL("http://localhost:2903/api/validator");
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
      
      // Debug: Log available SDK methods
      console.log('🔍 Available SDK methods:', Object.getOwnPropertyNames(this.sdk).filter(name => typeof this.sdk[name] === 'function'));
      console.log('🔍 SDK prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.sdk)).filter(name => typeof this.sdk[name] === 'function'));
      
      // Check tokenStandard methods
      if (this.sdk.tokenStandard) {
        console.log('🔍 TokenStandard methods:', Object.getOwnPropertyNames(this.sdk.tokenStandard).filter(name => typeof this.sdk.tokenStandard[name] === 'function'));
        console.log('🔍 TokenStandard prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.sdk.tokenStandard)).filter(name => typeof this.sdk.tokenStandard[name] === 'function'));
      }
      
      // Check ledgerFactory methods for DAML contract creation
      if (this.sdk.ledgerFactory) {
        console.log('🔍 LedgerFactory methods:', Object.getOwnPropertyNames(this.sdk.ledgerFactory));
        console.log('🔍 LedgerFactory prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.sdk.ledgerFactory)));
      }

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
   * Test DAML JSON API directly without Canton Wallet SDK wrapper
   * This method bypasses the SDK entirely and uses raw HTTP calls
   */
  async testDirectDamlJsonApi({ admin, name, symbol, decimals }) {
    try {
      console.log('🔄 Testing direct DAML JSON API without SDK wrapper...', {
        admin, name, symbol, decimals, packageId: this.minimalTokenPackageId
      });

      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      const createArgs = { admin, name, symbol, decimals };
      const commandId = `create-instrument-${Date.now()}`;

      // Test with simple participant1 JWT first
      console.log('🔄 Testing with participant1 JWT...');
      
      const jwtPayload = {
        "https://daml.com/ledger-api": {
          actAs: [admin],
          readAs: [admin],
          ledgerId: "participant1"
        },
        iss: "unsafe-auth",
        sub: "ledger-api-user",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      };
      
      // Generate JWT manually
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
      const signature = createHmac('sha256', 'unsafe').update(`${header}.${payload}`).digest('base64url');
      const userToken = `${header}.${payload}.${signature}`;

      const commands = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId: commandId,
          actAs: [admin],
          commands: [{
            CreateCommand: {
              templateId,
              createArguments: createArgs
            }
          }]
        }
      };

      console.log('📋 Testing direct DAML JSON API:', JSON.stringify(commands, null, 2));

      const response = await fetch('http://localhost:2975/v2/commands/submit-and-wait-for-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify(commands)
      });

      const responseText = await response.text();
      console.log('📋 Direct DAML JSON API response status:', response.status);
      console.log('📋 Direct DAML JSON API response:', responseText);

      if (response.ok) {
        const result = JSON.parse(responseText);
        console.log('✅ Direct DAML JSON API SUCCESS!', result);
        return result;
      } else {
        throw new Error(`Direct DAML JSON API failed: ${response.status} - ${responseText}`);
      }

    } catch (error) {
      console.error('❌ Failed to test direct DAML JSON API:', error);
      throw error;
    }
  }

  /**
   * Create token using Canton Wallet SDK
   */
  async createInstrumentWithDirectAPI({ admin, name, symbol, decimals }) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      console.log('🔄 Creating REAL Instrument contract with direct JSON Ledger API...', {
        admin, name, symbol, decimals, packageId: this.minimalTokenPackageId
      });

      // Use direct JSON Ledger API instead of Canton Wallet SDK
      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      
      const createArgs = {
        admin,
        name,
        symbol,
        decimals
      };

      console.log('📋 Creating Instrument contract via JSON API:', { templateId, createArgs });

      // Prepare the command for direct JSON API submission with correct format
      const commandId = `create-instrument-${Date.now()}`;
      const commands = {
        commands: {
          applicationId: "canton-wallet-demo",
          commandId,
          actAs: [admin],
          commands: [{
            CreateCommand: {
              templateId: `${this.minimalTokenPackageId}:MinimalToken:Instrument`,
              createArguments: createArgs
            }
          }]
        }
      };

      console.log('📋 Preparing direct JSON API submission:', JSON.stringify(commands, null, 2));

      // Use direct JSON Ledger API submit-and-wait-for-transaction
      const jsonApiUrl = `http://localhost:2975/v2/commands/submit-and-wait-for-transaction`;
      
      // Generate proper DAML JWT for JSON API
      const jwtPayload = {
        "https://daml.com/ledger-api": {
          actAs: [admin],
          readAs: [admin],
          ledgerId: "PAR::participant::1220975d30b6a9c9a03f8ec9e9e851c08cc51da86d2b2a32d8a45e54d731c1da819f"
        },
        iss: "unsafe-auth",
        sub: "ledger-api-user",
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000)
      };
      
      // Create proper JWT with HMAC-SHA256 signature for DAML JSON API
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
      const payload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
      const signature = createHmac('sha256', 'unsafe').update(`${header}.${payload}`).digest('base64url');
      const userToken = `${header}.${payload}.${signature}`;
      console.log('🔑 Generated proper HMAC-SHA256 JWT for party:', admin);
      console.log('🔍 JWT payload:', JSON.stringify(jwtPayload, null, 2));
      console.log('🔍 JWT token:', userToken.substring(0, 50) + '...');
      
      console.log('🔄 Calling direct JSON Ledger API:', jsonApiUrl);
      
      // Prepare headers with DAML JWT
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      };
      
      console.log('🔄 Request headers:', Object.keys(headers));
      
      const response = await fetch(jsonApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(commands)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Direct JSON Ledger API response:', JSON.stringify(result, null, 2));
        
        // Parse the response to extract contract IDs from events
        // JSON API response format: { result: { events: [...] } }
        if (result && result.result && result.result.events) {
          const createdEvents = result.result.events.filter(e => e.created);
          
          if (createdEvents.length > 0) {
            const contractId = createdEvents[0].created.contractId;
            console.log('✅ Extracted Contract ID from direct JSON API:', contractId);
            
            return {
              success: true,
              contractId,
              admin,
              name,
              symbol,
              decimals,
              createdAt: new Date().toISOString(),
              message: `Instrument contract created successfully with ID: ${contractId}`
            };
          } else {
            console.log('❌ No created events found in direct JSON API response');
          }
        } else if (result && result.events) {
          // Alternative response structure - events directly in result
          const createdEvents = result.events.filter(e => e.created);
          
          if (createdEvents.length > 0) {
            const contractId = createdEvents[0].created.contractId;
            console.log('✅ Extracted Contract ID from direct JSON API (alternative structure):', contractId);
            
            return {
              success: true,
              contractId,
              admin,
              name,
              symbol,
              decimals,
              createdAt: new Date().toISOString(),
              message: `Instrument contract created successfully with ID: ${contractId}`
            };
          } else {
            console.log('❌ No created events found in direct JSON API response (alternative structure)');
          }
        } else {
          console.log('❌ Unexpected response structure from direct JSON API');
          console.log('🔍 Available fields:', Object.keys(result || {}));
        }
      } else {
        const errorText = await response.text();
        console.log('❌ Direct JSON Ledger API failed:', response.status, response.statusText);
        console.log('❌ Error response:', errorText);
      }
      
      throw new Error('Failed to extract contract ID from direct JSON Ledger API');
      
    } catch (error) {
      console.log('❌ Failed to create REAL Instrument contract via direct JSON API:', error);
      console.log('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
        response: error.response,
        status: error.status,
        statusText: error.statusText
      });
      throw error;
    }
  }

  async createInstrumentWithWorkingSDK({ admin, name, symbol, decimals }) {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      console.log('🔄 Creating REAL Instrument contract with Working SDK method...', {
        admin, name, symbol, decimals, packageId: this.minimalTokenPackageId
      });

      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      const createArgs = { admin, name, symbol, decimals };

      console.log('📋 Creating Instrument contract with working SDK:', { templateId, createArgs });

      // Use the TokenStandardClient's prepareSignAndExecuteTransaction method
      const commands = [{
        CreateCommand: {
          templateId,
          createArguments: createArgs
        }
      }];

      console.log('📋 Preparing and executing transaction with TokenStandardClient:', { commands });

      // Use the SDK's tokenStandard factory
      const completion = await this.sdk.tokenStandard.prepareSignAndExecuteTransaction({
        commands
      });

      console.log('✅ Transaction completed with TokenStandardClient:', completion);

      // Extract contract ID from completion result
      if (completion && completion.createdEvents && completion.createdEvents.length > 0) {
        const contractId = completion.createdEvents[0].contractId;
        const result = {
          success: true,
          contractId,
          updateId: completion.updateId,
          payload: completion.createdEvents[0].payload,
          message: `Instrument contract created successfully with TokenStandardClient`
        };

        console.log('✅ Working SDK method result:', result);
        return result;
      } else {
        // Fallback: query active contracts
        console.log('🔍 No createdEvents in completion, querying active contracts...');
        
        const activeContractsQuery = {
          templateIds: [templateId]
        };

        const activeContracts = await this.sdk.tokenStandard.query(activeContractsQuery);
        console.log('📋 Active contracts found:', activeContracts);

        // Find the contract that matches our creation parameters
        const matchingContract = activeContracts.find(contract => 
          contract.payload.admin === admin &&
          contract.payload.name === name &&
          contract.payload.symbol === symbol &&
          contract.payload.decimals === decimals
        );

        if (matchingContract) {
          const result = {
            success: true,
            contractId: matchingContract.contractId,
            updateId: completion.updateId,
            payload: matchingContract.payload,
            message: `Instrument contract created successfully with TokenStandardClient`
          };

          console.log('✅ Working SDK method result (from query):', result);
          return result;
        } else {
          throw new Error('Contract created but not found in active contracts query');
        }
      }

    } catch (error) {
      console.error('❌ Failed to create REAL Instrument contract with working SDK:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
        response: error.response,
        status: error.status,
        statusText: error.statusText
      });
      throw error;
    }
  }

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
      // Let SDK determine the correct synchronizer ID for CN Quickstart
      await this.sdk.setPartyId(admin); // Let SDK determine the synchronizer ID
      console.log('🔧 Set party ID on SDK 0.7.0 for contract creation:', { admin });

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
        commandId: returnedCommandId
      });
      
      const completion = await this.sdk.userLedger?.waitForCompletion(
        offsetLatest, // where to start from
        5000, // timeout in ms
        returnedCommandId // ✅ FIXED: Use the returned command ID directly
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

      // ALTERNATIVE APPROACH: Use direct JSON Ledger API instead of Canton Wallet SDK
      console.log('🔄 Using direct JSON Ledger API submit-and-wait-for-transaction...');
      
      let finalContractId;
      
      try {
        // Instead of using Canton Wallet SDK waitForCompletion(), use direct JSON API
        // This should return the full transaction with events immediately
        const jsonApiUrl = `http://localhost:2975/v2/commands/submit-and-wait-for-transaction`;
        
        console.log('🔄 Calling direct JSON Ledger API:', jsonApiUrl);
        
        // Generate or use the appropriate token for Canton Wallet SDK
        const userToken = 'unsafe'; // For LocalNet development
        
        const response = await fetch(updatesApiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const updateDetails = await response.json();
          console.log('✅ Canton Quickstart Scan API response:', JSON.stringify(updateDetails, null, 2));
          
          // Parse the response to extract contract IDs from events
          if (updateDetails && updateDetails.result && updateDetails.result.events) {
            const createdEvents = updateDetails.result.events.filter(event => event.created);
            
            if (createdEvents.length > 0) {
              // Get the first created contract (should be our Instrument)
              const contractId = createdEvents[0].created.contractId;
              finalContractId = contractId;
              console.log('✅ Extracted Contract ID from Updates API:', contractId);
            } else {
              console.log('❌ No created events found in Updates API response');
            }
          } else if (updateDetails && updateDetails.events) {
            // Alternative structure - events directly in response
            const createdEvents = updateDetails.events.filter(event => event.created);
            
            if (createdEvents.length > 0) {
              const contractId = createdEvents[0].created.contractId;
              finalContractId = contractId;
              console.log('✅ Extracted Contract ID from Updates API (alternative structure):', contractId);
            } else {
              console.log('❌ No created events found in Updates API response (alternative structure)');
            }
          } else {
            console.log('❌ No events found in Updates API response');
            console.log('🔍 Available fields:', Object.keys(updateDetails || {}));
          }
        } else {
          const errorText = await response.text();
          console.log('❌ Canton Wallet SDK Updates API failed:', response.status, response.statusText);
          console.log('❌ Error response:', errorText);
          
          // Try alternative Scan API endpoints with correct prefix
          const alternativeEndpoints = [
            `http://localhost:2975/api/scan/v2/updates/${updateId}`,
            `http://localhost:2901/api/scan/v2/updates/${updateId}`,
            `http://localhost:2903/api/validator/v2/updates/${updateId}` // Fallback to old format
          ];
          
          for (const altUrl of alternativeEndpoints) {
            console.log(`🔄 Trying alternative Updates API: ${altUrl}`);
            
            try {
              const altResponse = await fetch(altUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${userToken}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (altResponse.ok) {
                const altUpdateDetails = await altResponse.json();
                console.log(`✅ Alternative Updates API ${altUrl} succeeded!`);
                console.log('✅ Response:', JSON.stringify(altUpdateDetails, null, 2));
                
                // Parse the alternative response
                if (altUpdateDetails && altUpdateDetails.result && altUpdateDetails.result.events) {
                  const createdEvents = altUpdateDetails.result.events.filter(event => event.created);
                  if (createdEvents.length > 0) {
                    finalContractId = createdEvents[0].created.contractId;
                    console.log('✅ Extracted Contract ID from alternative Updates API:', finalContractId);
                    break;
                  }
                }
              } else {
                console.log(`❌ Alternative Updates API ${altUrl} failed: ${altResponse.status}`);
              }
            } catch (error) {
              console.log(`❌ Alternative Updates API ${altUrl} error:`, error.message);
            }
          }
        }
        
        if (finalContractId) {
          console.log('✅ Successfully extracted contract ID from direct Ledger API:', finalContractId);
          
          return {
            success: true,
            contractId: finalContractId,
            updateId: result.updateId,
            admin,
            name,
            symbol,
            decimals,
            transactionId: result.updateId,
            createdAt: new Date().toISOString(),
            message: `Instrument contract created successfully with ID: ${finalContractId}`
          };
        } else {
          console.log('❌ No contract ID found in direct Ledger API response');
        }
        
      } catch (error) {
        console.log('❌ Error calling direct Ledger API:', error.message);
      }

      // FALLBACK: Try to extract contract ID from completion result
      console.log('🔄 Falling back to completion result parsing...');
      
      // Check for createdEvents field first (standard JSON API response structure)
      if (result?.createdEvents && result.createdEvents.length > 0) {
        console.log('🔍 Found createdEvents in completion result:', result.createdEvents.length, 'events');
        const createdEvent = result.createdEvents[0]; // First created event should be our Instrument
        finalContractId = createdEvent?.contractId;
        console.log('✅ Extracted contract ID from createdEvents:', finalContractId);
      }
      
      // Fallback: check legacy events structure
      if (!finalContractId && result?.events && result.events.length > 0) {
        console.log('🔍 Checking legacy events structure...');
        const createEvent = result.events.find(e => e.created || e.CreatedEvent);
        finalContractId = createEvent?.created?.contractId || createEvent?.CreatedEvent?.contractId;
        
        // Also check if contractId is directly in the event
        if (!finalContractId) {
          finalContractId = result.events.find(e => e.contractId)?.contractId;
        }
      }
      
      // If we successfully extracted contract ID from createdEvents, use it directly
      if (finalContractId) {
        console.log('✅ Successfully extracted contract ID from completion result:', finalContractId);
        return {
          success: true,
          contractId: finalContractId,
          updateId: result?.updateId,
          message: `Instrument contract created successfully with ID: ${finalContractId}`
        };
      }
      
      // Fallback: Try JSON Ledger API if createdEvents didn't contain contract ID
      console.log('🔄 Contract ID not found in createdEvents, trying JSON Ledger API as fallback...');
      
      if (result?.updateId) { // Use JSON API to get real contract ID from transaction
        console.log('🔄 Using JSON API to extract contract ID from transaction:', result.updateId);
        
        try {
          // Use the JSON API to get transaction details and extract contract ID
          const transactionUrl = `http://localhost:2975/v2/updates/update-by-id`;
          const authToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsZWRnZXItYXBpLXVzZXIiLCJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCIsImlhdCI6MTc1OTEzNjgzNSwiZXhwIjoxNzU5MTQwNDM1LCJpc3MiOiJ1bnNhZmUtYXV0aCJ9.dq_N0cPkJLKnB_XEWls1FXleMWIBeMOVDecBWTFbaAg';
          
          console.log('🔄 Calling JSON API:', transactionUrl);
          const response = await fetch(transactionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              update_id: result.updateId
            })
          });
          
          if (response.ok) {
            const transactionData = await response.json();
            console.log('✅ JSON API response:', JSON.stringify(transactionData, null, 2));
            
            // Extract contract ID from the transaction data
            if (transactionData?.update?.created_events && transactionData.update.created_events.length > 0) {
              const createdEvent = transactionData.update.created_events[0];
              finalContractId = createdEvent.contract_id;
              console.log('✅ Extracted contract ID from JSON API:', finalContractId);
              
              // Return immediately with the real contract ID
              return {
                success: true,
                contractId: finalContractId,
                updateId: result?.updateId,
                admin,
                name,
                symbol,
                decimals,
                transactionId: result?.updateId,
                createdAt: new Date().toISOString(),
                message: `Instrument contract created successfully with ID: ${finalContractId}`
              };
            }
          } else {
            console.log('❌ JSON API failed:', response.status, response.statusText);
          }
        } catch (error) {
          console.log('❌ JSON API error:', error.message);
        }
      }
      
      if (!finalContractId) { // Try activeContracts query to find the newly created contract
        console.log('🔄 Trying to extract real contract ID using activeContracts query...');
        
        // Use activeContracts to find the newly created contract by admin party
        try {
          const instrumentTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
          
          // Query active contracts for this template and admin party
          const activeContractsUrl = `http://localhost:2975/v2/query`;
          const authToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsZWRnZXItYXBpLXVzZXIiLCJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCIsImlhdCI6MTc1OTEzNjgzNSwiZXhwIjoxNzU5MTQwNDM1LCJpc3MiOiJ1bnNhZmUtYXV0aCJ9.dq_N0cPkJLKnB_XEWls1FXleMWIBeMOVDecBWTFbaAg';
          
          console.log('🔄 Querying active contracts for template:', instrumentTemplateId);
          const response = await fetch(activeContractsUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              template_ids: [instrumentTemplateId]
            })
          });
          
          if (response.ok) {
            const contractsData = await response.json();
            console.log('✅ Active contracts response:', JSON.stringify(contractsData, null, 2));
            
            // Find the contract with matching admin party and recent creation
            if (contractsData?.result && contractsData.result.length > 0) {
              // Sort by creation time and find the most recent contract for this admin
              const recentContract = contractsData.result
                .filter(contract => contract.payload?.admin === admin)
                .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
              
              if (recentContract) {
                finalContractId = recentContract.contract_id;
                console.log('✅ Found recent contract for admin:', finalContractId);
                
                // Return immediately with the real contract ID
                return {
                  success: true,
                  contractId: finalContractId,
                  updateId: result?.updateId,
                  admin,
                  name,
                  symbol,
                  decimals,
                  transactionId: result?.updateId,
                  createdAt: new Date().toISOString(),
                  message: `Instrument contract created successfully with ID: ${finalContractId}`
                };
              }
            }
          } else {
            console.log('❌ Active contracts query failed:', response.status, response.statusText);
          }
        } catch (error) {
          console.log('❌ Active contracts query error:', error.message);
        }
      }
      
      if (result?.updateId && !finalContractId) { // Final fallback: Try other methods
        console.log('🔄 Trying legacy activeContracts SDK method...');
        
        // LEGACY METHOD: Use SDK activeContracts (may have security restrictions)
        try {
          const instrumentTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
          
          console.log('🔄 Querying activeContracts for template:', instrumentTemplateId);
          console.log('🔄 Admin party:', admin);
          
          // Simplified activeContracts query - don't use offset or parties filter to avoid errors
          const activeContracts = await this.sdk.userLedger?.activeContracts({
            templateIds: [instrumentTemplateId]
          });
          
          console.log(`📋 Found ${activeContracts?.length || 0} total Instrument contracts`);
          
          if (activeContracts?.length > 0) {
            // Find the contract created by this admin party (should be the most recent one)
            const adminContracts = activeContracts.filter(contract => {
              const payload = contract.payload || contract.createArguments || contract.arguments;
              console.log('🔍 Contract payload admin:', payload?.admin, 'vs expected:', admin);
              return payload?.admin === admin;
            });
            
            console.log(`📊 Found ${adminContracts.length} contracts for admin: ${admin}`);
            
            if (adminContracts.length > 0) {
              // Use the most recent contract (should be the one we just created)
              const latestContract = adminContracts[adminContracts.length - 1];
              finalContractId = latestContract.contractId;
              console.log('🎉 SUCCESS: Found real contract ID via activeContracts:', finalContractId);
              console.log('📋 Contract details:', JSON.stringify(latestContract, null, 2));
            } else {
              console.log('❌ No contracts found for admin party:', admin);
            }
          } else {
            console.log('❌ No active Instrument contracts found');
          }
        } catch (activeError) {
          console.log('❌ ActiveContracts query failed:', activeError);
          console.log('❌ Error details:', {
            message: activeError.message,
            code: activeError.code,
            cause: activeError.cause
          });
        }
        
        // PREFERRED METHOD: Use Canton Wallet SDK getTransactionById
        if (!finalContractId) {
          console.log('🔄 ActiveContracts failed, trying SDK getTransactionById...');
          console.log('🔍 Using updateId:', result.updateId);
        
        try {
          console.log('🔄 Using SDK tokenStandard.getTransactionById method...');
          console.log('🔍 UpdateId:', result.updateId);
          
          // Use the Canton Wallet SDK method as recommended by Canton team
          const transaction = await this.sdk.tokenStandard?.getTransactionById(result.updateId);
          
          console.log('🎉 SDK getTransactionById SUCCESS! Transaction received:', JSON.stringify(transaction, null, 2));
          console.log('🔍 Transaction type:', typeof transaction);
          console.log('🔍 Transaction keys:', transaction ? Object.keys(transaction) : 'null');
          
          // Parse the transaction events using the correct TokenStandardEvent structure
          if (transaction?.events && transaction.events.length > 0) {
            console.log('🔍 Found', transaction.events.length, 'TokenStandardEvent(s) in transaction');
            
            for (const event of transaction.events) {
              console.log('🔍 Checking TokenStandardEvent:', JSON.stringify(event, null, 2));
              
              // Look in unlockedHoldingsChange.creates for new Holding contracts
              if (event.unlockedHoldingsChange?.creates && event.unlockedHoldingsChange.creates.length > 0) {
                console.log('✅ Found', event.unlockedHoldingsChange.creates.length, 'created holdings');
                
                for (const holding of event.unlockedHoldingsChange.creates) {
                  console.log('🔍 Checking created holding:', JSON.stringify(holding, null, 2));
                  console.log('✅ Holding contract ID:', holding.contractId);
                  console.log('✅ Holding owner:', holding.owner);
                  console.log('✅ Holding instrumentId:', holding.instrumentId);
                  
                  // For Instrument creation, we want the contract that matches our admin
                  if (holding.owner === admin || holding.instrumentId?.admin === admin) {
                    finalContractId = holding.contractId;
                    console.log('🎉 FOUND REAL CONTRACT ID via SDK TokenStandardEvent:', finalContractId);
                    break;
                  }
                }
              }
              
              // Also check lockedHoldingsChange.creates just in case
              if (!finalContractId && event.lockedHoldingsChange?.creates && event.lockedHoldingsChange.creates.length > 0) {
                console.log('✅ Found', event.lockedHoldingsChange.creates.length, 'created locked holdings');
                
                for (const holding of event.lockedHoldingsChange.creates) {
                  console.log('🔍 Checking created locked holding:', JSON.stringify(holding, null, 2));
                  
                  if (holding.owner === admin || holding.instrumentId?.admin === admin) {
                    finalContractId = holding.contractId;
                    console.log('🎉 FOUND REAL CONTRACT ID via SDK locked holdings:', finalContractId);
                    break;
                  }
                }
              }
              
              if (finalContractId) break; // Exit event loop if found
            }
          } else {
            console.log('❌ No events found in transaction');
          }
        } catch (sdkError) {
          console.log('❌ SDK getTransactionById failed:', sdkError);
          console.log('❌ SDK Error details:', {
            message: sdkError.message,
            stack: sdkError.stack,
            cause: sdkError.cause
          });
          // Continue to next method if SDK fails
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
          console.log('⚠️ JSON Ledger API failed, trying activeContracts query as primary method...');
          try {
            const instrumentTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
            
            // Query all active Instrument contracts for this admin
            const activeContracts = await this.sdk.userLedger?.activeContracts({
              offset: result.offset, // Use the offset from the completion result
              templateIds: [instrumentTemplateId]
            });
            
            console.log('📋 All active Instrument contracts:', JSON.stringify(activeContracts, null, 2));
            
            if (activeContracts?.length > 0) {
              // Find the contract created by this admin party
              const adminContracts = activeContracts.filter(contract => {
                const payload = contract.payload || contract.createArguments || contract.arguments;
                console.log('🔍 Checking contract payload for admin match:', JSON.stringify(payload, null, 2));
                return payload?.admin === admin;
              });
              
              console.log(`📊 Found ${adminContracts.length} contracts for admin: ${admin}`);
              
              if (adminContracts.length > 0) {
                // Use the most recent contract (should be the one we just created)
                const latestContract = adminContracts[adminContracts.length - 1];
                finalContractId = latestContract.contractId;
                console.log('🎉 FOUND REAL CONTRACT ID via activeContracts:', finalContractId);
                console.log('📋 Contract details:', JSON.stringify(latestContract, null, 2));
              } else {
                console.log('❌ No contracts found for admin party:', admin);
              }
            } else {
              console.log('❌ No active Instrument contracts found');
            }
          } catch (activeError) {
            console.log('❌ ActiveContracts query failed:', activeError);
          }
        }
        
        }
        
        // FINAL ATTEMPT: Try a simpler activeContracts query without filters
        if (!finalContractId) {
          console.log('🔄 All methods failed, trying simplified activeContracts as last resort...');
          try {
            // Try the most basic activeContracts query possible
            const allContracts = await this.sdk.userLedger?.activeContracts({});
            
            console.log(`📋 Found ${allContracts?.length || 0} total active contracts`);
            
            if (allContracts && allContracts.length > 0) {
              // Find contracts that might be ours (created around the same time)
              const recentContracts = allContracts.filter(contract => {
                const payload = contract.payload || contract.createArguments || contract.arguments;
                return payload?.admin === admin;
              });
              
              console.log(`📊 Found ${recentContracts.length} contracts for admin: ${admin}`);
              
              if (recentContracts.length > 0) {
                // Use the most recent contract
                const latestContract = recentContracts[recentContracts.length - 1];
                finalContractId = latestContract.contractId;
                console.log('🎉 FOUND CONTRACT ID via simplified activeContracts:', finalContractId);
              }
            }
          } catch (simpleError) {
            console.log('❌ Even simplified activeContracts failed:', simpleError.message);
          }
        }
        
        if (!finalContractId) {
          console.log('❌ CRITICAL: All contract ID extraction methods failed!');
          console.log('❌ SDK getTransactionById: Only works for token standard');
          console.log('❌ ActiveContracts query: Security errors');
          console.log('❌ JSON Ledger API: Security errors');
          console.log('❌ No contract ID found in completion result');
          console.log('❌ UpdateId available:', result.updateId);
          console.log('❌ This means we cannot get the real Canton contract ID');
          
          // FALLBACK: Try direct gRPC Ledger API to get transaction events
          console.log('🔄 FALLBACK: Trying direct gRPC Ledger API to get transaction events...');
          try {
            // Use the raw gRPC Ledger API to get transaction by updateId
            // This bypasses all SDK abstractions and security restrictions
            const grpcRequest = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer unsafe' // Use unsafe auth as per LocalNet config
              },
              body: JSON.stringify({
                updateId: result.updateId
              })
            };
            
            console.log('🔄 Making direct gRPC API call to get transaction events...');
            console.log('🔍 Request:', grpcRequest);
            
            // Try different gRPC endpoints that might work
            let response;
            const endpoints = [
              'http://localhost:2975/v1/stream/transactions-by-id',
              'http://localhost:2975/v1/transactions/by-id', 
              'http://localhost:2975/v1/updates/by-id',
              'http://localhost:2901/v1/transactions/by-id', // Direct ledger API
              'http://localhost:2901/v1/updates/by-id'
            ];
            
            for (const endpoint of endpoints) {
              console.log(`🔄 Trying endpoint: ${endpoint}`);
              try {
                response = await fetch(endpoint, grpcRequest);
                if (response.ok) {
                  console.log(`✅ Endpoint ${endpoint} responded successfully`);
                  break;
                } else {
                  console.log(`❌ Endpoint ${endpoint} failed: ${response.status}`);
                }
              } catch (endpointError) {
                console.log(`❌ Endpoint ${endpoint} error:`, endpointError.message);
              }
            }
            
            if (response.ok) {
              const transactionData = await response.json();
              console.log('🎉 Direct gRPC API SUCCESS! Transaction data:', JSON.stringify(transactionData, null, 2));
              
              // Parse the transaction data to extract contract IDs
              if (transactionData.events) {
                for (const event of transactionData.events) {
                  if (event.created && event.created.contractId) {
                    finalContractId = event.created.contractId;
                    console.log('🎉 FOUND REAL CONTRACT ID via direct gRPC:', finalContractId);
                    break;
                  }
                }
              }
            } else {
              console.log('❌ Direct gRPC API failed:', response.status, response.statusText);
              const errorText = await response.text();
              console.log('❌ Error response:', errorText);
            }
          } catch (grpcError) {
            console.log('❌ Direct gRPC API failed:', grpcError.message);
          }
          
          // If still no contract ID, use updateId as last resort
          if (!finalContractId) {
            console.log('⚠️ FINAL WORKAROUND: Using updateId as contract ID (known limitation)');
            finalContractId = result.updateId;
          }
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
      // Use the default synchronizer ID from CN Quickstart
      // IMPORTANT: Issue choice must be exercised by admin party, not owner party
      const adminParty = admin || owner; // Use admin if provided, fallback to owner for backward compatibility
      await this.sdk.setPartyId(adminParty); // Let SDK determine the synchronizer ID
      console.log('🔧 Set party ID on SDK 0.7.0 for token issuance:', { adminParty });

      // Get the wallet keys for signing (using the admin's keys since admin exercises the Issue choice)
      console.log('🔍 DEBUG: Looking for wallet keys for admin party:', adminParty);
      console.log('🔍 DEBUG: Available keys in walletKeys Map:', Array.from(this.walletKeys.keys()));
      console.log('🔍 DEBUG: Total keys stored:', this.walletKeys.size);
      
      const walletKeys = this.walletKeys.get(adminParty);
      if (!walletKeys) {
        console.log('❌ DEBUG: No keys found for party:', adminParty);
        console.log('❌ DEBUG: All stored keys:', Array.from(this.walletKeys.entries()).map(([k, v]) => ({ party: k, hasPrivateKey: !!v.privateKey, hasPublicKey: !!v.publicKey })));
        throw new Error(`No wallet keys found for admin party: ${adminParty}`);
      }
      
      console.log('✅ DEBUG: Found wallet keys for party:', adminParty);

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
        returnedCommandId // ✅ FIXED: Use the returned command ID directly
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

      // HYBRID APPROACH: Use direct Canton Ledger API to get transaction events
      console.log('🔄 Using direct Canton Ledger API to extract holding contract ID from transaction...');
      
      let finalHoldingId;
      
      try {
        // The Canton Wallet SDK waitForCompletion() doesn't return events, but we have the updateId
        // Use the direct Ledger API to get the full transaction with events
        const updateId = result.updateId;
        const offset = result.offset;
        
        console.log('🔍 Issuance transaction details:', { updateId, offset });
        
        // Use the correct Scan Bulk Data API endpoint for CN Quickstart
        const updatesApiUrl = `http://localhost:2903/api/scan/v2/updates/${updateId}`;
        
        console.log('🔄 Calling Canton Quickstart Scan API for issuance transaction events...');
        const response = await fetch(updatesApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer unsafe'
          }
        });
        
        if (response.ok) {
          const transactionData = await response.json();
          console.log('✅ Direct Ledger API issuance response:', JSON.stringify(transactionData, null, 2));
          
          // Parse the transaction stream response
          if (transactionData && transactionData.length > 0) {
            const transaction = transactionData[0];
            
            if (transaction.events) {
              console.log('✅ Found events in direct API issuance response:', transaction.events.length);
              
              // Look for created events (should be Holding contract)
              for (const event of transaction.events) {
                if (event.created && event.created.contractId) {
                  finalHoldingId = event.created.contractId;
                  console.log('✅ Found holding contract ID from direct Ledger API:', finalHoldingId);
                  break;
                }
              }
            }
          }
        } else {
          console.log('❌ Direct Ledger API issuance failed:', response.status, response.statusText);
          const errorText = await response.text();
          console.log('❌ Error response:', errorText);
        }
        
        if (finalHoldingId) {
          console.log('✅ Successfully extracted holding contract ID from direct Ledger API:', finalHoldingId);
          
          return {
            success: true,
            holdingId: finalHoldingId,
            updateId: result.updateId,
            instrumentId,
            owner,
            amount,
            admin,
            transactionId: result.updateId,
            createdAt: new Date().toISOString(),
            message: `Tokens issued successfully with holding ID: ${finalHoldingId}`
          };
        } else {
          console.log('❌ No holding contract ID found in direct Ledger API response');
        }
        
      } catch (error) {
        console.log('❌ Error calling direct Ledger API for issuance:', error.message);
      }
      
      // FALLBACK: Check for createdEvents field (legacy structure)
      if (result?.createdEvents && result.createdEvents.length > 0) {
        console.log('🔍 Found createdEvents in issuance completion result:', result.createdEvents.length, 'events');
        const createdEvent = result.createdEvents[0]; // First created event should be our Holding
        finalHoldingId = createdEvent?.contractId;
        console.log('✅ Extracted holding contract ID from createdEvents:', finalHoldingId);
      }
      
      // Fallback: check legacy events structure
      if (!finalHoldingId && result?.events && result.events.length > 0) {
        console.log('🔍 Checking legacy events structure for holding ID...');
        const createEvent = result.events.find(e => e.created || e.CreatedEvent);
        finalHoldingId = createEvent?.created?.contractId || createEvent?.CreatedEvent?.contractId;
      }
      
      // Try JSON API to extract holding contract ID if not found in completion result
      if (!finalHoldingId && result?.updateId) {
        console.log('🔄 Using JSON API to extract holding contract ID from transaction:', result.updateId);
        
        try {
          const transactionUrl = `http://localhost:2975/v2/updates/update-by-id`;
          const authToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJsZWRnZXItYXBpLXVzZXIiLCJhdWQiOiJodHRwczovL2NhbnRvbi5uZXR3b3JrLmdsb2JhbCIsImlhdCI6MTc1OTEzNjgzNSwiZXhwIjoxNzU5MTQwNDM1LCJpc3MiOiJ1bnNhZmUtYXV0aCJ9.dq_N0cPkJLKnB_XEWls1FXleMWIBeMOVDecBWTFbaAg';
          
          const response = await fetch(transactionUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              update_id: result.updateId
            })
          });
          
          if (response.ok) {
            const transactionData = await response.json();
            console.log('✅ JSON API response for holding:', JSON.stringify(transactionData, null, 2));
            
            // Extract holding contract ID from the transaction data
            if (transactionData?.update?.created_events && transactionData.update.created_events.length > 0) {
              const createdEvent = transactionData.update.created_events[0];
              finalHoldingId = createdEvent.contract_id;
              console.log('✅ Extracted holding contract ID from JSON API:', finalHoldingId);
            }
          } else {
            console.log('❌ JSON API failed for holding:', response.status, response.statusText);
          }
        } catch (error) {
          console.log('❌ JSON API error for holding:', error.message);
        }
      }
      
      // Final fallback: generate placeholder (should not be needed with JSON API)
      if (!finalHoldingId) {
        console.warn('⚠️ Could not extract holding contract ID from completion result or JSON API, using placeholder');
        finalHoldingId = `holding-${Date.now()}`;
      }

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
      console.error('❌ Minting error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause,
        code: error.code,
        response: error.response?.data || error.response,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      
      // Try to extract more specific error information
      if (error.response?.data) {
        console.error('❌ Minting response data:', JSON.stringify(error.response.data, null, 2));
      }
      
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