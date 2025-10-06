# Canton Wallet Demo

A web application demonstrating **real DAML contract operations** on Canton Network LocalNet. This demo creates actual Instrument and Holding contracts on the Canton ledger using JSON Ledger API with JWT authentication.

## Features

- **Real DAML Integration**: Creates actual contracts on Canton ledger via JSON Ledger API
- **Cross-Participant Minting**: Issue and Accept tokens across different participants
- **External Wallet Creation**: Generate parties with proper JWT authorization
- **Custom Token Deployment**: Deploy MinimalToken DAML contracts (v2.0.1 with observer pattern)
- **Two-Step Minting**: Issue (creates HoldingProposal) + Accept (creates Holding) flow
- **Balance Queries**: Query actual Active Contract Set (ACS) for real balances

## Prerequisites

- Node.js (v18 or higher)
- A running Canton Network LocalNet instance from cn-quickstart
- Canton Network services running on:
  - **App Provider**:
    - JSON API: localhost:3975
    - Admin API: localhost:3902
  - **App User**:
    - JSON API: localhost:2975
    - Admin API: localhost:2902
  - Canton Console: Available for party/user management

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd canton-wallet-demo
```

2. Install dependencies:
```bash
npm install
```

3. Start the backend server:
```bash
npm run server:start
```

4. Start the frontend development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5174`

## Usage

### Basic Flow

1. **Initialize**: The app automatically connects to Canton Network JSON API
2. **Create Token**: Configure token parameters (name, symbol, decimals) - creates Instrument contract
3. **Issue Tokens**: Specify owner party and amount - creates HoldingProposal contract
4. **Accept Proposal**: Owner exercises Accept choice - creates Holding contract
5. **View Balance**: Query actual holdings from Canton ledger

### Cross-Participant Setup

For cross-participant operations (owner on different participant than admin), you need to grant JWT user rights via Canton console:

```scala
// Grant actAs rights for the owner party
participants.app_user.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  actAs = Set(PartyId.tryFromProtoPrimitive("owner-party-id::..."))
)

// Grant readAs rights for the admin party
participants.app_user.ledger_api.users.rights.grant(
  id = "ledger-api-user",
  readAs = Set(PartyId.tryFromProtoPrimitive("app_provider_quickstart-e-1::..."))
)
```

See [CONTEXT.md](./CONTEXT.md) for detailed troubleshooting.

## Architecture

### Real DAML Integration
- **CNQuickstartLedgerService**: Direct JSON Ledger API v2 integration
- **JWT Authentication**: HMAC-SHA256 signed tokens with actAs/readAs claims
- **Real Contracts**: Creates actual Instrument, HoldingProposal, and Holding contracts
- **Observer Pattern**: Admin as signatory, owner as observer for cross-participant operations
- **Ledger Queries**: Queries real Active Contract Set (ACS) via JSON API
- **No Mocks**: 100% real Canton ledger operations

### Tech Stack
- **Frontend**: React 19.1.1 + Vite 7.1.5
- **Backend**: Fastify server for JSON Ledger API integration
- **DAML**: MinimalToken v2.0.1 contracts (observer pattern)
- **Canton**: JSON Ledger API v2 with JWT authentication
- **Package ID**: `eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de` (v2.0.0)
- **Package ID**: `2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118` (v2.0.1)

## Project Structure

```
canton-wallet-demo/
├── src/
│   ├── App.jsx                      # Main React component
│   ├── services/
│   │   └── cantonConsoleService.js  # Real Canton integration
│   ├── index.css                    # Styles
│   └── main.jsx                     # React entry point
├── server/
│   ├── index.js                     # Fastify server
│   └── routes/                      # API routes
├── daml/
│   └── minimal-token/               # DAML contracts
├── scripts/                         # Utility scripts
└── docs/
    └── PRD.md                       # Product requirements
```

## Real Canton Operations

This demo performs **actual DAML operations** on Canton ledger via JSON Ledger API v2:

1. **Contract Creation**: `POST /v2/commands/submit-and-wait-for-transaction` with CreateCommand
2. **Token Issuance**: Executes real `Issue` choice on Instrument → creates HoldingProposal
3. **Proposal Accept**: Executes `Accept` choice on HoldingProposal → creates Holding
4. **Balance Queries**: Queries real ACS with `/v2/state/active-contracts` endpoint
5. **Cross-Participant**: Supports operations across app-provider and app-user participants

### DAML Contract Flow (MinimalToken v2.0.1)

```
Instrument (admin signatory)
  ↓ Issue choice (admin controller)
HoldingProposal (admin signatory, owner observer)
  ↓ Accept choice (owner controller)
Holding (admin signatory, owner observer)
```

**Key Design**: Observer pattern enables cross-participant Accept - owner can exercise choice without being signatory.

**No mocks, no simulations - everything is real Canton ledger data!**

## License

ISC License