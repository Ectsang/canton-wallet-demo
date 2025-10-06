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

  // Canton state
  const [appProviderParty, setAppProviderParty] = useState(null);

  // Wallet state
  const [wallet, setWallet] = useState(null);
  const [partyHint, setPartyHint] = useState('demo-wallet-1');
  const [manualPartyId, setManualPartyId] = useState('demo-wallet-1::12203bef03ef28882157f215f074792d8b02a1881cd3e0c0bd505150f67a8712ea21');
  const [showOnboardingInstructions, setShowOnboardingInstructions] = useState(false);
  
  // Token state
  const [tokenName, setTokenName] = useState('Demo Token');
  const [tokenSymbol, setTokenSymbol] = useState('DEMO');
  const [tokenDecimals, setTokenDecimals] = useState(2);
  const [createdToken, setCreatedToken] = useState(null);
  const [allTokens, setAllTokens] = useState([]); // All created tokens
  const [selectedToken, setSelectedToken] = useState(null); // Selected token for minting
  
  // Mint state
  const [mintAmount, setMintAmount] = useState(1000);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [balanceBreakdown, setBalanceBreakdown] = useState([]);

  // Proposal state
  const [pendingProposal, setPendingProposal] = useState(null);
  const [allProposals, setAllProposals] = useState([]);

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
        setSelectedToken(savedToken);
        setTokenName(savedToken.name);
        setTokenSymbol(savedToken.symbol);
        setTokenDecimals(savedToken.decimals);

        // Add to allTokens list
        setAllTokens([savedToken]);

        console.log('✅ Loaded existing token from storage');
      }

      // If we have wallet, always load the current balance (all instruments)
      if (savedWallet && savedWallet.partyId) {
        await loadTokenBalance(savedWallet.partyId, null);
        await loadProposals(savedWallet);
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

        // Get instrument metadata from result
        const instruments = result.instruments || {};

        // Populate allTokens from instruments (convert to token format)
        const tokensFromInstruments = Object.entries(instruments).map(([contractId, info]) => ({
          contractId,
          tokenId: contractId,
          name: info.name,
          symbol: info.symbol,
          decimals: info.decimals,
          admin: info.admin,
          isRealContract: true
        }));

        // Update allTokens (merge with existing, avoid duplicates)
        setAllTokens(prev => {
          const merged = [...prev];
          tokensFromInstruments.forEach(token => {
            const exists = merged.find(t => t.contractId === token.contractId);
            if (!exists) {
              merged.push(token);
            }
          });
          return merged;
        });

        // Group holdings by instrument for breakdown
        const byInstrument = {};
        result.holdings.forEach(holding => {
          const inst = holding.instrument;
          if (!byInstrument[inst]) {
            const instrumentInfo = instruments[inst];
            byInstrument[inst] = {
              instrumentId: inst,
              amount: 0,
              count: 0,
              name: instrumentInfo?.name || 'Unknown Token',
              symbol: instrumentInfo?.symbol || '???',
              decimals: instrumentInfo?.decimals || 0
            };
          }
          byInstrument[inst].amount += holding.amount;
          byInstrument[inst].count += 1;
        });

        setBalanceBreakdown(Object.values(byInstrument));
        console.log('✅ Loaded current token balance:', totalBalance, 'across', Object.keys(byInstrument).length, 'instruments');
      } else {
        setTokenBalance(0);
        setBalanceBreakdown([]);
      }
    } catch (error) {
      console.error('❌ Failed to load token balance:', error);
      setTokenBalance(0);
      setBalanceBreakdown([]);
    }
  };

  const loadProposals = async (walletToUse) => {
    const targetWallet = walletToUse || wallet;
    if (!targetWallet || !targetWallet.partyId) {
      console.log('⚠️ No wallet available to load proposals');
      return;
    }

    try {
      setError('');
      console.log('🔄 Loading proposals for:', targetWallet.partyId);
      const result = await cantonService.getProposals(targetWallet.partyId);
      if (result.success) {
        setAllProposals(result.proposals || []);
        console.log('✅ Loaded proposals:', result.proposals?.length || 0);
      }
    } catch (error) {
      console.error('❌ Failed to load proposals:', error);
      // Don't show error to user, just log it
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

  const useExistingParty = () => {
    if (!manualPartyId || !manualPartyId.includes('::')) {
      setError('Please enter a valid party ID (format: party-hint::fingerprint)');
      return;
    }

    const partyHintFromId = manualPartyId.split('::')[0];
    const fingerprint = manualPartyId.split('::')[1];

    const walletInfo = {
      partyId: manualPartyId,
      partyHint: partyHintFromId,
      publicKey: 'existing-party',
      fingerprint: fingerprint,
      createdAt: new Date().toISOString()
    };

    setWallet(walletInfo);
    storageService.saveWallet(walletInfo);
    setSuccess(`Using existing party: ${manualPartyId}`);
    setError('');
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
      setSelectedToken(token);

      // Add to allTokens list (avoid duplicates)
      setAllTokens(prev => {
        const exists = prev.find(t => t.contractId === token.contractId);
        if (exists) return prev;
        return [...prev, token];
      });

      // Save token to localStorage
      storageService.saveToken(token);

      setSuccess(`Token created successfully: ${token.contractId}`);
    } catch (err) {
      setError(`Failed to create token: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const issueTokens = async () => {
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

      // Issue tokens (creates HoldingProposal)
      const result = await cantonService.mintTokens(
        createdToken.contractId,
        wallet.partyId,
        parseFloat(mintAmount)
      );

      setPendingProposal({
        proposalId: result.proposalId,
        owner: wallet.partyId,
        amount: parseFloat(mintAmount)
      });

      // Reload proposals to show the new one
      await loadProposals();

      setSuccess(`Step 1/2: HoldingProposal created! Proposal ID: ${result.proposalId.substring(0, 20)}...`);
    } catch (err) {
      setError(`Failed to issue tokens: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const acceptProposal = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!pendingProposal) {
        throw new Error('No pending proposal to accept');
      }

      // Accept the proposal (creates Holding)
      const result = await cantonService.acceptProposal(
        pendingProposal.proposalId,
        pendingProposal.owner
      );

      setSuccess(`Step 2/2: SUCCESS! Tokens minted. Holding ID: ${result.holdingId.substring(0, 20)}...`);

      // Clear proposal and update balance
      setPendingProposal(null);
      await updateBalance();
    } catch (err) {
      setError(`Failed to accept proposal: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateBalance = async () => {
    try {
      if (!wallet) return;

      // Query ALL holdings (no instrument filter) to show total balance
      const result = await cantonService.getTokenBalance(
        wallet.partyId,
        null  // null = get all instruments
      );

      if (result.success) {
        setTokenBalance(result.totalBalance || 0);

        // Get instrument metadata from result
        const instruments = result.instruments || {};

        // Group holdings by instrument
        const byInstrument = {};
        result.holdings.forEach(holding => {
          const inst = holding.instrument;
          if (!byInstrument[inst]) {
            const instrumentInfo = instruments[inst];
            byInstrument[inst] = {
              instrumentId: inst,
              amount: 0,
              count: 0,
              name: instrumentInfo?.name || 'Unknown Token',
              symbol: instrumentInfo?.symbol || '???',
              decimals: instrumentInfo?.decimals || 0
            };
          }
          byInstrument[inst].amount += holding.amount;
          byInstrument[inst].count += 1;
        });

        setBalanceBreakdown(Object.values(byInstrument));
        console.log(`✅ Updated balance: ${result.totalBalance} (${result.holdingCount} holdings across ${Object.keys(byInstrument).length} instruments)`);
      } else {
        setTokenBalance(0);
        setBalanceBreakdown([]);
      }
    } catch (err) {
      console.error('Failed to update balance:', err);
      setTokenBalance(0);
      setBalanceBreakdown([]);
    }
  };

  const acceptSpecificProposal = async (proposal) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      console.log('🔄 Accepting proposal:', proposal);

      // Accept the proposal
      const result = await cantonService.acceptProposal(
        proposal.proposalId,
        proposal.owner
      );

      console.log('✅ Proposal accepted successfully!', result);
      setSuccess(`✅ Proposal accepted! You received ${proposal.amount} tokens. Holding ID: ${result.holdingId.substring(0, 20)}...`);

      // Reload proposals and balance (pass wallet explicitly)
      await loadProposals(wallet);
      await updateBalance();

      console.log('✅ Proposals and balance updated');
    } catch (err) {
      console.error('❌ Accept proposal error:', err);
      setError(`Failed to accept proposal: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearWallet = () => {
    if (window.confirm('⚠️ Clear wallet data? This will remove your wallet from local storage but keep tokens.')) {
      storageService.clearWallet();
      setWallet(null);
      setTokenBalance(0);
      setBalanceBreakdown([]);
      setAllProposals([]);
      setPendingProposal(null);
      setPartyHint('demo-wallet-1');
      setManualPartyId('');
      setSuccess('✅ Wallet data cleared');
    }
  };

  const clearAllTokens = () => {
    if (window.confirm('⚠️ Clear all token data? This will remove all saved tokens from local storage.')) {
      storageService.clearToken();
      setCreatedToken(null);
      setSelectedToken(null);
      setAllTokens([]);
      setTokenName('');
      setTokenSymbol('');
      setTokenDecimals(2);
      setSuccess('✅ All tokens cleared');
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
          <h2>2. Create or Use External Wallet</h2>

          {/* Collapsible Onboarding Instructions */}
          <div style={{ marginBottom: '1rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '1rem' }}>
            <button
              onClick={() => setShowOnboardingInstructions(!showOnboardingInstructions)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.5rem 0',
                cursor: 'pointer',
                fontSize: '0.95em',
                color: '#2196F3',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                justifyContent: 'space-between'
              }}
            >
              <span>📚 Party Onboarding & Enabling Instructions</span>
              <span style={{ fontSize: '1.2em' }}>{showOnboardingInstructions ? '▼' : '▶'}</span>
            </button>

            {showOnboardingInstructions && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                fontSize: '0.9em'
              }}>
                <h3 style={{ marginTop: 0, fontSize: '1em', color: '#333' }}>Canton LocalNet Party Setup</h3>

                <h4 style={{ fontSize: '0.95em', marginTop: '1rem', color: '#555' }}>Option 1: Using Canton Console</h4>
                <pre style={{
                  backgroundColor: '#272822',
                  color: '#f8f8f2',
                  padding: '0.75rem',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '0.85em'
                }}>{`# Connect to Canton LocalNet console
cd /path/to/cn-quickstart/quickstart/docker/modules/localnet
docker exec -it canton bash

# Enable party on app-user participant
participants.app_user.parties.enable("demo-wallet-1")

# List and find your party (get the full party ID from output)
participants.app_user.parties.list()

# Grant user rights for JWT authentication (replace with actual party ID)
participants.app_user.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  actAs = Set(PartyId.tryFromProtoPrimitive("demo-wallet-1::1220...")),
  readAs = Set() // Add app_provider party if needed for cross-participant
)`}</pre>

                <h4 style={{ fontSize: '0.95em', marginTop: '1rem', color: '#555' }}>Option 2: Create via UI</h4>
                <p style={{ margin: '0.5rem 0' }}>
                  Click "Create External Wallet" below - the backend will automatically:
                </p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                  <li>Enable the party on the app-user participant</li>
                  <li>Allocate JWT user rights for the new party</li>
                  <li>Return the full party ID for use in the UI</li>
                </ul>

                <h4 style={{ fontSize: '0.95em', marginTop: '1rem', color: '#555' }}>Option 3: Use Existing Party</h4>
                <p style={{ margin: '0.5rem 0' }}>
                  If you have an existing party ID from previous sessions, paste it in the "Use Existing Party ID" field below.
                  The party must already be enabled on the app-user participant with proper JWT rights.
                </p>
              </div>
            )}
          </div>

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

              <div style={{ margin: '1rem 0', textAlign: 'center', color: '#666' }}>— OR —</div>

              <div className="form-group">
                <label htmlFor="manual-party">Use Existing Party ID</label>
                <input
                  id="manual-party"
                  type="text"
                  value={manualPartyId}
                  onChange={(e) => setManualPartyId(e.target.value)}
                  placeholder="demo-wallet-1::12203bef03ef28882157f215..."
                />
                <small style={{ color: '#666', marginTop: '0.25rem', display: 'block' }}>
                  Enter full party ID (format: party-hint::fingerprint)
                </small>
              </div>
              <button
                className="button secondary"
                onClick={useExistingParty}
                disabled={!manualPartyId}
              >
                Use Existing Party
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
                  onClick={clearWallet}
                  title="Clear wallet data from local storage"
                >
                  🗑️ Clear Wallet
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

          {/* Token Selector Dropdown - shown when tokens exist */}
          {allTokens.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label htmlFor="token-selector" style={{ fontWeight: 'bold', marginBottom: 0 }}>
                  Select Token for Minting:
                </label>
                <button
                  className="button danger small"
                  onClick={clearAllTokens}
                  title="Clear all saved tokens"
                >
                  🗑️ Clear All Tokens
                </button>
              </div>
              <select
                id="token-selector"
                value={selectedToken?.contractId || ''}
                onChange={(e) => {
                  const token = allTokens.find(t => t.contractId === e.target.value);
                  setSelectedToken(token || null);
                  if (token) {
                    setCreatedToken(token);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ddd'
                }}
              >
                <option value="">-- Select a token --</option>
                {allTokens.map((token) => (
                  <option key={token.contractId} value={token.contractId}>
                    {token.symbol} - {token.name} ({token.contractId.substring(0, 20)}...)
                  </option>
                ))}
              </select>
            </div>
          )}

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

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  className="button secondary"
                  onClick={() => {
                    setCreatedToken(null);
                    setTokenName('');
                    setTokenSymbol('');
                    setTokenDecimals(2);
                    storageService.clearToken();
                  }}
                  style={{ flex: 1 }}
                >
                  ➕ Create Another Token
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending Proposals Section */}
      {wallet && (
        <div className="card">
          <h2>4. Your Pending Proposals</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, color: '#666' }}>
              Proposals are token minting requests that need your approval
            </p>
            <button
              className="button secondary"
              onClick={loadProposals}
              disabled={loading}
              style={{ padding: '0.5rem 1rem' }}
            >
              🔄 Refresh
              {loading && <span className="loading"></span>}
            </button>
          </div>

          {allProposals.length === 0 ? (
            <div className="info-box">
              <p>No pending proposals. Create a token and mint some to see proposals here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {allProposals.map((proposal, index) => (
                <div key={proposal.proposalId} className="info-box" style={{ backgroundColor: '#fff3cd', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', fontSize: '1.5rem' }}>
                    ⏳
                  </div>
                  <h3 style={{ marginTop: 0 }}>Proposal #{index + 1}</h3>

                  <div className="wallet-detail">
                    <strong>Amount:</strong> {proposal.amount}
                  </div>

                  <div className="wallet-detail">
                    <strong>Instrument ID:</strong>
                    <div className="copyable-field">
                      <code style={{ fontSize: '0.85em' }}>{proposal.instrument.substring(0, 40)}...</code>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(proposal.instrument, 'Instrument ID')}
                        title="Copy Instrument ID"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div className="wallet-detail">
                    <strong>Proposal ID:</strong>
                    <div className="copyable-field">
                      <code style={{ fontSize: '0.85em' }}>{proposal.proposalId.substring(0, 40)}...</code>
                      <button
                        className="copy-btn"
                        onClick={() => copyToClipboard(proposal.proposalId, 'Proposal ID')}
                        title="Copy Proposal ID"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  <div className="wallet-detail">
                    <strong>From Admin:</strong>
                    <code style={{ fontSize: '0.75em', wordBreak: 'break-all' }}>{proposal.admin.substring(0, 50)}...</code>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button
                      className="button primary"
                      onClick={() => acceptSpecificProposal(proposal)}
                      disabled={loading}
                      style={{ flex: 1 }}
                    >
                      ✅ Accept & Mint Tokens
                      {loading && <span className="loading"></span>}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => {
                        // TODO: Implement reject functionality
                        alert('Reject functionality coming soon! For now, proposals remain until accepted.');
                      }}
                      disabled={loading}
                      style={{ flex: 1 }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Token Minting - Two Step Flow */}
      {createdToken && (
        <div className="card">
          <h2>5. Mint Tokens (Two-Step Flow)</h2>
          <div className="info-box">
            <h3>Total Balance</h3>
            <p><strong>{tokenBalance} tokens</strong></p>

            {balanceBreakdown.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #e0e0e0', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.9em', marginBottom: '0.5rem', color: '#666' }}>Breakdown by Token:</h4>
                {balanceBreakdown.map((item, index) => (
                  <div key={item.instrumentId} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: index < balanceBreakdown.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1em', fontWeight: '500', color: '#333' }}>
                        {item.name} ({item.symbol})
                      </div>
                      <code style={{ fontSize: '0.75em', color: '#999' }}>
                        {item.instrumentId.substring(0, 20)}...
                      </code>
                    </div>
                    <div style={{ textAlign: 'right', marginLeft: '1rem' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>
                        {item.amount} {item.symbol}
                      </div>
                      <div style={{ fontSize: '0.75em', color: '#666' }}>
                        {item.count} holding{item.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 1: Issue */}
          <div className="form-group">
            <label htmlFor="mint-amount">Amount to Issue</label>
            <input
              id="mint-amount"
              type="number"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
              min="1"
              disabled={pendingProposal !== null}
            />
          </div>
          <button
            className="button secondary"
            onClick={issueTokens}
            disabled={loading || pendingProposal !== null}
          >
            Step 1: Issue {mintAmount} {tokenSymbol} (Create Proposal)
            {loading && <span className="loading"></span>}
          </button>

          {/* Step 2: Accept (only shown when proposal exists) */}
          {pendingProposal && (
            <div className="info-box" style={{ marginTop: '1rem', backgroundColor: '#fff3cd' }}>
              <h3>⏳ Pending Proposal</h3>
              <p>Amount: <strong>{pendingProposal.amount} {tokenSymbol}</strong></p>
              <p>Proposal ID: <code>{pendingProposal.proposalId.substring(0, 30)}...</code></p>
              <button
                className="button primary"
                onClick={acceptProposal}
                disabled={loading}
                style={{ marginTop: '0.5rem' }}
              >
                Step 2: Accept Proposal (Mint Tokens)
                {loading && <span className="loading"></span>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;