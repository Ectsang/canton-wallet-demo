import sdkManager from '../sdkManager.js'

export default async function initRoutes(app) {
  app.post('/api/init', {
    schema: {
      description: 'Initialize SDK connections (user, admin, topology)',
      tags: ['init'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            initialized: { type: 'boolean' },
            topologyConnected: { type: 'boolean' },
          },
          required: ['status', 'initialized', 'topologyConnected']
        }
      }
    }
  }, async (req, reply) => {
    try {
      const status = await sdkManager.init()
      return reply.send({ status: 'ok', ...status })
    } catch (err) {
      req.log.error({ err }, 'init failed')
      return reply.code(500).send({ status: 'error', message: err.message })
    }
  })
}


