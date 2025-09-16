import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import cantonService from '../cantonService';

// Mock the canton service
vi.mock('../cantonService', () => ({
  default: {
    initialize: vi.fn(),
    connectToNetwork: vi.fn(),
    createExternalWallet: vi.fn(),
    createToken: vi.fn(),
    mintTokens: vi.fn(),
    getTokenBalance: vi.fn(),
    listTokens: vi.fn(),
    partyId: null,
    keyPair: null,
  },
}));

describe('App Component UI Tests', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Reset service state
    cantonService.partyId = null;
    cantonService.keyPair = null;
    
    // Default successful mocks
    cantonService.initialize.mockResolvedValue(true);
    cantonService.connectToNetwork.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering and SDK Initialization', () => {
    it('should render the app header correctly', () => {
      render(<App />);
      
      expect(screen.getByText('Canton Wallet Demo')).toBeInTheDocument();
      expect(screen.getByText('Create an external wallet and mint tokens using Canton Network')).toBeInTheDocument();
    });

    it('should initialize SDK on mount', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(cantonService.initialize).toHaveBeenCalledTimes(1);
      });
      
      expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
    });

    it('should show error if SDK initialization fails', async () => {
      cantonService.initialize.mockRejectedValueOnce(new Error('SDK init failed'));
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to initialize SDK: SDK init failed/)).toBeInTheDocument();
      });
    });
  });

  describe('Network Connection Flow', () => {
    it('should connect to network when button is clicked', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      const connectButton = screen.getByRole('button', { name: /Connect to Canton Network/i });
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(cantonService.connectToNetwork).toHaveBeenCalledTimes(1);
        expect(screen.getByText('✅ Connected to Canton Network')).toBeInTheDocument();
      });
    });

    it('should show loading state during connection', async () => {
      cantonService.connectToNetwork.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 100))
      );
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      const connectButton = screen.getByRole('button', { name: /Connect to Canton Network/i });
      await user.click(connectButton);
      
      // Check for loading spinner
      expect(screen.getByRole('button', { name: /Connect to Canton Network/i })).toBeDisabled();
      expect(document.querySelector('.loading')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('✅ Connected to Canton Network')).toBeInTheDocument();
      });
    });

    it('should handle connection errors gracefully', async () => {
      cantonService.connectToNetwork.mockRejectedValueOnce(new Error('Network unreachable'));
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      const connectButton = screen.getByRole('button', { name: /Connect to Canton Network/i });
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to connect: Network unreachable/)).toBeInTheDocument();
      });
    });
  });

  describe('Wallet Creation Flow', () => {
    beforeEach(async () => {
      render(<App />);
      
      // Wait for initialization and connect
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      const connectButton = screen.getByRole('button', { name: /Connect to Canton Network/i });
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText('✅ Connected to Canton Network')).toBeInTheDocument();
      });
    });

    it('should create wallet with custom party hint', async () => {
      const mockWalletInfo = {
        partyId: 'party::12345',
        publicKey: 'pub-key-123',
        fingerprint: 'finger-123',
      };
      
      cantonService.createExternalWallet.mockResolvedValueOnce(mockWalletInfo);
      
      // Change party hint
      const partyHintInput = screen.getByLabelText(/Party Hint/i);
      await user.clear(partyHintInput);
      await user.type(partyHintInput, 'custom-wallet-name');
      
      // Click create wallet
      const createButton = screen.getByRole('button', { name: /Create External Wallet/i });
      await user.click(createButton);
      
      await waitFor(() => {
        expect(cantonService.createExternalWallet).toHaveBeenCalledWith('custom-wallet-name');
        expect(screen.getByText('Wallet Created Successfully')).toBeInTheDocument();
        expect(screen.getByText('party::12345')).toBeInTheDocument();
        expect(screen.getByText('pub-key-123')).toBeInTheDocument();
        expect(screen.getByText('finger-123')).toBeInTheDocument();
      });
    });

    it('should show success message after wallet creation', async () => {
      cantonService.createExternalWallet.mockResolvedValueOnce({
        partyId: 'party::test',
        publicKey: 'pub-test',
        fingerprint: 'finger-test',
      });
      
      const createButton = screen.getByRole('button', { name: /Create External Wallet/i });
      await user.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText('External wallet created successfully')).toBeInTheDocument();
      });
    });

    it('should handle wallet creation errors', async () => {
      // Reset the mock to ensure clean state
      cantonService.createExternalWallet.mockReset();
      cantonService.createExternalWallet.mockRejectedValueOnce(
        new Error('Invalid party hint format')
      );
      
      const createButton = screen.getByRole('button', { name: /Create External Wallet/i });
      await user.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to create wallet: Invalid party hint format/)).toBeInTheDocument();
      });
    });
  });

  describe('Token Creation Flow', () => {
    beforeEach(async () => {
      render(<App />);
      
      // Set up connected state with wallet
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      const connectButton = screen.getByRole('button', { name: /Connect to Canton Network/i });
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText('✅ Connected to Canton Network')).toBeInTheDocument();
      });
      
      // Create wallet
      cantonService.createExternalWallet.mockResolvedValueOnce({
        partyId: 'party::test',
        publicKey: 'pub-test',
        fingerprint: 'finger-test',
      });
      
      const createWalletButton = screen.getByRole('button', { name: /Create External Wallet/i });
      await user.click(createWalletButton);
      
      await waitFor(() => {
        expect(screen.getByText('Wallet Created Successfully')).toBeInTheDocument();
      });
    });

    it('should create token with custom parameters', async () => {
      cantonService.createToken.mockResolvedValueOnce({
        tokenId: 'token::abc123',
      });
      
      // Modify token parameters
      const tokenNameInput = screen.getByLabelText('Token Name');
      await user.clear(tokenNameInput);
      await user.type(tokenNameInput, 'My Custom Token');
      
      const tokenSymbolInput = screen.getByLabelText('Token Symbol');
      await user.clear(tokenSymbolInput);
      await user.type(tokenSymbolInput, 'MCT');
      
      const decimalsInput = screen.getByLabelText('Decimals');
      await user.clear(decimalsInput);
      await user.type(decimalsInput, '8');
      
      // Create token
      const createTokenButton = screen.getByRole('button', { name: /Create Token/i });
      await user.click(createTokenButton);
      
      await waitFor(() => {
        expect(cantonService.createToken).toHaveBeenCalledWith(
          'My Custom Token',
          'MCT',
          8
        );
        expect(screen.getByText('Token Created Successfully')).toBeInTheDocument();
        expect(screen.getByText('My Custom Token')).toBeInTheDocument();
        expect(screen.getByText('MCT')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
      });
    });

    it('should validate decimal input range', async () => {
      const decimalsInput = screen.getByLabelText('Decimals');
      
      // Test max constraint
      await user.clear(decimalsInput);
      await user.type(decimalsInput, '20');
      
      expect(decimalsInput.value).toBe('20');
      expect(decimalsInput.validity.valid).toBe(false); // HTML5 validation
      
      // Test min constraint
      await user.clear(decimalsInput);
      await user.type(decimalsInput, '-1');
      
      expect(decimalsInput.value).toBe('-1');
      expect(decimalsInput.validity.valid).toBe(false);
    });
  });

  describe('Token Minting Flow', () => {
    beforeEach(async () => {
      render(<App />);
      
      // Set up complete state: connected, wallet created, token created
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('button', { name: /Connect to Canton Network/i }));
      
      await waitFor(() => {
        expect(screen.getByText('✅ Connected to Canton Network')).toBeInTheDocument();
      });
      
      cantonService.createExternalWallet.mockResolvedValueOnce({
        partyId: 'party::test',
        publicKey: 'pub-test',
        fingerprint: 'finger-test',
      });
      
      await user.click(screen.getByRole('button', { name: /Create External Wallet/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Wallet Created Successfully')).toBeInTheDocument();
      });
      
      cantonService.createToken.mockResolvedValueOnce({
        tokenId: 'token::test123',
      });
      
      await user.click(screen.getByRole('button', { name: /Create Token/i }));
      
      await waitFor(() => {
        expect(screen.getByText('Token Created Successfully')).toBeInTheDocument();
      });
      
      // Mock initial balance
      cantonService.getTokenBalance.mockResolvedValue(0);
    });

    it('should mint tokens and update balance', async () => {
      cantonService.mintTokens.mockResolvedValueOnce({
        transactionId: 'tx::mint123',
      });
      
      cantonService.getTokenBalance.mockResolvedValueOnce(100000); // 1000.00 with 2 decimals
      
      // Change mint amount
      const mintAmountInput = screen.getByLabelText('Amount to Mint');
      await user.clear(mintAmountInput);
      await user.type(mintAmountInput, '500');
      
      // Click mint button
      const mintButton = screen.getByRole('button', { name: /Mint 500 DEMO/i });
      await user.click(mintButton);
      
      await waitFor(() => {
        expect(cantonService.mintTokens).toHaveBeenCalledWith(
          'token::test123',
          50000 // 500 * 100 (2 decimals)
        );
        expect(screen.getByText(/Successfully minted 500 DEMO tokens/)).toBeInTheDocument();
        expect(screen.getByText('1000 DEMO')).toBeInTheDocument(); // Updated balance
      });
    });

    it('should show current balance before minting', async () => {
      // Initial balance is 0 until we mint
      expect(screen.getByText('0 DEMO')).toBeInTheDocument();
    });

    it('should validate minimum mint amount', async () => {
      const mintAmountInput = screen.getByLabelText('Amount to Mint');
      
      await user.clear(mintAmountInput);
      await user.type(mintAmountInput, '0');
      
      expect(mintAmountInput.value).toBe('0');
      expect(mintAmountInput.validity.valid).toBe(false);
    });
  });

  describe('Loading States and User Feedback', () => {
    it('should disable buttons during operations', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      // Make connect slow
      cantonService.connectToNetwork.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 50))
      );
      
      const connectButton = screen.getByRole('button', { name: /Connect to Canton Network/i });
      await user.click(connectButton);
      
      // Button should be disabled immediately after click
      expect(connectButton).toBeDisabled();
      
      // Wait for operation to complete - button will be hidden when connected
      await waitFor(() => {
        expect(screen.getByText('✅ Connected to Canton Network')).toBeInTheDocument();
      });
      
      // Button is no longer visible after successful connection
      expect(screen.queryByRole('button', { name: /Connect to Canton Network/i })).not.toBeInTheDocument();
    });

    it('should clear previous errors when new operation starts', async () => {
      cantonService.connectToNetwork.mockRejectedValueOnce(new Error('First error'));
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      // First attempt fails
      await user.click(screen.getByRole('button', { name: /Connect to Canton Network/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to connect: First error/)).toBeInTheDocument();
      });
      
      // Second attempt
      cantonService.connectToNetwork.mockResolvedValueOnce(true);
      await user.click(screen.getByRole('button', { name: /Connect to Canton Network/i }));
      
      // Error should be cleared
      expect(screen.queryByText(/Failed to connect: First error/)).not.toBeInTheDocument();
    });

    it('should show success messages temporarily', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      const connectButton = screen.getByRole('button', { name: /Connect to Canton Network/i });
      await user.click(connectButton);
      
      await waitFor(() => {
        expect(screen.getByText('Connected to Canton Network successfully')).toBeInTheDocument();
      });
      
      // Success message should persist (we're not testing auto-hide in this demo)
      expect(screen.getByText('Connected to Canton Network successfully')).toBeInTheDocument();
    });
  });

  describe('Progressive Disclosure', () => {
    it('should only show wallet creation after connection', async () => {
      render(<App />);
      
      // Wallet section should not be visible initially
      expect(screen.queryByText('2. Create External Wallet')).not.toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      // Connect to network
      await user.click(screen.getByRole('button', { name: /Connect to Canton Network/i }));
      
      await waitFor(() => {
        expect(screen.getByText('2. Create External Wallet')).toBeInTheDocument();
      });
    });

    it('should show sections progressively as user completes steps', async () => {
      render(<App />);
      
      // Initially only SDK section
      expect(screen.getByText('1. SDK Initialization')).toBeInTheDocument();
      expect(screen.queryByText('2. Create External Wallet')).not.toBeInTheDocument();
      expect(screen.queryByText('3. Create Token')).not.toBeInTheDocument();
      expect(screen.queryByText('4. Mint Tokens')).not.toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('✅ SDK initialized')).toBeInTheDocument();
      });
      
      // Connect
      await user.click(screen.getByRole('button', { name: /Connect to Canton Network/i }));
      await waitFor(() => {
        expect(screen.getByText('2. Create External Wallet')).toBeInTheDocument();
      });
      
      // Create wallet
      cantonService.createExternalWallet.mockResolvedValueOnce({
        partyId: 'party::test',
        publicKey: 'pub',
        fingerprint: 'finger',
      });
      await user.click(screen.getByRole('button', { name: /Create External Wallet/i }));
      await waitFor(() => {
        expect(screen.getByText('3. Create Token')).toBeInTheDocument();
      });
      
      // Create token
      cantonService.createToken.mockResolvedValueOnce({ tokenId: 'token::123' });
      await user.click(screen.getByRole('button', { name: /Create Token/i }));
      await waitFor(() => {
        expect(screen.getByText('4. Mint Tokens')).toBeInTheDocument();
      });
    });
  });
});