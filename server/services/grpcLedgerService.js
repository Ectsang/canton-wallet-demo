/**
 * gRPC Ledger Service - Direct gRPC connection to Canton Ledger API
 * Uses server reflection to load proto definitions dynamically
 */

import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { createHmac } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class GrpcLedgerService {
  constructor() {
    this.ledgerApiUrl = 'localhost:2901';  // app-user participant gRPC
    this.jwtSecret = 'unsafe';  // Canton LocalNet JWT secret
    this.client = null;
  }

  /**
   * Generate JWT token for authentication
   */
  generateJWT(parties) {
    const partiesArray = Array.isArray(parties) ? parties : [parties];

    const payload = {
      sub: 'ledger-api-user',
      aud: 'https://canton.network.global',
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
   * Create gRPC client with metadata interceptor for JWT auth
   */
  async createClient(party) {
    const token = this.generateJWT(party);

    // Create metadata with JWT
    const metadata = new grpc.Metadata();
    metadata.add('authorization', `Bearer ${token}`);

    // Create insecure credentials (LocalNet)
    const credentials = grpc.credentials.createInsecure();

    // For now, we'll use a manual proto definition
    // In production, you'd load from proto files or use reflection
    const packageDefinition = protoLoader.loadSync(
      __dirname + '/protos/state_service.proto',
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const StateService = protoDescriptor.com.daml.ledger.api.v2.StateService;

    return {
      client: new StateService(this.ledgerApiUrl, credentials),
      metadata
    };
  }

  /**
   * Query active contracts (Holdings) for a party
   */
  async queryHoldings({ owner, instrumentId }) {
    try {
      console.log('🔄 Querying Holdings via gRPC...', { owner, instrumentId });

      const { client, metadata } = await this.createClient(owner);

      // All package versions to query
      const allPackageIds = [
        'c598823710328ed7b6b46a519df06f200a6c49de424b0005c4a6091f8667586d', // v2.1.0
        '2399d6f39edcb9611b116cfc6e5b722b65b487cbb71e13a300753e39268f3118', // v2.0.1
        'eccbf7c592fcae3e2820c25b57b4c76a434f0add06378f97a01810ec4ccda4de'  // v2.0.0
      ];

      const request = {
        filter: {
          filters_by_party: {
            [owner]: {
              cumulative: allPackageIds.map(pkgId => ({
                template_filter: {
                  template_id: {
                    package_id: pkgId,
                    module_name: 'MinimalToken',
                    entity_name: 'Holding'
                  }
                }
              }))
            }
          }
        }
      };

      console.log('📋 gRPC Request:', JSON.stringify(request, null, 2));

      return new Promise((resolve, reject) => {
        const holdings = [];

        // GetActiveContracts returns a stream
        const call = client.GetActiveContracts(request, metadata);

        call.on('data', (response) => {
          console.log('📥 Received gRPC response:', JSON.stringify(response, null, 2));

          if (response.active_contract) {
            const event = response.active_contract.created_event;
            const args = event.create_arguments;

            // Filter by instrumentId if provided
            if (!instrumentId || args.instrument === instrumentId) {
              holdings.push({
                contractId: event.contract_id,
                owner: args.owner,
                admin: args.admin,
                instrument: args.instrument,
                amount: parseFloat(args.amount)
              });
            }
          }
        });

        call.on('end', () => {
          console.log(`✅ gRPC query complete: Found ${holdings.length} holdings`);

          const totalBalance = holdings.reduce((sum, h) => sum + h.amount, 0);

          resolve({
            success: true,
            holdings,
            totalBalance,
            holdingCount: holdings.length
          });
        });

        call.on('error', (err) => {
          console.error('❌ gRPC error:', err);
          reject(err);
        });
      });

    } catch (error) {
      console.error('❌ Failed to query holdings via gRPC:', error);
      throw error;
    }
  }
}

export default GrpcLedgerService;
