/**
 * Canton JSON API v1 Service
 *
 * Implements working balance queries using v1 /query endpoint
 * with proper JWT scope and templateId formatting.
 *
 * IMPORTANT: v1 API requires:
 * 1. JWT with 'scope': 'daml_ledger_api'
 * 2. Full templateId format: 'packageId:module:entity'
 */

import { createHmac } from 'crypto';

class JsonApiV1Service {
  constructor(appProviderParty = null) {
    this.jsonApiUrl = 'http://localhost:2975';  // app-user participant
    this.jwtSecret = 'unsafe';  // Canton LocalNet JWT secret
    this.appProviderParty = appProviderParty;  // App provider party for querying Instruments

    // All deployed package IDs for MinimalToken
    this.packageIds = [
      'c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d',  // v2.1.0
      '2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118',  // v2.0.1
      'eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de'   // v2.0.0
    ];
  }

  /**
   * Generate JWT token with scope for v1 API
   */
  generateJWT(parties) {
    const partiesArray = Array.isArray(parties) ? parties : [parties];

    const payload = {
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
      scope: 'daml_ledger_api',  // REQUIRED for v1 API!
      actAs: partiesArray,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      iat: Math.floor(Date.now() / 1000)
    };

    // HMAC-SHA256 JWT signing
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.jwtSecret)
      .update(`${header}.${payloadB64}`)
      .digest('base64url');

    return `${header}.${payloadB64}.${signature}`;
  }

  /**
   * Query Holdings for a specific owner
   *
   * @param {Object} params
   * @param {string} params.owner - Party ID of the owner
   * @param {string} [params.instrumentId] - Optional instrument contract ID to filter by
   * @returns {Promise<Object>} { success, holdings, totalBalance, holdingCount, instruments }
   */
  async queryHoldings({ owner, instrumentId }) {
    try {
      console.log('🔄 Querying Holdings via JSON API v1...', { owner, instrumentId });

      const token = this.generateJWT(owner);

      // Create templateIds for all package versions
      const templateIds = this.packageIds.map(pkgId =>
        `${pkgId}:MinimalToken:Holding`
      );

      const response = await fetch(`${this.jsonApiUrl}/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateIds
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JSON API v1 query failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.result) {
        throw new Error('Unexpected response format: missing result field');
      }

      const contracts = data.result;
      console.log(`✅ Found ${contracts.length} Holdings via v1 API`);

      // Parse and filter holdings
      const holdings = contracts
        .map(contract => ({
          contractId: contract.contractId,
          owner: contract.payload.owner,
          admin: contract.payload.admin,
          instrument: contract.payload.instrument,
          amount: parseFloat(contract.payload.amount)
        }))
        .filter(holding => {
          // Filter by instrumentId if provided
          if (instrumentId && holding.instrument !== instrumentId) {
            return false;
          }
          return true;
        });

      const totalBalance = holdings.reduce((sum, h) => sum + h.amount, 0);

      // Get unique instrument IDs and fetch their details
      const uniqueInstrumentIds = [...new Set(holdings.map(h => h.instrument))];
      const instrumentDetails = await this.queryInstrumentsByIds(uniqueInstrumentIds, owner);

      return {
        success: true,
        holdings,
        totalBalance,
        holdingCount: holdings.length,
        instruments: instrumentDetails
      };

    } catch (error) {
      console.error('❌ Failed to query holdings via JSON API v1:', error);
      throw error;
    }
  }

  /**
   * Query Instrument contracts by their IDs
   * @private
   */
  async queryInstrumentsByIds(instrumentIds, owner) {
    if (instrumentIds.length === 0) {
      console.log('⚠️ No instrument IDs to query');
      return {};
    }

    try {
      console.log(`🔄 Querying Instrument details for ${instrumentIds.length} IDs...`);
      // IMPORTANT: Use app_provider party to query Instruments since they're only visible to admin
      // Instruments have "signatory admin" with no observers, so owner cannot see them
      const token = this.generateJWT(this.appProviderParty);

      // Query all Instruments
      const templateIds = this.packageIds.map(pkgId =>
        `${pkgId}:MinimalToken:Instrument`
      );

      // IMPORTANT: Query app-provider participant (port 3975) where Instruments are created
      const appProviderJsonApiUrl = 'http://localhost:3975';
      console.log(`📍 Querying Instruments on app-provider participant: ${appProviderJsonApiUrl}`);

      const response = await fetch(`${appProviderJsonApiUrl}/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateIds
        })
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to query instruments, returning without details');
        return {};
      }

      const data = await response.json();
      console.log(`📦 Found ${(data.result || []).length} total Instrument contracts`);

      const instruments = {};

      (data.result || []).forEach(contract => {
        if (instrumentIds.includes(contract.contractId)) {
          instruments[contract.contractId] = {
            name: contract.payload.name,
            symbol: contract.payload.symbol,
            decimals: parseInt(contract.payload.decimals),
            admin: contract.payload.admin
          };
          console.log(`✅ Matched instrument: ${contract.payload.symbol} (${contract.payload.name})`);
        }
      });

      console.log(`✅ Found ${Object.keys(instruments).length} Instrument details matching requested IDs`);
      return instruments;

    } catch (error) {
      console.warn('⚠️ Failed to fetch instrument details:', error.message);
      return {};
    }
  }

  /**
   * Query HoldingProposals for a specific owner
   *
   * @param {string} owner - Party ID of the owner
   * @returns {Promise<Object>} { success, proposals }
   */
  async queryProposals(owner) {
    try {
      console.log('🔄 Querying HoldingProposals via JSON API v1...', { owner });

      const token = this.generateJWT(owner);

      // Create templateIds for all package versions
      const templateIds = this.packageIds.map(pkgId =>
        `${pkgId}:MinimalToken:HoldingProposal`
      );

      const response = await fetch(`${this.jsonApiUrl}/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateIds
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JSON API v1 query failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.result) {
        throw new Error('Unexpected response format: missing result field');
      }

      const proposals = data.result.map(contract => ({
        proposalId: contract.contractId,
        owner: contract.payload.owner,
        admin: contract.payload.admin,
        instrument: contract.payload.instrument,
        amount: parseFloat(contract.payload.amount)
      }));

      console.log(`✅ Found ${proposals.length} HoldingProposals via v1 API`);

      return {
        success: true,
        proposals
      };

    } catch (error) {
      console.error('❌ Failed to query proposals via JSON API v1:', error);
      throw error;
    }
  }

  /**
   * Query Instruments (tokens) for a specific admin
   *
   * @param {string} admin - Party ID of the admin
   * @returns {Promise<Object>} { success, instruments }
   */
  async queryInstruments(admin) {
    try {
      console.log('🔄 Querying Instruments via JSON API v1...', { admin });

      const token = this.generateJWT(admin);

      // Create templateIds for all package versions
      const templateIds = this.packageIds.map(pkgId =>
        `${pkgId}:MinimalToken:Instrument`
      );

      const response = await fetch(`${this.jsonApiUrl}/v1/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateIds
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JSON API v1 query failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();

      if (!data.result) {
        throw new Error('Unexpected response format: missing result field');
      }

      const instruments = data.result.map(contract => ({
        contractId: contract.contractId,
        admin: contract.payload.admin,
        name: contract.payload.name,
        symbol: contract.payload.symbol,
        decimals: parseInt(contract.payload.decimals)
      }));

      console.log(`✅ Found ${instruments.length} Instruments via v1 API`);

      return {
        success: true,
        instruments
      };

    } catch (error) {
      console.error('❌ Failed to query instruments via JSON API v1:', error);
      throw error;
    }
  }
}

export default JsonApiV1Service;
