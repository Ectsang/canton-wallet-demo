import { 
  WalletSDKImpl, 
  createKeyPair,
  signTransactionHash,
  localNetAuthDefault,
  localNetLedgerDefault,
  localNetTopologyDefault,
  localNetTokenStandardDefault
} from '@canton-network/wallet-sdk';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import { getConfig } from './config';

// Make Buffer available globally for the SDK
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Removed custom factory functions - using SDK defaults instead

class CantonService {
  constructor() {
    this.sdk = null;
    this.keyPair = null;
    this.partyId = null;
    this.config = getConfig();
  }

  async initialize() {
    try {
      // Check if we're in real integration test mode
      const isRealIntegrationTest = process.env.RUN_REAL_INTEGRATION_TESTS === 'true';
      
      if (isRealIntegrationTest && this.config.SCAN_API_URL) {
        console.log('Initializing Canton SDK for real LocalNet connection');
        
        // Configure SDK with LocalNet defaults (similar to the working examples)
        this.sdk = new WalletSDKImpl().configure({
          logger: console,
          authFactory: localNetAuthDefault,
          ledgerFactory: localNetLedgerDefault,
          topologyFactory: localNetTopologyDefault,
          tokenStandardFactory: localNetTokenStandardDefault,
        });
        
        console.log('SDK configured with local defaults');
        
        // Connect to the ledger first
        await this.sdk.connect();
        console.log('Connected to user ledger');
        
        // Connect to admin ledger
        await this.sdk.connectAdmin();
        console.log('Connected to admin ledger');
        
        // Connect to topology using the SCAN API URL
        const scanUrl = new URL(this.config.SCAN_API_URL);
        await this.sdk.connectTopology(scanUrl);
        console.log('Connected to topology via SCAN API');
        
        console.log('Canton SDK fully initialized and connected');
      } else {
        console.log('Initializing Canton SDK (will be mocked in unit tests)');
        
        // Configure SDK normally - mocks will intercept if in test environment
        this.sdk = new WalletSDKImpl().configure({
          logger: console,
          authFactory: localNetAuthDefault,
          ledgerFactory: localNetLedgerDefault,
          topologyFactory: localNetTopologyDefault,
          tokenStandardFactory: localNetTokenStandardDefault,
        });
        
        // Connect to services (will be mocked in unit tests)
        await this.sdk.connect();
        await this.sdk.connectAdmin();
        
        // For non-real tests, we don't need to connect to topology
        // as it will be mocked anyway
        console.log('SDK configured (mocked in unit tests)');
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize Canton SDK:', error);
      throw error;
    }
  }

  async connectToNetwork() {
    try {
      // For LocalNet with unsafe auth, the controllers are already configured
      // We just need to verify they're working
      console.log('Canton Network controllers are ready');
      return true;
    } catch (error) {
      console.error('Failed to connect to Canton Network:', error);
      throw error;
    }
  }

  async createExternalWallet(partyHint) {
    try {
      // Generate a new key pair
      this.keyPair = createKeyPair();
      console.log('Generated new key pair');

      // Prepare external party topology - SDK expects base64 string
      const preparedParty = await this.sdk.topology?.prepareExternalPartyTopology(
        this.keyPair.publicKey,
        partyHint
      );

      if (!preparedParty) {
        throw new Error('Failed to prepare external party');
      }

      console.log('Prepared party keys:', Object.keys(preparedParty));
      console.log('Party ID:', preparedParty.partyId);
      console.log('Fingerprint:', preparedParty.fingerprint);
      console.log('Combined hash:', preparedParty.combinedHash);

      // Sign the combined hash
      const base64StringCombinedHash = Buffer.from(
        preparedParty.combinedHash,
        'hex'
      ).toString('base64');
      
      const signedHash = signTransactionHash(
        base64StringCombinedHash,
        this.keyPair.privateKey
      );

      // Submit the external party topology
      const allocatedParty = await this.sdk.topology?.submitExternalPartyTopology(
        signedHash,
        preparedParty
      );

      if (!allocatedParty) {
        throw new Error('Failed to allocate party');
      }

      // The party ID is in preparedParty, not allocatedParty
      this.partyId = preparedParty.partyId;
      
      // Set the party ID in the SDK
      this.sdk.userLedger?.setPartyId(this.partyId);
      this.sdk.adminLedger?.setPartyId(this.partyId);
      this.sdk.tokenStandard?.setPartyId(this.partyId);

      console.log('Successfully created external wallet:', this.partyId);
      console.log('Allocated party details:', allocatedParty);

      return {
        partyId: this.partyId,
        publicKey: this.keyPair.publicKey,
        fingerprint: preparedParty.fingerprint || preparedParty.namespace || 'N/A',
      };
    } catch (error) {
      console.error('Failed to create external wallet:', error);
      throw error;
    }
  }

  async createToken(tokenName, tokenSymbol, decimals = 2) {
    try {
      if (!this.partyId) {
        throw new Error('No wallet created yet');
      }

      // Create token using DAML command structure
      const createTokenCommand = {
        CreateCommand: {
          // This is a placeholder template ID - you'll need the actual token template from your DAML model
          templateId: 'Token:Token',
          createArguments: {
            issuer: this.partyId,
            name: tokenName,
            symbol: tokenSymbol,
            decimals: decimals.toString(),
            totalSupply: '0',
            metadata: {
              values: {
                name: tokenName,
                symbol: tokenSymbol,
                decimals: decimals.toString()
              }
            }
          },
        },
      };

      // Prepare the command submission - SDK expects array of commands
      const prepareResponse = await this.sdk.userLedger?.prepareSubmission(
        [createTokenCommand]
      );

      if (!prepareResponse) {
        throw new Error('Failed to prepare token creation command');
      }

      // Sign the transaction
      const signedCommandHash = signTransactionHash(
        prepareResponse.preparedTransactionHash,
        this.keyPair.privateKey
      );

      // Submit the command
      const result = await this.sdk.userLedger?.executeSubmission(
        prepareResponse,
        signedCommandHash,
        this.keyPair.publicKey,
        uuidv4()
      );

      console.log('Token created successfully:', result);
      return result;
    } catch (error) {
      console.error('Failed to create token:', error);
      throw error;
    }
  }

  async mintTokens(tokenId, amount, recipient = null) {
    try {
      if (!this.partyId) {
        throw new Error('No wallet created yet');
      }

      const mintRecipient = recipient || this.partyId;

      // Create mint command using DAML structure
      const mintCommand = {
        ExerciseCommand: {
          // This is a placeholder - you need the actual contract ID and choice name
          contractId: tokenId,
          templateId: 'Token:Token',
          choice: 'Mint',
          choiceArgument: {
            recipient: mintRecipient,
            amount: amount.toString(),
          },
        },
      };

      // Prepare the command submission - SDK expects array of commands
      const prepareResponse = await this.sdk.userLedger?.prepareSubmission(
        [mintCommand]
      );

      if (!prepareResponse) {
        throw new Error('Failed to prepare mint command');
      }

      // Sign the transaction
      const signedCommandHash = signTransactionHash(
        prepareResponse.preparedTransactionHash,
        this.keyPair.privateKey
      );

      // Submit the command
      const result = await this.sdk.userLedger?.executeSubmission(
        prepareResponse,
        signedCommandHash,
        this.keyPair.publicKey,
        uuidv4()
      );

      console.log('Tokens minted successfully:', result);
      return result;
    } catch (error) {
      console.error('Failed to mint tokens:', error);
      throw error;
    }
  }

  async getTokenBalance(tokenId) {
    try {
      if (!this.partyId) {
        throw new Error('No wallet created yet');
      }

      // Query token balance by listing holdings
      const holdings = await this.sdk.tokenStandard?.listHoldingUtxos();
      
      if (!holdings) {
        return 0;
      }

      // Sum up holdings for the specific token
      const tokenHoldings = holdings.filter(h => h.argument?.instrument?.instrumentId === tokenId);
      const balance = tokenHoldings.reduce((sum, h) => sum + (parseInt(h.argument?.amount || '0')), 0);

      return balance;
    } catch (error) {
      console.error('Failed to get token balance:', error);
      throw error;
    }
  }

  async listTokens() {
    try {
      if (!this.partyId) {
        throw new Error('No wallet created yet');
      }

      // List all holdings to get unique tokens
      const holdings = await this.sdk.tokenStandard?.listHoldingUtxos();
      
      if (!holdings) {
        return [];
      }

      // Extract unique token IDs
      const tokenSet = new Set();
      holdings.forEach(h => {
        if (h.argument?.instrument?.instrumentId) {
          tokenSet.add(h.argument.instrument.instrumentId);
        }
      });

      return Array.from(tokenSet);
    } catch (error) {
      console.error('Failed to list tokens:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export default new CantonService();