import express, { Express } from 'express'
import authRouter from './routes/auth'
import centresRouter from './routes/centres'
import slotsRouter from './routes/slots'
import bookingsRouter from './routes/bookings'
import farmersRouter from './routes/farmers'
import queueRouter from './routes/queue'
import usersRouter from './routes/users'
import procurementRouter from './routes/procurement'
import paymentsRouter from './routes/payments'
import notificationsRouter from './routes/notifications'
import { errorHandler } from './middleware/errorHandler'
import { checkDatabaseHealth } from '../lib/prisma'

export function createExpressApp(): Express {
  const app = express()

  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // Health check
  app.get('/api/health', async (_req, res) => {
    try {
      const dbHealth = await checkDatabaseHealth()
      if (!dbHealth.connected) {
        res.status(503).json({
          status: 'unhealthy',
          service: 'Kisan-Mitra Express Backend',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
        })
        return
      }

      res.status(200).json({
        status: 'ok',
        service: 'Kisan-Mitra Express Backend',
        database: dbHealth.mode === 'mysql' ? 'connected' : 'fallback_memory',
        timestamp: new Date().toISOString(),
      })
    } catch {
      res.status(503).json({
        status: 'unhealthy',
        service: 'Kisan-Mitra Express Backend',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      })
    }
  })

  // Express REST API Routers
  app.use('/api/auth', authRouter)
  app.use('/api/centres', centresRouter)
  app.use('/api/slots', slotsRouter)
  app.use('/api/bookings', bookingsRouter)
  app.use('/api/farmers', farmersRouter)
  app.use('/api/queue', queueRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/procurement', procurementRouter)
  app.use('/api/payments', paymentsRouter)
  app.use('/api/notifications', notificationsRouter)

  // Error Handler Middleware
  app.use(errorHandler)

  return app
}
