/**
 * CN Quickstart Integration Routes
 * Direct JSON Ledger API routes for custom DAML contracts
 *
 * These routes use CN Quickstart LocalNet's App Provider party and authentication
 */

import CNQuickstartLedgerService from '../../src/services/cnQuickstartLedgerService.js';

// Singleton service instance
let ledgerService = null;

function getLedgerService() {
  if (!ledgerService) {
    ledgerService = new CNQuickstartLedgerService();
  }
  return ledgerService;
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
            holdingId: { type: 'string' },
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

      app.log.info('Tokens minted successfully', {
        holdingId: result.holdingId,
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
            holdingCount: { type: 'number' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { owner } = req.params;
      const { instrumentId } = req.query;

      app.log.info('Querying balance via CN Quickstart', { owner, instrumentId });

      const service = getLedgerService();
      const result = await service.queryHoldings({
        owner,
        instrumentId
      });

      app.log.info('Balance query successful', {
        owner,
        totalBalance: result.totalBalance,
        holdingCount: result.holdingCount
      });

      return result;

    } catch (error) {
      app.log.error('Failed to query balance', { error: error.message });
      reply.code(400);
      return {
        success: false,
        error: 'BalanceQueryFailed',
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