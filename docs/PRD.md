# Product Requirements Document (PRD)

## Canton Wallet Demo

### Document Information

- **Version**: 1.0
- **Date**: September 2025
- **Status**: Draft

---

## 1. Executive Summary

The Canton Wallet Demo is a web application that demonstrates the core capabilities of the Canton Network for external wallet management and custom token operations. This demo serves as a reference implementation for developers learning to integrate with Canton Network using LocalNet for development and testing.

### 1.1 Purpose

Provide a comprehensive, working example of how to:

1. Create an external wallet on Canton Network
2. Deploy and interact with custom tokens using DAML
3. Mint tokens to wallets
4. Query wallet token balances
5. Transfer tokens between wallets

### 1.2 Target Audience

- Blockchain developers new to Canton Network
- Technical teams evaluating Canton for token-based applications
- Educational institutions teaching distributed ledger technology
- Open-source contributors to Canton ecosystem

---

## 2. Product Overview

### 2.1 Core Functionality

The demo application demonstrates a complete token lifecycle:

1. **External Wallet Creation**
   - Generate cryptographic key pairs
   - Register external parties with Canton topology
   - Establish wallet identity on the network

2. **Custom Token Deployment**
   - Deploy MinimalToken DAML contracts to LocalNet
   - Create token instruments with configurable parameters
   - Establish token administration capabilities

3. **Token Minting Operations**
   - Issue new tokens to specified wallets
   - Validate minting permissions and constraints
   - Track token supply and distribution

4. **Balance Management**
   - Query wallet token holdings
   - Display real-time balance information
   - Support multiple token types per wallet

5. **Token Transfer (Future Enhancement)**
   - Transfer tokens between external wallets
   - Validate transfer permissions and balances
   - Maintain transaction history

### 2.2 Technical Architecture

#### Frontend (React + Vite)

- **Framework**: React 19.1.1 with modern hooks
- **Build Tool**: Vite 7.1.5 for fast development
- **State Management**: React useState/useEffect
- **UI Components**: Custom CSS with responsive design
- **Error Handling**: Comprehensive user feedback

#### Backend-for-Frontend (Fastify)

- **Server**: Fastify 5.6.0 with REST API
- **Port**: 8899 with Swagger documentation
- **SDK Integration**: Canton Wallet SDK 0.5.0
- **Authentication**: JWT tokens for LocalNet

#### DAML Smart Contracts

- **Location**: `daml/minimal-token/`
- **Contract**: MinimalToken.daml
- **Templates**: Instrument and Holding contracts
- **SDK Version**: 2.10.2

#### Canton Network Integration

- **Environment**: LocalNet for development
- **Ledger API**: gRPC on port 2901
- **Admin API**: gRPC on port 2902
- **JSON API**: HTTP on port 2975
- **Scan UI**: HTTP on port 2000

---

## 3. Detailed Requirements

### 3.1 Functional Requirements

#### FR-1: External Wallet Creation

- **Description**: Users can create new external wallets on Canton Network
- **Acceptance Criteria**:
  - Generate Ed25519 key pairs for wallet identity
  - Register party with Canton topology controller
  - Display wallet details (Party ID, Public Key, Fingerprint)
  - Handle wallet creation errors gracefully
  - Support optional party hints for readable identifiers

#### FR-2: Custom Token Deployment

- **Description**: Deploy MinimalToken DAML contracts for custom tokens
- **Acceptance Criteria**:
  - Use MinimalToken.daml template from `daml/minimal-token/`
  - Configure token parameters: name, symbol, decimals
  - Validate input parameters (name/symbol non-empty, decimals 0-18)
  - Deploy Instrument contract to LocalNet
  - Return token contract ID for future operations

#### FR-3: Token Minting

- **Description**: Mint tokens to external wallets using DAML contracts
- **Acceptance Criteria**:
  - Execute Issue choice on Instrument contract
  - Specify recipient wallet and mint amount
  - Validate positive amounts and sufficient permissions
  - Create Holding contracts for minted tokens
  - Update wallet balance displays

#### FR-4: Balance Queries

