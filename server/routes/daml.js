/**
 * DAML Routes - Phase 2 Implementation
 * Real DAML contract endpoints for MinimalToken operations
 */

import CantonConsoleService from '../../src/services/cantonConsoleService.js';
import MockCantonService from '../../src/services/mockCantonService.js';
import DamlLedgerService from '../../src/services/damlLedgerService.js';
import sdkManager from '../sdkManager.js';

export default async function damlRoutes(app) {
  // Initialize DAML service
  let damlService = null;
  
  const getDamlService = async () => {
    if (!damlService) {
      // Use real Canton service now that LocalNet authentication is fixed
      const useMockService = process.env.USE_MOCK_SERVICE === 'true'; // Only use mock if explicitly requested
      
      if (useMockService) {
        app.log.info('Using Mock Canton Service (USE_MOCK_SERVICE=true)');
        damlService = new MockCantonService();
        await damlService.initialize();
      } else {
        if (!sdkManager.sdk) {
          await sdkManager.init();
        }
        // Use CantonConsoleService for direct Canton console integration
        damlService = new CantonConsoleService();
        // Set the party ID from the SDK manager if available
        if (sdkManager.sdk?.userLedger?.partyId) {
          damlService.setPartyId(sdkManager.sdk.userLedger.partyId);
        }
      }
    }
    return damlService;
  };

  // POST /api/daml/wallets - Create external wallet
  app.post('/api/daml/wallets', {
    schema: {
      description: 'Create an external wallet with cryptographic keys',
      tags: ['daml'],
      body: {
        type: 'object',
        properties: {
          partyHint: { type: 'string', description: 'Party hint for wallet creation' }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            partyId: { type: 'string' },
            publicKey: { type: 'string' },
            privateKey: { type: 'string' },
            fingerprint: { type: 'string' },
            partyHint: { type: 'string' },
            createdAt: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { partyHint = 'demo-wallet' } = req.body;
      
      app.log.info('Creating external wallet', { 
        reqId: req.id,
        partyHint
      });

      const service = await getDamlService();
      const walletInfo = await service.createExternalWallet(partyHint);

      app.log.info('External wallet created successfully', {
        reqId: req.id,
        partyId: walletInfo.partyId,
        fingerprint: walletInfo.fingerprint
      });

      return walletInfo;
    } catch (error) {
      app.log.error('Failed to create external wallet', {
        reqId: req.id,
        error: error.message,
        stack: error.stack
      });
      
      reply.code(500);
      return { 
        error: 'Failed to create external wallet',
        message: error.message 
      };
    }
  });

  // POST /api/daml/instruments - Create MinimalToken Instrument contract
  app.post('/api/daml/instruments', {
    schema: {
      description: 'Create a MinimalToken Instrument contract on Canton ledger',
      tags: ['daml'],
      body: {
        type: 'object',
        properties: {
          admin: { type: 'string', description: 'Admin party ID' },
          name: { type: 'string', description: 'Token name' },
          symbol: { type: 'string', description: 'Token symbol' },
          decimals: { type: 'integer', minimum: 0, maximum: 18, description: 'Token decimals' }
        },
        required: ['admin', 'name', 'symbol', 'decimals'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            contractId: { type: 'string' },
            admin: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            decimals: { type: 'integer' },
            transactionId: { type: 'string' },
            createdAt: { type: 'string' }
          },
          required: ['contractId', 'admin', 'name', 'symbol', 'decimals', 'transactionId']
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { admin, name, symbol, decimals } = req.body;
      
      req.log.info({ admin, name, symbol, decimals }, 'Creating MinimalToken Instrument contract');
      
      // Use dedicated DAML Ledger Service for contract creation
      const damlLedgerService = new DamlLedgerService();
      let result;
      
      try {
        result = await damlLedgerService.createInstrument({
          admin,
          name,
          symbol,
          decimals
        });
        req.log.info('Used DAML Ledger Service successfully');
      } catch (damlError) {
        req.log.warn({ error: damlError.message }, 'DAML Ledger Service failed, trying Canton Wallet SDK methods');
        
        // Fallback to Canton Wallet SDK methods (though they won't work for contract creation)
        const service = await getDamlService();
        try {
          result = await service.testDirectDamlJsonApi({
            admin,
            name,
            symbol,
            decimals
          });
          req.log.info('Used Canton SDK direct API test successfully');
        } catch (testError) {
          req.log.warn({ error: testError.message }, 'All methods failed');
          throw new Error(`Contract creation failed: ${damlError.message}`);
        }
      }
      
      req.log.info({ contractId: result.contractId }, 'Instrument contract created successfully');
      
      return reply.send(result);
    } catch (error) {
      req.log.error({ error: error.message }, 'Failed to create instrument contract');
      return reply.code(400).send({
        error: 'InstrumentCreationFailed',
        message: error.message
      });
    }
  });

  // GET /api/daml/instruments/:id - Query Instrument contract
  app.get('/api/daml/instruments/:id', {
    schema: {
      description: 'Query a MinimalToken Instrument contract by ID',
      tags: ['daml'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Instrument contract ID' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            contractId: { type: 'string' },
            admin: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            decimals: { type: 'integer' },
            createdAt: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params;
      
      req.log.info({ instrumentId: id }, 'Querying instrument contract');
      
      const service = await getDamlService();
      const result = await service.getInstrument(id);
      
      return reply.send(result);
    } catch (error) {
      req.log.error({ error: error.message, instrumentId: req.params.id }, 'Failed to query instrument');
      
      if (error.message.includes('not found')) {
        return reply.code(404).send({
          error: 'InstrumentNotFound',
          message: error.message
        });
      }
      
      return reply.code(400).send({
        error: 'InstrumentQueryFailed',
        message: error.message
      });
    }
  });

  // POST /api/daml/issue - Issue tokens (mint) using DAML Issue choice
  app.post('/api/daml/issue', {
    schema: {
      description: 'Issue (mint) tokens using MinimalToken Issue choice',
      tags: ['daml'],
      body: {
        type: 'object',
        properties: {
          instrumentId: { type: 'string', description: 'Instrument contract ID' },
          owner: { type: 'string', description: 'Token recipient party ID' },
          amount: { type: 'number', minimum: 0, description: 'Amount to mint' },
          admin: { type: 'string', description: 'Admin party ID (who can exercise Issue choice)' }
        },
        required: ['instrumentId', 'owner', 'amount', 'admin'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            contractId: { type: 'string' },
            owner: { type: 'string' },
            instrumentId: { type: 'string' },
            amount: { type: 'number' },
            transactionId: { type: 'string' },
            createdAt: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { 
              type: 'object',
              additionalProperties: true
            }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { instrumentId, owner, amount, admin } = req.body;
      
      req.log.info({ instrumentId, owner, amount, admin }, 'Issuing tokens via DAML Issue choice');
      
      const service = await getDamlService();
      const result = await service.issueTokens({
        instrumentId,
        owner,
        amount,
        admin
      });
      
      req.log.info({ holdingId: result.contractId, amount }, 'Tokens issued successfully');
      
      return reply.send(result);
    } catch (error) {
      req.log.error({ 
        error: error.message, 
        stack: error.stack,
        name: error.name,
        cause: error.cause 
      }, 'Failed to issue tokens');
      
      // Return detailed error for debugging
      return reply.code(400).send({
        error: 'TokenIssuanceFailed',
        message: error.message || 'Unknown error',
        details: {
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines of stack
          cause: error.cause
        }
      });
    }
  });

  // GET /api/daml/balance/:partyId/:instrumentId - Get token balance
  app.get('/api/daml/balance/:partyId/:instrumentId', {
    schema: {
      description: 'Get token balance by aggregating Holding contracts',
      tags: ['daml'],
      params: {
        type: 'object',
        properties: {
          partyId: { type: 'string', description: 'Party ID to check balance for' },
          instrumentId: { type: 'string', description: 'Instrument contract ID' }
        },
        required: ['partyId', 'instrumentId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            partyId: { type: 'string' },
            instrumentId: { type: 'string' },
            balance: { type: 'number' },
            holdingCount: { type: 'integer' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { partyId, instrumentId } = req.params;
      
      req.log.info({ partyId, instrumentId }, 'Querying token balance');
      
      const service = await getDamlService();
      const balanceResult = await service.getBalance(partyId, instrumentId);
      
      const result = {
        partyId,
        instrumentId,
        balance: balanceResult.balance || 0,
        holdingCount: balanceResult.holdingCount || 0
      };
      
      req.log.info(result, 'Balance query completed');
      
      return reply.send(result);
    } catch (error) {
      req.log.error({ error: error.message }, 'Failed to query balance');
      return reply.code(400).send({
        error: 'BalanceQueryFailed',
        message: error.message
      });
    }
  });

  // GET /api/daml/holdings/:partyId - List all holdings for a party
  app.get('/api/daml/holdings/:partyId', {
    schema: {
      description: 'List all Holding contracts for a party',
      tags: ['daml'],
      params: {
        type: 'object',
        properties: {
          partyId: { type: 'string', description: 'Party ID to list holdings for' }
        },
        required: ['partyId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            partyId: { type: 'string' },
            holdings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contractId: { type: 'string' },
                  owner: { type: 'string' },
                  instrumentId: { type: 'string' },
                  amount: { type: 'number' },
                  createdAt: { type: 'string' }
                }
              }
            },
            totalHoldings: { type: 'integer' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const { partyId } = req.params;
      
      req.log.info({ partyId }, 'Listing holdings for party');
      
      const service = await getDamlService();
      const holdings = await service.listHoldings(partyId);
      
      const result = {
        partyId,
        holdings,
        totalHoldings: holdings.length
      };
      
      req.log.info({ partyId, count: holdings.length }, 'Holdings listed successfully');
      
      return reply.send(result);
    } catch (error) {
      req.log.error({ error: error.message }, 'Failed to list holdings');
      return reply.code(400).send({
        error: 'HoldingsQueryFailed',
        message: error.message
      });
    }
  });

  // GET /api/daml/instruments - List all created instruments
  app.get('/api/daml/instruments', {
    schema: {
      description: 'List all created Instrument contracts',
      tags: ['daml'],
      response: {
        200: {
          type: 'object',
          properties: {
            instruments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contractId: { type: 'string' },
                  admin: { type: 'string' },
                  name: { type: 'string' },
                  symbol: { type: 'string' },
                  decimals: { type: 'integer' },
                  transactionId: { type: 'string' },
                  createdAt: { type: 'string' }
                }
              }
            },
            totalInstruments: { type: 'integer' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      req.log.info('Listing all instruments');
      
      const service = await getDamlService();
      const instruments = service.listInstruments();
      
      const result = {
        instruments,
        totalInstruments: instruments.length
      };
      
      req.log.info({ count: instruments.length }, 'Instruments listed successfully');
      
      return reply.send(result);
    } catch (error) {
      req.log.error({ error: error.message }, 'Failed to list instruments');
      return reply.code(400).send({
        error: 'InstrumentsQueryFailed',
        message: error.message
      });
    }
  });

  // Debug endpoint to see contract state
  app.get('/api/daml/debug', {
    schema: {
      description: 'Debug endpoint to see DAML contract state',
      tags: ['daml'],
      response: {
        200: {
          type: 'object',
          properties: {
            serviceType: { type: 'string' },
            packageId: { type: 'string' },
            sdkConnected: { type: 'boolean' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const service = await getDamlService();
      
      return reply.send({
        serviceType: 'CantonConsoleService',
        consolePath: service.consolePath,
        partyId: service.partyId || 'Not set',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.code(500).send({
        error: 'DebugFailed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Health check for DAML service
  app.get('/api/daml/health', {
    schema: {
      description: 'DAML service health check',
      tags: ['daml'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            sdkInitialized: { type: 'boolean' },
            damlServiceReady: { type: 'boolean' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (req, reply) => {
    try {
      const sdkInitialized = !!sdkManager.sdk;
      const damlServiceReady = !!damlService;
      
      return reply.send({
        status: 'ok',
        sdkInitialized,
        damlServiceReady,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.code(500).send({
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}
