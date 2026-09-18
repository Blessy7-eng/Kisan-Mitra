import { Router } from 'express'
import { listCentres, getCentreById, updateCentre } from '../../services/centreService'
import { getSlotsByCentre } from '../../services/slotService'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Public: List all procurement centres with load metrics
router.get('/', async (_req, res) => {
  try {
    const centres = await listCentres()
    res.status(200).json({ centres })
  } catch (error: any) {
    const status = error.statusCode || 500
    res.status(status).json({ error: error.message || 'Failed to fetch centres' })
  }
})

// Public: Get specific centre details and upcoming slots
router.get('/:id', async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const centre = await getCentreById(id)
    res.status(200).json({ centre })
  } catch (error: any) {
    const status = error.statusCode || 404
    res.status(status).json({ error: error.message || 'Centre not found' })
  }
})

// Authenticated (Officer for assigned centre / Admin): Update operational parameters
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const updated = await updateCentre(id, req.body, req.user!)
    res.status(200).json({ centre: updated })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to update centre' })
  }
})

// Authenticated: Get slots for a centre (optional ?date=YYYY-MM-DD filter)
router.get('/:id/slots', authenticateToken, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const date = typeof req.query.date === 'string' ? req.query.date : undefined
    const slots = await getSlotsByCentre(id, date)
    res.status(200).json({ slots })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to fetch slots' })
  }
})

export default router
