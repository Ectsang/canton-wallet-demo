import {
  WalletSDKImpl,
  localNetAuthDefault,
  localNetLedgerDefault,
  localNetTopologyDefault,
  localNetTokenStandardDefault,
} from '@canton-network/wallet-sdk'

class SdkManager {
  /** @type {import('@canton-network/wallet-sdk').WalletSDKImpl | null} */
  sdk = null
  logger = console
  initialized = false
  topologyConnected = false
  privateKey = ''

  setLogger(logger) {
    this.logger = logger || console
  }

  getStatus() {
    return {
      initialized: this.initialized,
      topologyConnected: this.topologyConnected,
    }
  }

  async init() {
    const scanApiUrl = process.env.SCAN_API_URL
    const registryEnv = process.env.REGISTRY_API_URL
    if (!this.sdk) {
      this.sdk = new WalletSDKImpl().configure({
        logger: this.logger,
        authFactory: localNetAuthDefault,
        ledgerFactory: localNetLedgerDefault,
        topologyFactory: localNetTopologyDefault,
        tokenStandardFactory: localNetTokenStandardDefault,
      })
    }

    // Always attempt to (re)connect; idempotent in SDK usage
    await this.sdk.connect()
    await this.sdk.connectAdmin()

    if (scanApiUrl) {
      try {
        // SDK 0.7.0: scan-proxy is now on validator endpoint, not scan endpoint
        // Use localhost:2903/api/validator for CN Quickstart LocalNet
        const validatorUrl = new URL('http://localhost:2903/api/validator')
        await this.sdk.connectTopology(validatorUrl)
        this.topologyConnected = true
        
        // Registry API URL is validator + /v0/scan-proxy
        const registryUrl = registryEnv || `${validatorUrl.href}/v0/scan-proxy`
        this.logger?.info(`Using Registry API URL: ${registryUrl}`)
        this.sdk.tokenStandard?.setTransferFactoryRegistryUrl(registryUrl)
      } catch (err) {
        this.topologyConnected = false
        this.logger?.warn({ err }, 'connectTopology failed - continuing without topology connection')
        // Don't throw error - topology connection is optional for basic ledger operations
      }
    }

    this.initialized = true
    return this.getStatus()
  }
}

const sdkManager = new SdkManager()
export default sdkManager


