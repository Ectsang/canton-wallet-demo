import React, { useState, useEffect } from 'react';
import CNQuickstartFrontendService from './services/cnQuickstartFrontendService';
import storageService from './services/storageService';

// CN Quickstart integration using direct JSON Ledger API via backend
const cantonService = new CNQuickstartFrontendService();
console.log('🎯 CN Quickstart Integration: Frontend calling backend for direct JSON Ledger API');

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Wallet state
  const [wallet, setWallet] = useState(null);
  const [partyHint, setPartyHint] = useState('quickstart-e-1');
  
  // Token state
  const [tokenName, setTokenName] = useState('Demo Token');
  const [tokenSymbol, setTokenSymbol] = useState('DEMO');
  const [tokenDecimals, setTokenDecimals] = useState(2);
  const [createdToken, setCreatedToken] = useState(null);
  
  // Mint state
  const [mintAmount, setMintAmount] = useState(1000);
  const [tokenBalance, setTokenBalance] = useState(0);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Initialize CN Quickstart connection
      const initResult = await cantonService.initialize();
      setIsInitialized(true);
      setIsConnected(true);
      
      // Load existing wallet and token data
      await loadExistingData();
      
      setSuccess(`Connected to CN Quickstart: ${initResult.appProviderParty}`);
    } catch (err) {
      setError(`Failed to initialize CN Quickstart: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingData = async () => {
    try {
      // Load wallet from localStorage
      const savedWallet = storageService.loadWallet();
      if (savedWallet) {
        setWallet(savedWallet);
        setPartyHint(savedWallet.partyHint || 'quickstart-e-1');
        console.log('✅ Loaded existing wallet from storage');
      }

      // Load token from localStorage
      const savedToken = storageService.loadToken();
      if (savedToken) {
        setCreatedToken(savedToken);
        setTokenName(savedToken.name);
        setTokenSymbol(savedToken.symbol);
        setTokenDecimals(savedToken.decimals);
        console.log('✅ Loaded existing token from storage');
        
        // If we have both wallet and token, load the current balance
        if (savedWallet && savedToken) {
          await loadTokenBalance(savedWallet.partyId, savedToken.tokenId);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load existing data:', error);
    }
  };

  const loadTokenBalance = async (partyId, tokenId) => {
    try {
      const result = await cantonService.getTokenBalance(partyId, tokenId);
      if (result.success && result.holdings.length > 0) {
        const totalBalance = result.totalBalance || 0;
        setTokenBalance(totalBalance);
        console.log('✅ Loaded current token balance:', totalBalance);
      } else {
        setTokenBalance(0);
      }
    } catch (error) {
      console.error('❌ Failed to load token balance:', error);
      setTokenBalance(0);
    }
  };

  const checkStatus = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const status = await cantonService.getStatus();
      if (status.connected) {
        setIsConnected(true);
        setSuccess(`Connected to CN Quickstart: ${status.appProviderParty}`);
      } else {
        setIsConnected(false);
        setError('Not connected to CN Quickstart');
      }
    } catch (err) {
      setError(`Failed to check status: ${err.message}`);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const walletInfo = await cantonService.createExternalWallet(partyHint);
      
      // Add party hint to wallet info
      const walletWithHint = { ...walletInfo, partyHint };
      
      setWallet(walletWithHint);
      
      // Save wallet to localStorage
      storageService.saveWallet(walletWithHint);
      
      setSuccess('External wallet created and saved successfully');
    } catch (err) {
      setError(`Failed to create wallet: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      const token = await cantonService.createToken(
        tokenName,
        tokenSymbol,
        parseInt(tokenDecimals)
      );
      
      setCreatedToken(token);
      
      // Save token to localStorage
      storageService.saveToken(token);
      
      setSuccess(`Token created successfully: ${token.contractId}`);
    } catch (err) {
      setError(`Failed to create token: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const mintTokens = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      if (!createdToken) {
        throw new Error('No token created yet');
      }
      
      if (!wallet) {
        throw new Error('No wallet created yet');
      }
      
      // Mint tokens to the wallet using CN Quickstart
      const result = await cantonService.mintTokens(
        createdToken.contractId,
        wallet.partyId,
        parseFloat(mintAmount)
      );
      
      setSuccess(`Successfully minted ${mintAmount} ${tokenSymbol} tokens (Holding: ${result.holdingId})`);
      
      // Update balance
      await updateBalance();
    } catch (err) {
      setError(`Failed to mint tokens: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateBalance = async () => {
    try {
      if (!createdToken || !wallet) return;
      
      const result = await cantonService.getTokenBalance(
        wallet.partyId,
        createdToken.contractId
      );
      
      if (result.success) {
        setTokenBalance(result.totalBalance || 0);
      } else {
        setTokenBalance(0);
      }
    } catch (err) {
      console.error('Failed to update balance:', err);
      setTokenBalance(0);
    }
  };

  const clearAllData = () => {
    if (window.confirm('Are you sure you want to clear all wallet and token data? This cannot be undone.')) {
      storageService.clearAll();
      setWallet(null);
      setCreatedToken(null);
      setTokenBalance(0);
      setPartyHint('my-wallet-demo');
      setTokenName('Demo Token');
      setTokenSymbol('DEMO');
      setTokenDecimals(2);
      setMintAmount(1000);
      setIsConnected(false);
      setSuccess('All data cleared successfully');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccess(`${label} copied to clipboard`);
      setTimeout(() => setSuccess(''), 2000);
    }).catch(() => {
      setError('Failed to copy to clipboard');
    });
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Canton Wallet Demo</h1>
        <p>Create an external wallet and mint tokens using CN Quickstart LocalNet</p>
        <div className="mode-indicator real">
          <span>🚀 <strong>CN QUICKSTART</strong> - Direct JSON Ledger API Integration</span>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* CN Quickstart Initialization */}
      <div className="card">
        <h2>1. CN Quickstart Connection</h2>
        {!isInitialized ? (
          <p>Connecting to CN Quickstart LocalNet...</p>
        ) : (
          <>
            <p>✅ Connected to CN Quickstart LocalNet</p>
            {isConnected && (
              <button 
                className="button secondary" 
                onClick={checkStatus}
                disabled={loading}
              >
                Check Status
                {loading && <span className="loading"></span>}
              </button>
            )}
          </>
        )}
      </div>

      {/* Wallet Creation */}
      {isConnected && (
        <div className="card">
          <h2>2. Create External Wallet</h2>
          {!wallet ? (
            <>
              <div className="form-group">
                <label htmlFor="party-hint">Party Hint (optional identifier)</label>
                <input
                  id="party-hint"
                  type="text"
                  value={partyHint}
                  onChange={(e) => setPartyHint(e.target.value)}
                  placeholder="my-wallet-1"
                />
              </div>
              <button 
                className="button" 
                onClick={createWallet}
                disabled={loading}
              >
                Create External Wallet
                {loading && <span className="loading"></span>}
              </button>
            </>
          ) : (
            <div className="info-box">
              <h3>Wallet Details {wallet.createdAt && <span style={{fontSize: '0.8em', color: '#666'}}>({new Date(wallet.createdAt).toLocaleString()})</span>}</h3>
              
              <div className="wallet-detail">
                <strong>Party Hint:</strong> {wallet.partyHint || 'N/A'}
              </div>
              
              <div className="wallet-detail">
                <strong>Party ID:</strong> 
                <div className="copyable-field">
                  <code className="party-id">{wallet.partyId}</code>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(wallet.partyId, 'Party ID')}
                    title="Copy Party ID"
                  >
                    📋
                  </button>
                </div>
              </div>
              
              <div className="wallet-detail">
                <strong>Public Key:</strong>
                <div className="copyable-field">
                  <code className="public-key">{wallet.publicKey}</code>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(wallet.publicKey, 'Public Key')}
                    title="Copy Public Key"
                  >
                    📋
                  </button>
                </div>
              </div>
              
              <div className="wallet-detail">
                <strong>Private Key:</strong>
                <div className="copyable-field">
                  <code className="private-key">{wallet.privateKey}</code>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(wallet.privateKey, 'Private Key')}
                    title="Copy Private Key"
                  >
                    📋
                  </button>
                </div>
              </div>
              
              <div className="wallet-detail">
                <strong>Fingerprint:</strong> <code>{wallet.fingerprint}</code>
              </div>
              
              <div className="wallet-actions">
                <button 
                  className="button danger small" 
                  onClick={clearAllData}
                  title="Clear all stored data"
                >
                  🗑️ Clear All Data
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Token Creation */}
      {wallet && (
        <div className="card">
          <h2>3. Create Token</h2>
          {!createdToken ? (
            <>
              <div className="form-group">
                <label htmlFor="token-name">Token Name</label>
                <input
                  id="token-name"
                  type="text"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  placeholder="Demo Token"
                />
              </div>
              <div className="form-group">
                <label htmlFor="token-symbol">Token Symbol</label>
                <input
                  id="token-symbol"
                  type="text"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  placeholder="DEMO"
                />
              </div>
              <div className="form-group">
                <label htmlFor="token-decimals">Decimals</label>
                <input
                  id="token-decimals"
                  type="number"
                  value={tokenDecimals}
                  onChange={(e) => setTokenDecimals(e.target.value)}
                  min="0"
                  max="18"
                />
              </div>
              <button 
                className="button secondary" 
                onClick={createToken}
                disabled={loading}
              >
                Create Token
                {loading && <span className="loading"></span>}
              </button>
            </>
          ) : (
            <div className="info-box">
              <h3>Token Details {createdToken.createdAt && <span style={{fontSize: '0.8em', color: '#666'}}>({new Date(createdToken.createdAt).toLocaleString()})</span>}</h3>
              
              <div className="token-detail">
                <strong>Token Name:</strong> {createdToken.name}
              </div>
              
              <div className="token-detail">
                <strong>Token Symbol:</strong> <code>{createdToken.symbol}</code>
              </div>
              
              <div className="token-detail">
                <strong>Decimals:</strong> {createdToken.decimals}
              </div>
              
              <div className="token-detail">
                <strong>Token ID:</strong>
                <div className="copyable-field">
                  <code className="token-id">{createdToken.tokenId}</code>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(createdToken.tokenId, 'Token ID')}
                    title="Copy Token ID"
                  >
                    📋
                  </button>
                </div>
              </div>
              
              <div className="token-detail">
                <strong>Contract ID:</strong>
                <div className="copyable-field">
                  <code className="contract-id">{createdToken.contractId || createdToken.tokenId}</code>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(createdToken.contractId || createdToken.tokenId, 'Contract ID')}
                    title="Copy Contract ID"
                  >
                    📋
                  </button>
                </div>
              </div>
              
              <div className="token-detail">
                <strong>Admin:</strong> <code className="admin-id">{createdToken.admin}</code>
              </div>
              
              {createdToken.isRealContract && (
                <div className="token-status">
                  ✅ <strong>Real DAML Contract</strong> - This token exists on Canton ledger
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Token Minting */}
      {createdToken && (
        <div className="card">
          <h2>4. Mint Tokens</h2>
          <div className="info-box">
            <h3>Current Balance</h3>
            <p><strong>{tokenBalance} {tokenSymbol}</strong></p>
          </div>
          <div className="form-group">
            <label htmlFor="mint-amount">Amount to Mint</label>
            <input
              id="mint-amount"
              type="number"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              min="1"
            />
          </div>
          <button 
            className="button secondary" 
            onClick={mintTokens}
            disabled={loading}
          >
            Mint {mintAmount} {tokenSymbol}
            {loading && <span className="loading"></span>}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;