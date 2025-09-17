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
        const url = new URL(scanApiUrl)
        await this.sdk.connectTopology(url)
        this.topologyConnected = true
      } catch (err) {
        this.topologyConnected = false
        this.logger?.error({ err }, 'connectTopology failed')
        // Propagate to caller to surface readiness issues
        throw err
      }
    }

    this.initialized = true
    return this.getStatus()
  }
}

const sdkManager = new SdkManager()
export default sdkManager


