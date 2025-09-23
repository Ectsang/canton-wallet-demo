/**
 * Storage Service - Persistent wallet and token data
 * Handles localStorage operations for wallet keys, token info, and balances
 */

const STORAGE_KEYS = {
  WALLET: 'canton_wallet_data',
  TOKEN: 'canton_token_data',
  SETTINGS: 'canton_app_settings'
};

class StorageService {
  /**
   * Save wallet data to localStorage
   */
  saveWallet(walletData) {
    try {
      const dataToSave = {
        partyId: walletData.partyId,
        publicKey: walletData.publicKey,
        privateKey: walletData.privateKey, // In production, consider more secure storage
        fingerprint: walletData.fingerprint,
        partyHint: walletData.partyHint,
        createdAt: walletData.createdAt || new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEYS.WALLET, JSON.stringify(dataToSave));
      console.log('✅ Wallet data saved to localStorage');
      return true;
    } catch (error) {
      console.error('❌ Failed to save wallet data:', error);
      return false;
    }
  }

  /**
   * Load wallet data from localStorage
   */
  loadWallet() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WALLET);
      if (!stored) return null;
      
      const walletData = JSON.parse(stored);
      console.log('✅ Wallet data loaded from localStorage');
      return walletData;
    } catch (error) {
      console.error('❌ Failed to load wallet data:', error);
      return null;
    }
  }

  /**
   * Save token data to localStorage
   */
  saveToken(tokenData) {
    try {
      const dataToSave = {
        tokenId: tokenData.tokenId,
        contractId: tokenData.contractId,
        name: tokenData.name,
        symbol: tokenData.symbol,
        decimals: tokenData.decimals,
        admin: tokenData.admin,
        transactionId: tokenData.transactionId,
        createdAt: tokenData.createdAt || new Date().toISOString(),
        isRealContract: tokenData.isRealContract,
        templateId: tokenData.templateId,
        ledgerLocation: tokenData.ledgerLocation
      };
      
      localStorage.setItem(STORAGE_KEYS.TOKEN, JSON.stringify(dataToSave));
      console.log('✅ Token data saved to localStorage');
      return true;
    } catch (error) {
      console.error('❌ Failed to save token data:', error);
      return false;
    }
  }

  /**
   * Load token data from localStorage
   */
  loadToken() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!stored) return null;
      
      const tokenData = JSON.parse(stored);
      console.log('✅ Token data loaded from localStorage');
      return tokenData;
    } catch (error) {
      console.error('❌ Failed to load token data:', error);
      return null;
    }
  }

  /**
   * Save app settings
   */
  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      return false;
    }
  }

  /**
   * Load app settings
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('❌ Failed to load settings:', error);
      return {};
    }
  }

  /**
   * Clear all stored data
   */
  clearAll() {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('✅ All stored data cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear stored data:', error);
      return false;
    }
  }

  /**
   * Clear only wallet data
   */
  clearWallet() {
    try {
      localStorage.removeItem(STORAGE_KEYS.WALLET);
      console.log('✅ Wallet data cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear wallet data:', error);
      return false;
    }
  }

  /**
   * Clear only token data
   */
  clearToken() {
    try {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      console.log('✅ Token data cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear token data:', error);
      return false;
    }
  }

  /**
   * Check if wallet exists in storage
   */
  hasWallet() {
    return localStorage.getItem(STORAGE_KEYS.WALLET) !== null;
  }

  /**
   * Check if token exists in storage
   */
  hasToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN) !== null;
  }

  /**
   * Get storage usage info
   */
  getStorageInfo() {
    const wallet = this.loadWallet();
    const token = this.loadToken();
    const settings = this.loadSettings();
    
    return {
      hasWallet: !!wallet,
      hasToken: !!token,
      walletCreatedAt: wallet?.createdAt,
      walletLastUsed: wallet?.lastUsed,
      tokenCreatedAt: token?.createdAt,
      tokenSymbol: token?.symbol,
      settingsCount: Object.keys(settings).length
    };
  }
}

// Export singleton instance
export default new StorageService();
