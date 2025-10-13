/**
 * CN Quickstart Integration Routes
 * Direct JSON Ledger API routes for custom DAML contracts
 *
 * These routes use CN Quickstart LocalNet's App Provider party and authentication
 */

import CNQuickstartLedgerService from '../../src/services/cnQuickstartLedgerService.js';
import JsonApiV1Service from '../services/jsonApiV1Service.js';

// Singleton service instances
let ledgerService = null;
let jsonApiV1Service = null;

function getLedgerService() {
  if (!ledgerService) {
    ledgerService = new CNQuickstartLedgerService();
  }
  return ledgerService;
}

function getJsonApiV1Service() {
  if (!jsonApiV1Service) {
    const ledgerService = getLedgerService();
    const appProviderParty = ledgerService.getAppProviderParty();
    jsonApiV1Service = new JsonApiV1Service(appProviderParty);
  }
  return jsonApiV1Service;
}

export default async function cnQuickstartRoutes(app) {

  // POST /api/cn/init - Initialize connection to CN Quickstart
  app.post('/api/cn/init', {
    schema: {
      description: 'Initialize connection to CN Quickstart LocalNet',
      tags: ['cn-quickstart'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            appProviderParty: { type: 'string' },
            jsonApiUrl: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      app.log.info('Initializing CN Quickstart connection...');

      const service = getLedgerService();
      await service.initialize();

      const appProviderParty = service.getAppProviderParty();

      app.log.info('CN Quickstart initialized', { appProviderParty });

      return {
        success: true,
        appProviderParty: appProviderParty,
        message: 'Connected to CN Quickstart LocalNet'
      };
    } catch (error) {
      app.log.error('Failed to initialize CN Quickstart', { error: error.message });
      reply.code(500);
      return {
        success: false,
        error: 'InitializationFailed',
        message: error.message
      };
    }
  });

  // POST /api/cn/tokens/create - Create custom token using App Provider party
  app.post('/api/cn/tokens/create', {
    schema: {
      description: 'Create a custom token (Instrument contract) using CN Quickstart App Provider',
      tags: ['cn-quickstart'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Token name' },
          symbol: { type: 'string', description: 'Token symbol' },
          decimals: { type: 'integer', minimum: 0, maximum: 18, description: 'Decimal places' }
        },
        required: ['name', 'symbol', 'decimals']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            contractId: { type: 'string' },
            admin: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            decimals: { type: 'integer' },
            transactionId: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { name, symbol, decimals } = req.body;

      app.log.info('Creating token via CN Quickstart', { name, symbol, decimals });

      const service = getLedgerService();
      const result = await service.createInstrument({
        name,
        symbol,
        decimals
      });

      app.log.info('Token created successfully', {
        contractId: result.contractId,
        admin: result.admin
      });

      return result;

    } catch (error) {
      app.log.error('Failed to create token', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'TokenCreationFailed',
        message: error.message
      };
    }
  });

  // POST /api/cn/tokens/mint - Mint tokens to external wallet
  app.post('/api/cn/tokens/mint', {
    schema: {
      description: 'Mint tokens to an external wallet by exercising Issue choice',
      tags: ['cn-quickstart'],
      body: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'Instrument contract ID' },
          owner: { type: 'string', description: 'External wallet party ID (recipient)' },
          amount: { type: 'string', description: 'Amount to mint (as string for precision)' }
        },
        required: ['contractId', 'owner', 'amount']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            proposalId: { type: 'string' },
            instrumentId: { type: 'string' },
            owner: { type: 'string' },
            amount: { type: 'number' },
            transactionId: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { contractId, owner, amount } = req.body;

      app.log.info('Minting tokens via CN Quickstart', {
        contractId,
        owner,
        amount
      });

      const service = getLedgerService();
      const result = await service.mintTokens({
        contractId,
        owner,
        amount
      });

      app.log.info('HoldingProposal created successfully (Issue)', {
        proposalId: result.proposalId,
        owner: result.owner,
        amount: result.amount
      });

      return result;

    } catch (error) {
      app.log.error('Failed to mint tokens', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'MintingFailed',
        message: error.message
      };
    }
  });

  // POST /api/cn/proposals/accept - Accept a HoldingProposal to create Holding
  app.post('/api/cn/proposals/accept', {
    schema: {
      description: 'Accept a HoldingProposal by exercising the Accept choice (owner only)',
      tags: ['cn-quickstart'],
      body: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', description: 'HoldingProposal contract ID to accept' },
          owner: { type: 'string', description: 'Owner party ID (must be authorized to accept)' }
        },
        required: ['proposalId', 'owner']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            holdingId: { type: 'string' },
            proposalId: { type: 'string' },
            owner: { type: 'string' },
            amount: { type: 'number' },
            instrumentId: { type: 'string' },
            transactionId: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { proposalId, owner } = req.body;

      app.log.info('Accepting holding proposal via CN Quickstart', {
        proposalId,
        owner
      });

      const service = getLedgerService();
      const result = await service.acceptProposal({
        proposalId,
        owner
      });

      app.log.info('Holding proposal accepted successfully', {
        holdingId: result.holdingId,
        owner: result.owner,
        amount: result.amount
      });

      return result;

    } catch (error) {
      app.log.error('Failed to accept proposal', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'AcceptProposalFailed',
        message: error.message
      };
    }
  });

  // POST /api/cn/holdings/burn - Burn tokens by exercising Burn choice
  app.post('/api/cn/holdings/burn', {
    schema: {
      description: 'Burn tokens by exercising the Burn choice on a Holding contract (owner only)',
      tags: ['cn-quickstart'],
      body: {
        type: 'object',
        properties: {
          holdingId: { type: 'string', description: 'Holding contract ID to burn' },
          owner: { type: 'string', description: 'Owner party ID (must be authorized to burn)' }
        },
        required: ['holdingId', 'owner']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            holdingId: { type: 'string' },
            owner: { type: 'string' },
            transactionId: { type: 'string' },
            burnedAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { holdingId, owner } = req.body;

      app.log.info('Burning holding via CN Quickstart', {
        holdingId,
        owner
      });

      const service = getLedgerService();
      const result = await service.burnHolding({
        holdingId,
        owner
      });

      app.log.info('Holding burned successfully', {
        holdingId: result.holdingId,
        owner: result.owner,
        transactionId: result.transactionId
      });

      return result;

    } catch (error) {
      app.log.error('Failed to burn holding', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'BurnHoldingFailed',
        message: error.message
      };
    }
  });

  // POST /api/cn/holdings/propose-burn - Propose to burn tokens (cross-participant pattern)
  app.post('/api/cn/holdings/propose-burn', {
    schema: {
      description: 'Propose to burn tokens by exercising ProposeBurn choice on a Holding contract (owner only)',
      tags: ['cn-quickstart'],
      body: {
        type: 'object',
        properties: {
          holdingId: { type: 'string', description: 'Holding contract ID to propose burning' },
          owner: { type: 'string', description: 'Owner party ID (must be authorized to propose burn)' }
        },
        required: ['holdingId', 'owner']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            proposalId: { type: 'string' },
            holdingId: { type: 'string' },
            owner: { type: 'string' },
            transactionId: { type: 'string' },
            proposedAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { holdingId, owner } = req.body;

      app.log.info('Proposing burn via CN Quickstart', {
        holdingId,
        owner
      });

      const service = getLedgerService();
      const result = await service.proposeBurnHolding({
        holdingId,
        owner
      });

      app.log.info('Burn proposal created successfully', {
        proposalId: result.proposalId,
        holdingId: result.holdingId,
        owner: result.owner
      });

      return result;

    } catch (error) {
      app.log.error('Failed to propose burn', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'ProposeBurnFailed',
        message: error.message
      };
    }
  });

  // POST /api/cn/burn-proposals/accept - Accept a BurnProposal to archive Holding
  app.post('/api/cn/burn-proposals/accept', {
    schema: {
      description: 'Accept a BurnProposal by exercising the AcceptBurn choice (admin only)',
      tags: ['cn-quickstart'],
      body: {
        type: 'object',
        properties: {
          proposalId: { type: 'string', description: 'BurnProposal contract ID to accept' },
          admin: { type: 'string', description: 'Admin party ID (must be authorized to accept)' }
        },
        required: ['proposalId', 'admin']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            proposalId: { type: 'string' },
            admin: { type: 'string' },
            transactionId: { type: 'string' },
            acceptedAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { proposalId, admin } = req.body;

      app.log.info('Accepting burn proposal via CN Quickstart', {
        proposalId,
        admin
      });

      const service = getLedgerService();
      const result = await service.acceptBurnProposal({
        proposalId,
        admin
      });

      app.log.info('Burn proposal accepted successfully', {
        proposalId: result.proposalId,
        admin: result.admin,
        transactionId: result.transactionId
      });

      return result;

    } catch (error) {
      app.log.error('Failed to accept burn proposal', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'AcceptBurnProposalFailed',
        message: error.message
      };
    }
  });

  // GET /api/cn/burn-proposals/:party - Query BurnProposals for a party
  app.get('/api/cn/burn-proposals/:party', {
    schema: {
      description: 'Query BurnProposals for a specific party (owner or admin)',
      tags: ['cn-quickstart'],
      params: {
        type: 'object',
        properties: {
          party: { type: 'string', description: 'Party ID to query burn proposals for' }
        },
        required: ['party']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            proposals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  proposalId: { type: 'string' },
                  owner: { type: 'string' },
                  admin: { type: 'string' },
                  holding: { type: 'string' }
                }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { party } = req.params;

      app.log.info('Querying burn proposals via CN Quickstart', { party });

      const v1Service = getJsonApiV1Service();
      const result = await v1Service.queryBurnProposals(party);

      app.log.info('Burn proposals query successful', {
        party,
        proposalCount: result.proposals.length
      });

      return result;

    } catch (error) {
      app.log.error('Failed to query burn proposals', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'QueryBurnProposalsFailed',
        message: error.message
      };
    }
  });

  // POST /api/cn/holdings/transfer - Transfer tokens by exercising Transfer choice
  app.post('/api/cn/holdings/transfer', {
    schema: {
      description: 'Transfer tokens by exercising the Transfer choice on a Holding contract (owner only)',
      tags: ['cn-quickstart'],
      body: {
        type: 'object',
        properties: {
          holdingId: { type: 'string', description: 'Holding contract ID to transfer from' },
          owner: { type: 'string', description: 'Owner party ID (must be authorized to transfer)' },
          recipient: { type: 'string', description: 'Recipient party ID' },
          amount: { type: 'string', description: 'Amount to transfer' }
        },
        required: ['holdingId', 'owner', 'recipient', 'amount']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            holdingId: { type: 'string' },
            owner: { type: 'string' },
            recipient: { type: 'string' },
            amount: { type: 'number' },
            newHoldingId: { type: 'string' },
            changeHoldingId: { type: 'string' },
            transactionId: { type: 'string' },
            transferredAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { holdingId, owner, recipient, amount } = req.body;

      app.log.info('Transferring holding via CN Quickstart', {
        holdingId,
        owner,
        recipient,
        amount
      });

      const service = getLedgerService();
      const result = await service.transferHolding({
        holdingId,
        owner,
        recipient,
        amount
      });

      app.log.info('Holding transferred successfully', {
        holdingId: result.holdingId,
        owner: result.owner,
        recipient: result.recipient,
        transactionId: result.transactionId
      });

      return result;

    } catch (error) {
      app.log.error('Failed to transfer holding', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'TransferHoldingFailed',
        message: error.message
      };
    }
  });

  // GET /api/cn/balance/:owner - Query token balance for wallet
  app.get('/api/cn/balance/:owner', {
    schema: {
      description: 'Query token holdings and balance for an external wallet',
      tags: ['cn-quickstart'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'External wallet party ID' }
        },
        required: ['owner']
      },
      querystring: {
        type: 'object',
        properties: {
          instrumentId: { type: 'string', description: 'Optional: Filter by specific token' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            holdings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contractId: { type: 'string' },
                  owner: { type: 'string' },
                  instrument: { type: 'string' },
                  amount: { type: 'number' }
                }
              }
            },
            totalBalance: { type: 'number' },
            holdingCount: { type: 'number' },
            instruments: {
              type: 'object',
              description: 'Instrument metadata mapped by contract ID',
              additionalProperties: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  symbol: { type: 'string' },
                  decimals: { type: 'number' },
                  admin: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { owner } = req.params;
      const { instrumentId } = req.query;

      app.log.info('Querying balance via JSON API v1 /query', { owner, instrumentId });

      const service = getJsonApiV1Service();
      const result = await service.queryHoldings({
        owner,
        instrumentId
      });

      app.log.info('Balance query successful via JSON API v1', {
        owner,
        totalBalance: result.totalBalance,
        holdingCount: result.holdingCount
      });

      return result;

    } catch (error) {
      app.log.error('Failed to query balance via JSON API v1', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'BalanceQueryFailed',
        message: error.message
      };
    }
  });

  // GET /api/cn/instruments/:contractId - Get Instrument details
  app.get('/api/cn/instruments/:contractId', {
    schema: {
      description: 'Get Instrument contract details (name, symbol, decimals)',
      tags: ['cn-quickstart'],
      params: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'Instrument contract ID' }
        },
        required: ['contractId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            contractId: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            decimals: { type: 'number' },
            admin: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { contractId } = req.params;

      // For now, return placeholder data
      // In a real implementation, you'd query the active contract
      return {
        success: true,
        contractId,
        name: 'Unknown Token',
        symbol: '???',
        decimals: 0,
        admin: ''
      };

    } catch (error) {
      app.log.error('Failed to get instrument details', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'InstrumentQueryFailed',
        message: error.message
      };
    }
  });

  // GET /api/cn/proposals/:owner - Query HoldingProposals for wallet
  app.get('/api/cn/proposals/:owner', {
    schema: {
      description: 'Query HoldingProposals (pending token mints) for an external wallet',
      tags: ['cn-quickstart'],
      params: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'External wallet party ID' }
        },
        required: ['owner']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            proposals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  proposalId: { type: 'string' },
                  owner: { type: 'string' },
                  admin: { type: 'string' },
                  instrument: { type: 'string' },
                  amount: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { owner } = req.params;

      app.log.info('Querying HoldingProposals via JSON API v1', { owner });

      const service = getJsonApiV1Service();
      const result = await service.queryProposals(owner);

      app.log.info('HoldingProposals query successful', {
        owner,
        proposalCount: result.proposals.length
      });

      return result;

    } catch (error) {
      app.log.error('Failed to query proposals', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'ProposalQueryFailed',
        message: error.message
      };
    }
  });

  // POST /api/cn/wallets/create - Create external wallet using Canton Admin API
  app.post('/api/cn/wallets/create', {
    schema: {
      description: 'Create an external wallet by allocating party on app-user participant',
      tags: ['cn-quickstart'],
      body: {
        type: 'object',
        properties: {
          partyHint: { type: 'string', description: 'Party hint for the wallet' }
        },
        required: ['partyHint']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            partyHint: { type: 'string' },
            partyId: { type: 'string' },
            publicKey: { type: 'string' },
            fingerprint: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { partyHint } = req.body;

      app.log.info('Creating external wallet via JSON Ledger API', { partyHint });

      const crypto = await import('crypto');

      // Generate JWT token for authentication
      const generateJWT = () => {
        const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
          sub:'ledger-api-user',
          aud:'https://canton.network.global',
          exp:Math.floor(Date.now()/1000)+3600,
          iat:Math.floor(Date.now()/1000)
        })).toString('base64url');
        const sig = crypto.createHmac('sha256','unsafe').update(header+'.'+payload).digest('base64url');
        return header+'.'+payload+'.'+sig;
      };

      const token = generateJWT();

      // Step 1: Allocate party via JSON Ledger API on app-user participant (port 2975)
      app.log.info('Step 1: Allocating party via JSON Ledger API', { partyHint });

      const partyResponse = await fetch('http://localhost:2975/v2/parties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          partyIdHint: partyHint,
          identityProviderId: ''
        })
      });

      if (!partyResponse.ok) {
        const errorText = await partyResponse.text();
        throw new Error(`Failed to allocate party: ${errorText}`);
      }

      const partyData = await partyResponse.json();
      const partyId = partyData.partyDetails?.party;

      if (!partyId || !partyId.includes('::')) {
        throw new Error(`Invalid party ID returned: ${JSON.stringify(partyData)}`);
      }

      app.log.info('Party allocated successfully', { partyId });

      // Step 2: Grant actAs rights via gRPC User Management Service
      app.log.info('Step 2: Granting actAs rights', { partyId });

      const { execSync } = await import('child_process');

      try {
        execSync(
          `grpcurl -plaintext -H "Authorization: Bearer ${token}" -d '{"user_id":"ledger-api-user","rights":[{"can_act_as":{"party":"${partyId}"}}]}' localhost:2901 com.daml.ledger.api.v2.admin.UserManagementService/GrantUserRights`,
          { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        app.log.info('actAs rights granted successfully');
      } catch (error) {
        app.log.warn('Failed to grant actAs rights (may already exist)', { error: error.message });
      }

      // Step 3: Grant readAs rights for admin party
      app.log.info('Step 3: Granting readAs rights for admin party');

      const service = getLedgerService();
      let adminParty = service.getAppProviderParty();

      if (!adminParty) {
        await service.initialize();
        adminParty = service.getAppProviderParty();
      }

      try {
        execSync(
          `grpcurl -plaintext -H "Authorization: Bearer ${token}" -d '{"user_id":"ledger-api-user","rights":[{"can_read_as":{"party":"${adminParty}"}}]}' localhost:2901 com.daml.ledger.api.v2.admin.UserManagementService/GrantUserRights`,
          { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
        );
        app.log.info('readAs rights granted successfully for admin party', { adminParty });
      } catch (error) {
        app.log.warn('Failed to grant readAs rights (may already exist)', { error: error.message });
      }

      const fingerprint = partyId.split('::')[1] || 'unknown';

      const walletInfo = {
        success: true,
        partyHint: partyHint,
        partyId: partyId,
        publicKey: 'managed-by-canton',
        fingerprint: fingerprint,
        createdAt: new Date().toISOString()
      };

      app.log.info('External wallet created successfully', { partyId });

      return walletInfo;

    } catch (error) {
      app.log.error('Failed to create external wallet', { error: error.message, stack: error.stack });
      reply.code(400);
      return {
        success: false,
        error: 'WalletCreationFailed',
        message: error.message
      };
    }
  });

  // GET /api/cn/status - Check CN Quickstart connection status
  app.get('/api/cn/status', {
    schema: {
      description: 'Check connection status to CN Quickstart LocalNet',
      tags: ['cn-quickstart'],
      response: {
        200: {
          type: 'object',
          properties: {
            connected: { type: 'boolean' },
            appProviderParty: { type: 'string' },
            jsonApiUrl: { type: 'string' },
            packageId: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const service = getLedgerService();

      // Try to get App Provider party (will initialize if needed)
      let appProviderParty = service.getAppProviderParty();

      if (!appProviderParty) {
        await service.initialize();
        appProviderParty = service.getAppProviderParty();
      }

      return {
        connected: true,
        appProviderParty: appProviderParty,
        jsonApiUrl: service.jsonApiUrl,
        packageId: service.minimalTokenPackageId
      };

    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  });
}