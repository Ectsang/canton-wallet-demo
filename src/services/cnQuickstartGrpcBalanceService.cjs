/**
 * gRPC-based balance query service for Canton
 * Uses StateService to query active contracts where owner is observer
 * CommonJS module to avoid ESM/CommonJS interop issues with @protobuf-ts/grpc-transport
 */

const { StateServiceClient } = require('@canton-network/core-ledger-client/dist/_proto/com/daml/ledger/api/v2/state_service.client.js');
const { GrpcTransport } = require('@protobuf-ts/grpc-transport');
const grpc = require('@grpc/grpc-js');
const { createHmac } = require('crypto');

class CNQuickstartGrpcBalanceService {
  constructor() {
    // App-provider gRPC Ledger API (not JSON API)
    this.grpcHost = 'localhost:3901';
    this.participantId = 'PAR::participant::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad';
    this.appProviderParty = 'app_provider_quickstart-e-1::1220a57d93198bc2f795cf3420debe4dc9ec849e4f393158c73753443f86848fa5ad';
    this.minimalTokenPackageId = '7ca8e0d1beb9866a061f405aec33c3b1596f585c1ca94e46b77cfe7b5fc4d065';

    this.client = null;
    this.transport = null;
  }

  /**
   * Initialize gRPC client with proper transport layer
   */
  async initialize() {
    if (this.client) return;

    console.log(`🔧 Initializing gRPC StateService client for ${this.grpcHost}`);

    // Create gRPC transport (protobuf-ts) with CommonJS credentials
    this.transport = new GrpcTransport({
      host: this.grpcHost,
      channelCredentials: grpc.credentials.createInsecure()
    });

    // Create StateService client with transport
    this.client = new StateServiceClient(this.transport);

    console.log('✅ gRPC client initialized with transport');
  }

  /**
   * Generate JWT for gRPC metadata
   */
  generateJWT(actAsParties, readAsParties = null) {
    const now = Math.floor(Date.now() / 1000);
    const actAsArray = Array.isArray(actAsParties) ? actAsParties : [actAsParties];

    const payload = {
      sub: "ledger-api-user",
      aud: "https://canton.network.global",
      actAs: actAsArray,
      exp: now + 3600,
      iat: now
    };

    if (readAsParties) {
      const readAsArray = Array.isArray(readAsParties) ? readAsParties : [readAsParties];
      payload.readAs = readAsArray;
    }

    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', 'unsafe')
      .update(`${header}.${payloadB64}`)
      .digest('base64url');

    return `${header}.${payloadB64}.${signature}`;
  }

  /**
   * Query holdings via gRPC GetActiveContracts
   */
  async queryHoldings({ owner, instrumentId }) {
    try {
      await this.initialize();

      console.log('🔍 Querying holdings via gRPC StateService.getActiveContracts...', { owner, instrumentId });

      const holdingTemplateId = `${this.minimalTokenPackageId}:MinimalToken:Holding`;

      // Generate JWT with owner in readAs (for observer access)
      const token = this.generateJWT(this.appProviderParty, owner);

      // Build filter for active contracts
      const request = {
        filter: {
          filtersByParty: {
            [owner]: {  // Query for owner (who is observer)
              inclusive: [{
                templateId: {
                  packageId: this.minimalTokenPackageId,
                  moduleName: 'MinimalToken',
                  entityName: 'Holding'
                }
              }]
            }
          }
        },
        verbose: true
      };

      console.log('📋 gRPC request:', JSON.stringify(request, null, 2));

      // getActiveContracts is a streaming RPC (camelCase method name)
      const call = this.client.getActiveContracts(request, {
        meta: { authorization: `Bearer ${token}` }
      });

      const holdings = [];

      // protobuf-ts streaming API uses async iterator
      for await (const response of call.responses) {
        console.log('📦 Received gRPC response:', JSON.stringify(response, null, 2));

        if (response.activeContract) {
          const contract = response.activeContract;
          const payload = contract.createdEvent?.createArguments;

          if (payload && payload.owner === owner) {
            if (!instrumentId || payload.instrument === instrumentId) {
              holdings.push({
                contractId: contract.contractId,
                owner: payload.owner,
                admin: payload.admin,
                instrument: payload.instrument,
                amount: parseFloat(payload.amount)
              });
            }
          }
        }
      }

      console.log(`✅ gRPC stream ended. Found ${holdings.length} holdings`);

      const totalBalance = holdings.reduce((sum, h) => sum + h.amount, 0);

      return {
        success: true,
        holdings: holdings,
        totalBalance: totalBalance,
        holdingCount: holdings.length
      };

    } catch (error) {
      console.error('❌ Failed to query via gRPC:', error);
      throw error;
    }
  }
}

module.exports = CNQuickstartGrpcBalanceService;
