import { Router } from 'express'
import { getCentreQueue, getQueueETA } from '../../services/queueService'

const router = Router()

// Public: Get current queue state and tokens for a centre
router.get('/:centreId', async (req, res) => {
  try {
    const centreId = Array.isArray(req.params.centreId) ? req.params.centreId[0] : req.params.centreId
    const queueData = await getCentreQueue(centreId)
    res.status(200).json(queueData)
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to fetch queue' })
  }
})

// Public: Calculate dynamic ETA for a specific booking or next in line
router.get('/:centreId/eta', async (req, res) => {
  try {
    const centreId = Array.isArray(req.params.centreId) ? req.params.centreId[0] : req.params.centreId
    const bookingId = typeof req.query.bookingId === 'string' ? req.query.bookingId : undefined
    const etaData = await getQueueETA(centreId, bookingId)
    res.status(200).json(etaData)
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to calculate queue ETA' })
  }
})

export default router
