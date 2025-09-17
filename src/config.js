// Configuration for Canton Network connection
// Based on localnet configuration from /Users/e/code/sbc/canton/localnet/splice-node/docker-compose/localnet
// Port pattern: 4XXX for sv, 3XXX for app-provider, 2XXX for app-user

export const CANTON_CONFIG = {
  // LocalNet ports based on the docker-compose configuration
  // Using app-user ports (2XXX) for wallet operations
  
  // Ledger API configuration (app-user participant)
  LEDGER_API_URL: import.meta.env.VITE_LEDGER_API_URL || 'http://localhost:2901',
  LEDGER_API_PORT: Number(import.meta.env.VITE_LEDGER_API_PORT || 2901),
  
  // Admin API configuration (app-user participant)
  ADMIN_API_URL: import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:2902',
  ADMIN_API_PORT: Number(import.meta.env.VITE_ADMIN_API_PORT || 2902),
  
  // Validator Admin API (app-user validator)
  VALIDATOR_ADMIN_API_URL: import.meta.env.VITE_VALIDATOR_ADMIN_API_URL || 'http://localhost:2903',
  VALIDATOR_ADMIN_API_PORT: Number(import.meta.env.VITE_VALIDATOR_ADMIN_API_PORT || 2903),
  
  // JSON API port
  JSON_API_URL: import.meta.env.VITE_JSON_API_URL || 'http://localhost:2975',
  JSON_API_PORT: Number(import.meta.env.VITE_JSON_API_PORT || 2975),
  
  // Scan/Topology API URL - must match LocalNet configuration
  SCAN_API_URL: import.meta.env.VITE_SCAN_API_URL || 'http://scan.localhost:4000/api/scan',
  
  // Default synchronizer for LocalNet
  DEFAULT_SYNCHRONIZER: import.meta.env.VITE_DEFAULT_SYNCHRONIZER || 'localnet::1220e7b23ea52eb5c672fb0b1cdbc916922ffed3dd7676c223a605664315e2d43edd',
  
  // Token configuration
  TOKEN_DECIMALS: Number(import.meta.env.VITE_TOKEN_DECIMALS || 2),
  TOKEN_INITIAL_SUPPLY: Number(import.meta.env.VITE_TOKEN_INITIAL_SUPPLY || 1000000), // 10,000.00 tokens with 2 decimals
  
  // Network name from env
  NETWORK_NAME: import.meta.env.VITE_NETWORK_NAME || 'Splice',
  AMULET_NAME: import.meta.env.VITE_AMULET_NAME || 'Amulet',
  AMULET_NAME_ACRONYM: import.meta.env.VITE_AMULET_NAME_ACRONYM || 'AMT',
}

// Helper to get environment-specific config
export function getConfig() {
  // In a real app, you might switch based on environment
  return CANTON_CONFIG;
}