- **Description**: Display current token balances for wallets
- **Acceptance Criteria**:
  - Query Holding contracts for specific wallets
  - Aggregate holdings by token type
  - Display balances with proper decimal formatting
  - Support real-time balance updates
  - Handle multiple token types per wallet

#### FR-5: Network Connection Management

- **Description**: Establish and maintain connections to Canton LocalNet
- **Acceptance Criteria**:
  - Initialize Canton SDK with LocalNet configuration
  - Authenticate using unsafe tokens for development
  - Verify connectivity to all required services
  - Display connection status to users
  - Handle network failures gracefully

### 3.2 Non-Functional Requirements

#### NFR-1: Performance

- **Wallet Creation**: Complete within 5 seconds
- **Token Operations**: Execute within 10 seconds
- **Balance Queries**: Return within 2 seconds
- **UI Responsiveness**: Maintain 60fps interactions

#### NFR-2: Reliability

- **Uptime**: 99% availability during development sessions
- **Error Recovery**: Graceful handling of network failures
- **Data Consistency**: Accurate balance reporting
- **Transaction Safety**: Atomic operations with rollback

#### NFR-3: Usability

- **Learning Curve**: New developers productive within 30 minutes
- **Documentation**: Complete setup and usage instructions
- **Error Messages**: Clear, actionable feedback
- **Progressive Disclosure**: Step-by-step workflow guidance

#### NFR-4: Security

- **Key Management**: Secure generation and storage
- **Network Communication**: Encrypted gRPC connections
- **Input Validation**: Sanitize all user inputs
- **Development Only**: Clear warnings about LocalNet limitations

---

## 4. Technical Specifications

### 4.1 DAML Contract Details

#### MinimalToken.daml Structure

```daml
template Instrument
  with
    admin    : Party      -- Token administrator
    name     : Text       -- Human-readable name
    symbol   : Text       -- Trading symbol
    decimals : Int        -- Decimal precision
  where
    signatory admin
    
    choice Issue : ContractId Holding
      with
        owner  : Party    -- Token recipient
        amount : Decimal  -- Mint amount
      controller admin

template Holding
  with
    owner      : Party                -- Token holder
    instrument : ContractId Instrument -- Token reference
    amount     : Decimal              -- Balance amount
  where
    signatory owner
    
    choice Transfer : (ContractId Holding, Optional (ContractId Holding))
      with
        recipient      : Party   -- Transfer recipient
        transferAmount : Decimal -- Transfer amount
      controller owner
```

### 4.2 API Endpoints

#### Backend REST API

- `POST /api/init` - Initialize SDK connections
- `POST /api/wallets/external` - Create external wallet
- `POST /api/tokens/deploy` - Deploy token contract
- `POST /api/tokens/mint` - Mint tokens to wallet
- `GET /api/tokens/balance/:partyId/:tokenId` - Query balance
- `GET /api/health` - Service health check

### 4.3 Environment Configuration

#### LocalNet Services

```bash
VITE_LEDGER_API_URL=http://localhost:2901
VITE_ADMIN_API_URL=http://localhost:2902
VITE_VALIDATOR_ADMIN_API_URL=http://localhost:2903
VITE_JSON_API_URL=http://localhost:2975
VITE_SCAN_API_URL=http://scan.localhost:4000/api/scan
```

#### Development Settings

```bash
VITE_RUNTIME_MOCK_SDK=true          # Browser compatibility
VITE_USE_REAL_LOCALNET=true         # LocalNet integration
VITE_CANTON_NETWORK=localnet        # Network selection
```

---

## 5. User Experience

### 5.1 User Journey

1. **Landing**: User opens demo at <http://localhost:5173>
2. **Initialization**: SDK automatically initializes
3. **Connection**: User clicks "Connect to Canton Network"
4. **Wallet Creation**: User enters party hint and creates wallet
5. **Token Setup**: User configures token parameters and deploys
6. **Minting**: User specifies amount and mints tokens
7. **Balance View**: User sees updated token balance

### 5.2 UI Components

#### Connection Status

- Visual indicators for SDK and network status
- Progress indicators during operations
- Error states with retry options

#### Wallet Information

