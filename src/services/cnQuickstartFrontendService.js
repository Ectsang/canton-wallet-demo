/**
 * CN Quickstart Frontend Service - Browser-compatible API client
 * Makes HTTP requests to the backend CN Quickstart routes
 */

class CNQuickstartFrontendService {
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8899';
    this.apiPrefix = '/api/cn';
    this.damlApiPrefix = '/api/daml';
    this.isInitialized = false;
    this.appProviderParty = null;
  }

  /**
   * Initialize the CN Quickstart connection
   */
  async initialize() {
    try {
      console.log('🔄 Initializing CN Quickstart connection...');

      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`CN Quickstart initialization failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        this.isInitialized = true;
        this.appProviderParty = result.appProviderParty;
        console.log('✅ CN Quickstart initialized:', result);
        return result;
      } else {
        throw new Error(result.message || 'Initialization failed');
      }
    } catch (error) {
      console.error('❌ Failed to initialize CN Quickstart:', error);
      throw error;
    }
  }

  /**
   * Check connection status
   */
  async getStatus() {
    try {
      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/status`);
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      throw error;
    }
  }

  /**
   * Create external wallet using CN Quickstart wallet endpoint
   */
  async createExternalWallet(partyHint = 'demo-wallet') {
    try {
      console.log('🔄 Creating external wallet (CN Quickstart)...', { partyHint });

      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/wallets/create`, {
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
      console.log('✅ External wallet created (CN Quickstart):', {
        partyId: walletInfo.partyId,
        partyHint: walletInfo.partyHint
      });

      return walletInfo;
    } catch (error) {
      console.error('❌ Failed to create external wallet:', error);
      throw error;
    }
  }

  /**
   * Create token using CN Quickstart App Provider
   */
  async createToken(name, symbol, decimals) {
    try {
      console.log('🔄 Creating token via CN Quickstart...', { name, symbol, decimals });
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/tokens/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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

      if (tokenData.success) {
        console.log('✅ Token created successfully:', tokenData);
        return {
          ...tokenData,
          tokenId: tokenData.contractId,
          isRealContract: true
        };
      } else {
        throw new Error(tokenData.message || 'Token creation failed');
      }
    } catch (error) {
      console.error('❌ Failed to create token:', error);
      throw error;
    }
  }

  /**
   * Mint tokens to external wallet
   */
  async mintTokens(contractId, owner, amount) {
    try {
      console.log('🔄 Minting tokens via CN Quickstart...', { contractId, owner, amount });
      
      if (!this.isInitialized) {
        await this.initialize();
      }

      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/tokens/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractId,
          owner,
          amount: amount.toString()
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token minting failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Tokens minted successfully:', result);
        return result;
      } else {
        throw new Error(result.message || 'Minting failed');
      }
    } catch (error) {
      console.error('❌ Failed to mint tokens:', error);
      throw error;
    }
  }

  /**
   * Query HoldingProposals for a wallet
   */
  async getProposals(owner) {
    try {
      console.log('🔄 Querying proposals via CN Quickstart...', { owner });

      if (!this.isInitialized) {
        await this.initialize();
      }

      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/proposals/${encodeURIComponent(owner)}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proposal query failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Proposals queried successfully:', result);
        return result;
      } else {
        throw new Error(result.message || 'Query failed');
      }
    } catch (error) {
      console.error('❌ Failed to query proposals:', error);
      throw error;
    }
  }

  /**
   * Accept a HoldingProposal to create Holding
   */
  async acceptProposal(proposalId, owner) {
    try {
      console.log('🔄 Accepting proposal via CN Quickstart...', { proposalId, owner });

      if (!this.isInitialized) {
        await this.initialize();
      }

      const response = await fetch(`${this.baseUrl}${this.apiPrefix}/proposals/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          proposalId,
          owner
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proposal accept failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Proposal accepted successfully:', result);
        return result;
      } else {
        throw new Error(result.message || 'Accept failed');
      }
    } catch (error) {
      console.error('❌ Failed to accept proposal:', error);
      throw error;
    }
  }

  /**
   * Get token balance for wallet
   */
  async getTokenBalance(owner, instrumentId = null) {
    try {
      console.log('🔄 Getting token balance via CN Quickstart...', { owner, instrumentId });

      if (!this.isInitialized) {
        await this.initialize();
      }

      const url = new URL(`${this.baseUrl}${this.apiPrefix}/balance/${encodeURIComponent(owner)}`);
      if (instrumentId) {
        url.searchParams.append('instrumentId', instrumentId);
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Balance query failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log('✅ Token balance retrieved:', result);
        return result;
      } else {
        throw new Error(result.message || 'Balance query failed');
      }
    } catch (error) {
      console.error('❌ Failed to get token balance:', error);
      throw error;
    }
  }
}

export default CNQuickstartFrontendService;
