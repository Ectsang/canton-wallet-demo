import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import dotenv from 'dotenv'
import initRoutes from './routes/init.js'
import sdkManager from './sdkManager.js'

dotenv.config({ path: '.env.server' })

const PORT = Number(process.env.PORT || 8899)
const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'production' ? undefined : {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', colorize: true }
    }
  }
})

await app.register(cors, { origin: ORIGIN, credentials: true })

await app.register(swagger, {
  openapi: {
    info: { title: 'Canton Wallet BFF', version: '0.1.0' }
  }
})
await app.register(swaggerUI, { routePrefix: '/docs', staticCSP: true })

// Expose logger to SDK manager
sdkManager.setLogger(app.log)

await initRoutes(app)

app.get('/api/health', async (req, reply) => {
  return {
    status: 'ok',
    sdk: 'not-initialized',
    time: new Date().toISOString(),
  }
})

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`BFF listening on http://localhost:${PORT}`)
  app.log.info(`Docs at http://localhost:${PORT}/docs`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}