- Party ID display with copy functionality
- Public key and fingerprint details
- Creation timestamp and status

#### Token Configuration

- Form inputs for name, symbol, decimals
- Validation feedback and constraints
- Preview of token parameters

#### Balance Display

- Current balance with token symbol
- Formatted decimal display
- Real-time updates after operations

---

## 6. Testing Strategy

### 6.1 Test Coverage

- **Unit Tests**: Service layer and utilities (15 tests)
- **Integration Tests**: End-to-end workflows (7 tests)
- **UI Tests**: Component interactions and validation
- **Error Handling**: Network failures and edge cases

### 6.2 Test Environments

- **Mock Mode**: Browser-safe testing without LocalNet
- **LocalNet Mode**: Full integration with running Canton
- **CI/CD**: Automated testing in build pipeline

### 6.3 Test Scenarios

- Successful wallet creation and token operations
- Network connectivity failures and recovery
- Invalid input handling and validation
- Concurrent operations and state management
- Performance under load conditions

---

## 7. Deployment and Operations

### 7.1 Development Setup

```bash
# Install dependencies
npm install

# Start LocalNet (external requirement)
cd /path/to/canton/localnet
docker-compose up

# Start backend server
npm run server:start

# Start frontend development server
npm run dev
```

### 7.2 Build and Distribution

```bash
# Build production assets
npm run build

# Preview production build
npm run preview

# Run comprehensive tests
npm run test:all
```

### 7.3 Monitoring and Logging

- Frontend: Browser console and error boundaries
- Backend: Pino structured logging
- Canton: LocalNet logs and metrics
- Health checks: Automated service verification

---

## 8. Success Metrics

### 8.1 Technical Metrics

- **Test Coverage**: >90% for critical paths
- **Build Success**: 100% CI/CD pipeline success
- **Performance**: All operations within SLA targets
- **Error Rate**: <1% for normal operations

### 8.2 User Experience Metrics

- **Setup Time**: <5 minutes from clone to running
- **Success Rate**: >95% for complete workflows
- **Documentation**: Zero unanswered questions in issues
- **Community**: Active usage and contributions

### 8.3 Educational Impact

- **Developer Onboarding**: Reduced time to first Canton app
- **Reference Usage**: Adoption in other Canton projects
- **Knowledge Transfer**: Clear understanding of Canton concepts
- **Ecosystem Growth**: Increased Canton developer community

---

## 9. Future Enhancements

### 9.1 Phase 2 Features

- **Token Transfers**: Wallet-to-wallet token transfers
- **Multi-Token Support**: Multiple tokens per wallet
- **Transaction History**: Complete operation audit trail
- **Batch Operations**: Multiple mints/transfers in one transaction

### 9.2 Phase 3 Features

- **Mainnet Support**: Production network integration
- **Advanced Tokens**: Complex token standards and features
- **Governance**: Token voting and proposal mechanisms
- **DeFi Integration**: Liquidity pools and trading features

### 9.3 Technical Improvements

- **Mobile Support**: Responsive design for mobile devices
- **Offline Mode**: Local storage and sync capabilities
- **Performance**: Optimized for large-scale operations
- **Security**: Production-grade key management

---

## 10. Risks and Mitigation

### 10.1 Technical Risks

- **SDK Compatibility**: Monitor Canton SDK updates
- **LocalNet Stability**: Maintain stable test environment
- **Browser Limitations**: Continue mock SDK approach
- **DAML Changes**: Track template standard evolution

### 10.2 Mitigation Strategies

- **Automated Testing**: Catch regressions early
- **Documentation**: Maintain current setup guides
- **Community**: Engage with Canton development team
- **Fallbacks**: Mock implementations for reliability

---

## 11. Conclusion

The Canton Wallet Demo serves as a comprehensive reference implementation for Canton Network integration, demonstrating the complete lifecycle of external wallet management and custom token operations. By focusing on LocalNet development and the MinimalToken DAML contract, this demo provides developers with practical, working examples of Canton's core capabilities.

The project's success will be measured by its ability to reduce developer onboarding time, increase Canton ecosystem adoption, and serve as a foundation for more complex Canton applications.
