/**
 * Frontend Canton Service - Browser-compatible API client
 * Makes HTTP requests to the backend instead of direct console commands
 */

class FrontendCantonService {
  constructor() {
    this.baseUrl = 'http://localhost:8899/api';
    this.partyId = null;
  }

  setPartyId(partyId) {
    this.partyId = partyId;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Frontend Canton Service...');
      
      // Test backend connectivity
      const response = await fetch(`${this.baseUrl}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Backend initialization failed: ${response.status}`);
      }

      console.log('✅ Frontend Canton Service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Frontend Canton Service:', error);
      throw error;
    }
  }

  /**
   * Connect to Canton Network (via backend)
   */
  async connectToNetwork() {
    try {
      console.log('🔄 Connecting to Canton Network via backend...');
      
      // Test DAML health endpoint to verify Canton connection
      const response = await fetch(`${this.baseUrl}/daml/health`);

      if (!response.ok) {
        throw new Error(`Canton Network connection failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Connected to Canton Network via backend:', result);
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Canton Network:', error);
      throw error;
    }
  }

  /**
   * Create external wallet (party) with cryptographic keys
   */
  async createExternalWallet(partyHint = 'demo-wallet') {
    try {
      console.log('🔄 Creating external wallet via backend API...', { partyHint });

      const response = await fetch(`${this.baseUrl}/daml/wallets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ partyHint })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wallet creation failed: ${response.status} - ${errorText}`);
      }

      const walletInfo = await response.json();

      // Set this as the current party for DAML operations
      this.setPartyId(walletInfo.partyId);

      console.log('✅ External wallet created via backend:', {
        partyId: walletInfo.partyId,
        fingerprint: walletInfo.fingerprint
      });

      return walletInfo;
    } catch (error) {
      console.error('❌ Failed to create external wallet:', error);
      throw error;
    }
  }

  /**
   * Create token using backend API
   */
  async createToken(name, symbol, decimals) {
    try {
      console.log('🔄 Creating token via backend API...', { name, symbol, decimals });
      
      if (!this.partyId) {
        throw new Error('No party ID set. Create a wallet first.');
      }

      const response = await fetch(`${this.baseUrl}/daml/instruments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin: this.partyId,
          name,
          symbol,
          decimals: parseInt(decimals)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token creation failed: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();

      console.log('✅ Token created successfully via backend:', tokenData);
      return {
        ...tokenData,
        tokenId: tokenData.contractId,
        name,
        symbol,
        decimals: parseInt(decimals),
        admin: this.partyId
      };
    } catch (error) {
      console.error('❌ Failed to create token:', error);
      throw error;
    }
  }

  /**
   * Mint tokens using backend API
   */
  async mintTokens(tokenId, amount) {
    try {
      console.log('🔄 Minting tokens via backend API...', { tokenId, amount });
      
      if (!this.partyId) {
        throw new Error('No party ID set. Create a wallet first.');
      }

      const response = await fetch(`${this.baseUrl}/daml/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instrumentId: tokenId,
          owner: this.partyId,
          amount: amount
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token minting failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Tokens minted successfully via backend:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to mint tokens:', error);
      throw error;
    }
  }

  /**
   * Get token balance using backend API
   */
  async getTokenBalance(partyId, tokenId) {
    try {
      console.log('🔄 Getting token balance via backend API...', { partyId, tokenId });
      
      const response = await fetch(`${this.baseUrl}/daml/balance/${encodeURIComponent(partyId)}/${encodeURIComponent(tokenId)}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Balance query failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const balance = result.balance || 0;
      
      console.log('✅ Token balance retrieved via backend:', balance);
      return balance;
    } catch (error) {
      console.error('❌ Failed to get token balance:', error);
      throw error;
    }
  }

}

export default FrontendCantonService;
