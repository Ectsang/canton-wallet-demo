import Fastify from 'fastify'
import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUI from '@fastify/swagger-ui'
import dotenv from 'dotenv'
import initRoutes from './routes/init.js'
import damlRoutes from './routes/daml.js'
import sdkManager from './sdkManager.js'

dotenv.config({ path: '.env.server' })

const PORT = Number(process.env.PORT || 8899)
const ORIGIN = process.env.CORS_ORIGIN || ''

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'production' ? undefined : {
      target: 'pino-pretty',
      options: { translateTime: 'SYS:standard', colorize: true }
    }
  }
})

const allowedOrigins = ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
await app.register(cors, { 
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.length > 0) {
      return cb(null, allowedOrigins.includes(origin))
    }
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
    return cb(null, isLocalhost)
  },
  credentials: true
})

await app.register(swagger, {
  openapi: {
    info: { title: 'Canton Wallet Backend', version: '0.1.0' }
  }
})
await app.register(swaggerUI, { routePrefix: '/docs', staticCSP: true })

// Expose logger to SDK manager
sdkManager.setLogger(app.log)

await initRoutes(app)
await damlRoutes(app)

app.get('/api/health', async (req, reply) => {
  return {
    status: 'ok',
    sdk: 'not-initialized',
    time: new Date().toISOString(),
  }
})

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`Backend listening on http://localhost:${PORT}`)
  app.log.info(`Docs at http://localhost:${PORT}/docs`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}


