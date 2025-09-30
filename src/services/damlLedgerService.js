/**
 * DAML Ledger API Service - Direct HTTP JSON API Client (v1)
 * This service handles custom DAML contract creation using the standard DAML Ledger API
 * Separate from Canton Wallet SDK which is used for token operations
 */

import { createHmac } from 'crypto';

class DamlLedgerService {
  constructor() {
    // Use CN Quickstart's built-in JSON API (no proxy needed)
    this.jsonApiUrl = 'http://localhost:2975';
    this.participantId = 'PAR::participant::1220975d30b6a9c9a03f8ec9e9e851c08cc51da86d2b2a32d8a45e54d731c1da819f';
    this.minimalTokenPackageId = 'd8325445c38031336b59afafaf5f01c83494e77884eab47baf3a6436e4be15f6';
    // Use v1 API endpoints
    this.apiVersion = 'v1';
  }

  /**
   * Generate simple JWT for DAML JSON API proxy
   * The proxy handles the complex authentication with Canton
   */
  generateJWT(party) {
    // Convert full party ID to simple name for JWT
    const partyName = party.includes('::') ? party.split('::')[0] : party;
    
    const tokenPayload = {
      "https://daml.com/ledger-api": {
        actAs: [partyName],
        readAs: [partyName],
        ledgerId: "participant1"
      }
    };

    console.log('🔑 JWT payload for DAML JSON API proxy:', JSON.stringify(tokenPayload, null, 2));

    // Generate simple JWT - the proxy will handle the real authentication
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const signature = createHmac('sha256', 'unsafe').update(`${header}.${payload}`).digest('base64url');
    
    return `${header}.${payload}.${signature}`;
  }

  /**
   * Create an Instrument contract using DAML JSON API v1
   */
  async createInstrument({ admin, name, symbol, decimals }) {
    try {
      console.log('🔄 Creating Instrument contract via DAML JSON API v1...', {
        admin, name, symbol, decimals, packageId: this.minimalTokenPackageId
      });

      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      // Use a simple party name that exists in CN Quickstart
      const partyName = admin.includes('::') ? admin.split('::')[0] : admin;
      const payload = { admin: partyName, name, symbol, decimals };
      
      // Generate JWT token for the admin party
      const token = this.generateJWT(admin);

      const createRequest = {
        templateId,
        payload
      };

      console.log('📋 DAML JSON API v1 create request:', JSON.stringify(createRequest, null, 2));

      const response = await fetch(`${this.jsonApiUrl}/${this.apiVersion}/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(createRequest)
      });

      const responseText = await response.text();
      console.log('📋 DAML JSON API v1 response status:', response.status);
      console.log('📋 DAML JSON API v1 response:', responseText);

      if (response.ok) {
        const result = JSON.parse(responseText);
        
        // v1 API returns the contract directly
        if (result && result.contractId) {
          console.log('✅ Instrument contract created successfully via DAML JSON API v1');
          
          return {
            success: true,
            contractId: result.contractId,
            payload: result.payload,
            message: 'Instrument contract created successfully via DAML JSON API v1'
          };
        }
        
        throw new Error('No contractId found in response');
      } else {
        throw new Error(`DAML JSON API v1 failed: ${response.status} - ${responseText}`);
      }

    } catch (error) {
      console.error('❌ Failed to create Instrument contract via DAML JSON API v1:', error);
      throw error;
    }
  }

  /**
   * Query active contracts using DAML JSON API v1
   */
  async queryActiveContracts({ templateId, party }) {
    try {
      console.log('🔍 Querying active contracts via DAML JSON API v1...', { templateId, party });

      const token = this.generateJWT(party);

      const query = {
        templateIds: [templateId]
      };

      const response = await fetch(`${this.jsonApiUrl}/${this.apiVersion}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(query)
      });

      const responseText = await response.text();
      console.log('📋 Query response status:', response.status);
      console.log('📋 Query response:', responseText);

      if (response.ok) {
        const result = JSON.parse(responseText);
        console.log('✅ Active contracts query successful');
        return result;
      } else {
        throw new Error(`Query failed: ${response.status} - ${responseText}`);
      }

    } catch (error) {
      console.error('❌ Failed to query active contracts:', error);
      throw error;
    }
  }

  /**
   * Exercise a choice on a contract using DAML JSON API v1
   */
  async exerciseChoice({ contractId, choice, choiceArgument, party }) {
    try {
      console.log('🔄 Exercising choice via DAML JSON API v1...', {
        contractId, choice, choiceArgument, party
      });

      const templateId = `${this.minimalTokenPackageId}:MinimalToken:Instrument`;
      
      const token = this.generateJWT(party);

      const exerciseRequest = {
        templateId,
        contractId,
        choice,
        argument: choiceArgument
      };

      console.log('📋 Exercise request:', JSON.stringify(exerciseRequest, null, 2));

      const response = await fetch(`${this.jsonApiUrl}/${this.apiVersion}/exercise`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(exerciseRequest)
      });

      const responseText = await response.text();
      console.log('📋 Exercise response status:', response.status);
      console.log('📋 Exercise response:', responseText);

      if (response.ok) {
        const result = JSON.parse(responseText);
        console.log('✅ Choice exercised successfully via DAML JSON API v1');
        return result;
      } else {
        throw new Error(`Exercise failed: ${response.status} - ${responseText}`);
      }

    } catch (error) {
      console.error('❌ Failed to exercise choice via DAML JSON API v1:', error);
      throw error;
    }
  }
}

export default DamlLedgerService;