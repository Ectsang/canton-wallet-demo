/**
 * CN Quickstart Integration Routes
 * Direct JSON Ledger API routes for custom DAML contracts
 *
 * These routes use CN Quickstart LocalNet's App Provider party and authentication
 */

import CNQuickstartLedgerService from '../../src/services/cnQuickstartLedgerService.js';
import JsonApiV1Service from '../services/jsonApiV1Service.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CNQuickstartGrpcBalanceService = require('../../src/services/cnQuickstartGrpcBalanceService.cjs');

// Singleton service instances
let ledgerService = null;
let grpcBalanceService = null;
let jsonApiV1Service = null;

function getLedgerService() {
  if (!ledgerService) {
    ledgerService = new CNQuickstartLedgerService();
  }
  return ledgerService;
}

function getGrpcBalanceService() {
  if (!grpcBalanceService) {
    grpcBalanceService = new CNQuickstartGrpcBalanceService();
  }
  return grpcBalanceService;
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

      app.log.info('Creating external wallet via Canton Console script', { partyHint });

      const { promisify } = require('util');
      const { writeFile, unlink } = require('fs').promises;
      const exec = promisify(require('child_process').exec);
      const path = require('path');

      // Create temp script file
      const scriptPath = `/tmp/allocate-${partyHint}-${Date.now()}.sh`;
      const scriptContent = `#!/bin/bash
set -e
docker exec canton-console bash -c "echo 'val party = participants.app_user.parties.enable(\\"${partyHint}\\")
println(party.party.toLf)
sys.exit(0)' | /app/bin/canton daemon -c /app/app.conf --auto-connect-local --bootstrap /dev/stdin 2>&1" | grep '^${partyHint}::' | head -1
`;

      await writeFile(scriptPath, scriptContent, { mode: 0o755 });

      try {
        app.log.info('Executing Canton console script', { scriptPath });

        const { stdout, stderr } = await exec(`bash ${scriptPath}`, { timeout: 30000 });

        app.log.info('Canton console output', { stdout: stdout.trim(), stderr });

        // Parse partyId from output (format: partyHint::fingerprint)
        const partyId = stdout.trim();

        if (!partyId || !partyId.includes('::')) {
          throw new Error(`Failed to allocate party - output: "${stdout}"`);
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
      } finally {
        // Clean up temp script
        try {
          await unlink(scriptPath);
        } catch (e) {
          app.log.warn('Failed to delete temp script', { scriptPath, error: e.message });
        }
      }

    } catch (error) {
      app.log.error('Failed to create external wallet', { error: error.message });
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