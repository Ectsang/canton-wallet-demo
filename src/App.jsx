import React, { useState, useEffect } from 'react';
import cantonService from './cantonService';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Wallet state
  const [wallet, setWallet] = useState(null);
  const [partyHint, setPartyHint] = useState('my-wallet-demo');
  
  // Token state
  const [tokenName, setTokenName] = useState('Demo Token');
  const [tokenSymbol, setTokenSymbol] = useState('DEMO');
  const [tokenDecimals, setTokenDecimals] = useState(2);
  const [createdToken, setCreatedToken] = useState(null);
  
  // Mint state
  const [mintAmount, setMintAmount] = useState(1000);
  const [tokenBalance, setTokenBalance] = useState(0);

  useEffect(() => {
    initializeSDK();
  }, []);

  const initializeSDK = async () => {
    try {
      setLoading(true);
      setError('');
      await cantonService.initialize();
      setIsInitialized(true);
      setSuccess('Canton SDK initialized successfully');
    } catch (err) {
      setError(`Failed to initialize SDK: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const connectToNetwork = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await cantonService.connectToNetwork();
      setIsConnected(true);
      setSuccess('Connected to Canton Network successfully');
    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
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
      setWallet(walletInfo);
      setSuccess('External wallet created successfully');
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
      
      // Note: The actual token creation might need adjustment based on the Canton token standard API
      // This is a simplified version
      const token = await cantonService.createToken(
        tokenName,
        tokenSymbol,
        parseInt(tokenDecimals)
      );
      
      setCreatedToken(token);
      setSuccess('Token created successfully');
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
      
      // Mint tokens to the wallet
      await cantonService.mintTokens(
        createdToken.tokenId || createdToken,
        parseInt(mintAmount) * Math.pow(10, tokenDecimals)
      );
      
      setSuccess(`Successfully minted ${mintAmount} ${tokenSymbol} tokens`);
      
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
      if (!createdToken) return;
      
      const balance = await cantonService.getTokenBalance(
        createdToken.tokenId || createdToken
      );
      
      setTokenBalance(balance / Math.pow(10, tokenDecimals));
    } catch (err) {
      console.error('Failed to update balance:', err);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Canton Wallet Demo</h1>
        <p>Create an external wallet and mint tokens using Canton Network</p>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* SDK Initialization */}
      <div className="card">
        <h2>1. SDK Initialization</h2>
        {!isInitialized ? (
          <p>Initializing Canton SDK...</p>
        ) : (
          <>
            <p>✅ SDK initialized</p>
            {!isConnected && (
              <button 
                className="button" 
                onClick={connectToNetwork}
                disabled={loading}
              >
                Connect to Canton Network
                {loading && <span className="loading"></span>}
              </button>
            )}
            {isConnected && <p>✅ Connected to Canton Network</p>}
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
              <h3>Wallet Created Successfully</h3>
              <p><strong>Party ID:</strong> {wallet.partyId}</p>
              <p><strong>Public Key:</strong> {wallet.publicKey}</p>
              <p><strong>Fingerprint:</strong> {wallet.fingerprint}</p>
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
              <h3>Token Created Successfully</h3>
              <p><strong>Token Name:</strong> {tokenName}</p>
              <p><strong>Token Symbol:</strong> {tokenSymbol}</p>
              <p><strong>Decimals:</strong> {tokenDecimals}</p>
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