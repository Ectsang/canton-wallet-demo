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
window.Buffer = Buffer;

class CantonService {
  constructor() {
    this.sdk = null;
    this.keyPair = null;
    this.partyId = null;
    this.config = getConfig();
  }

  async initialize() {
    try {
      // Initialize the SDK with LocalNet configuration
      this.sdk = new WalletSDKImpl().configure({
        logger: console,
        authFactory: localNetAuthDefault,
        ledgerFactory: localNetLedgerDefault,
        topologyFactory: localNetTopologyDefault,
        tokenStandardFactory: localNetTokenStandardDefault,
      });

      console.log('Canton SDK initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Canton SDK:', error);
      throw error;
    }
  }

  async connectToNetwork() {
    try {
      // Connect to the ledger
      await this.sdk.connect();
      console.log('Connected to Canton Network ledger');

      // Connect to admin ledger
      await this.sdk.connectAdmin();
      console.log('Connected to admin ledger');

      // Connect to topology
      await this.sdk.connectTopology(this.config.SCAN_API_URL);
      console.log('Connected to topology service');

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

      // Prepare external party topology
      const preparedParty = await this.sdk.topology?.prepareExternalPartyTopology(
        this.keyPair.publicKey
      );
      console.log('Prepared external party topology');

      if (!preparedParty) {
        throw new Error('Failed to prepare external party');
      }

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

      this.partyId = allocatedParty.partyId;
      
      // Set the party ID in the SDK
      this.sdk.userLedger?.setPartyId(this.partyId);
      this.sdk.adminLedger?.setPartyId(this.partyId);

      console.log('Successfully created external wallet:', this.partyId);

      return {
        partyId: this.partyId,
        publicKey: this.keyPair.publicKey,
        fingerprint: preparedParty.fingerprint,
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

      // Create token using the Canton token standard
      // Note: The exact API might vary based on the SDK version
      const createTokenCommand = {
        tokenName,
        tokenSymbol,
        decimals,
        issuer: this.partyId,
      };

      // Prepare the command submission
      const prepareResponse = await this.sdk.userLedger?.prepareSubmission(
        createTokenCommand
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

      // Create mint command
      const mintCommand = {
        tokenId,
        amount,
        recipient: mintRecipient,
      };

      // Prepare the command submission
      const prepareResponse = await this.sdk.userLedger?.prepareSubmission(
        mintCommand
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

      // Query token balance
      const balance = await this.sdk.tokenStandard?.getBalance(
        this.partyId,
        tokenId
      );

      return balance || 0;
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

      // List all tokens for this party
      const tokens = await this.sdk.tokenStandard?.listTokens(this.partyId);
      return tokens || [];
    } catch (error) {
      console.error('Failed to list tokens:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export default new CantonService();