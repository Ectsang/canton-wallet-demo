// Lightweight browser-safe runtime mock for @canton-network/wallet-sdk
// Provides the minimal surface used by src/cantonService.js

function generateId(prefix = 'id') {
  return `${prefix}::${Math.random().toString(36).slice(2)}${Date.now()}`
}

export function createKeyPair() {
  return {
    publicKey: `public-${generateId('pk')}`,
    privateKey: `private-${generateId('sk')}`,
  }
}

export function signTransactionHash(hash, privateKey) {
  return `signed-${hash}-with-${privateKey}`
}

class MockLedgerController {
  partyId = ''
  setPartyId(partyId) { this.partyId = partyId; return this }
  async prepareSubmission() {
    return { preparedTransactionHash: generateId('txhash'), preparedTransaction: {} }
  }
  async executeSubmission() {
    return { status: 'success', transactionId: generateId('tx') }
  }
}

class MockTokenStandardController {
  partyId = ''
  setPartyId(partyId) { this.partyId = partyId; return this }
  async listHoldingUtxos() { return [] }
  async createTap(recipient, amount, instrument) {
    // Return a command-like structure compatible with cantonService usage
    return {
      CreateCommand: {
        templateId: 'Token:Tap',
        createArguments: { recipient, amount, instrument },
      },
    }
  }
}

class MockTopologyController {
  async prepareExternalPartyTopology(publicKey, partyHint) {
    const fingerprint = generateId('fingerprint')
    const partyId = partyHint ? `${partyHint}::${fingerprint}` : `party::${fingerprint}`
    return {
      combinedHash: 'deadbeef',
      fingerprint,
      partyId,
      partyTransactions: [],
      txHashes: [],
      namespace: fingerprint,
    }
  }
  async submitExternalPartyTopology() { return { partyId: generateId('party') } }
}

export function localNetAuthDefault() {
  const token = 'dummy'
  const userId = 'ledger-api-user'
  return {
    async getUserToken() { return { userId, accessToken: token } },
    async getAdminToken() { return { userId, accessToken: token } },
  }
}

export function localNetLedgerDefault() { return new MockLedgerController() }
export function localNetTopologyDefault() { return new MockTopologyController() }
export function localNetTokenStandardDefault() { return new MockTokenStandardController() }

export class WalletSDKImpl {
  auth = localNetAuthDefault()
  ledgerFactory = localNetLedgerDefault
  topologyFactory = localNetTopologyDefault
  tokenStandardFactory = localNetTokenStandardDefault
  userLedger = undefined
  adminLedger = undefined
  topology = undefined
  tokenStandard = undefined
  logger = console

  configure(config = {}) {
    if (config.logger) this.logger = config.logger
    if (config.authFactory) this.auth = config.authFactory()
    if (config.ledgerFactory) this.ledgerFactory = config.ledgerFactory
    if (config.topologyFactory) this.topologyFactory = config.topologyFactory
    if (config.tokenStandardFactory) this.tokenStandardFactory = config.tokenStandardFactory
    return this
  }

  async connect() {
    const { userId, accessToken } = await this.auth.getUserToken()
    this.userLedger = this.ledgerFactory(userId, accessToken)
    this.tokenStandard = this.tokenStandardFactory(userId, accessToken)
    return this
  }

  async connectAdmin() {
    const { userId, accessToken } = await this.auth.getAdminToken()
    this.adminLedger = this.ledgerFactory(userId, accessToken)
    return this
  }

  async connectTopology() {
    const { userId, accessToken } = await this.auth.getAdminToken()
    this.topology = this.topologyFactory(userId, accessToken, 'mock-synchronizer')
    return this
  }
}


