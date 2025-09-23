# Canton Wallet Demo

A web application demonstrating **real DAML contract operations** on Canton Network LocalNet. This demo creates actual Instrument and Holding contracts on the Canton ledger using direct console API calls.

## Features

- **Real DAML Integration**: Creates actual contracts on Canton ledger
- **External Wallet Creation**: Generate parties with cryptographic keys
- **Custom Token Deployment**: Deploy MinimalToken DAML contracts
- **Token Minting**: Execute real Issue choices to create Holding contracts
- **Balance Queries**: Query actual Active Contract Set (ACS) for real balances

## Prerequisites

- Node.js (v18 or higher)
- A running Canton Network LocalNet instance
- Canton LocalNet services running on:
  - Ledger API: localhost:2901
  - Admin API: localhost:2902
  - Canton Console: Available for direct API calls

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

1. **Initialize**: The app automatically initializes Canton integration
2. **Connect**: Click "Connect to Canton Network" 
3. **Create Wallet**: Enter a party hint and create an external wallet
4. **Create Token**: Configure token parameters (name, symbol, decimals)
5. **Mint Tokens**: Specify amount and mint real tokens to your wallet
6. **View Balance**: See actual balance from Canton ledger contracts

## Architecture

### Real DAML Integration
- **CantonConsoleService**: Direct Canton console API integration
- **Real Contracts**: Creates actual Instrument and Holding contracts
- **Ledger Queries**: Queries real Active Contract Set (ACS)
- **No Mocks**: 100% real Canton ledger operations

### Tech Stack
- **Frontend**: React 19.1.1 + Vite 7.1.5
- **Backend**: Fastify server for Canton console integration
- **DAML**: MinimalToken contracts for real token operations
- **Canton**: Direct console API calls for contract operations

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

This demo performs **actual DAML operations** on Canton ledger:

1. **Contract Creation**: Uses `sv.ledger_api.commands.submit_flat()` 
2. **Token Minting**: Executes real `Issue` choices on Instrument contracts
3. **Balance Queries**: Queries real ACS with `sv.ledger_api.acs.of_all()`
4. **Holdings Listing**: Retrieves actual Holding contracts from ledger

**No mocks, no simulations - everything is real Canton ledger data!**

## License

ISC License