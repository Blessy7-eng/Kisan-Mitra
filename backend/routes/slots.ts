import { Router } from 'express'
import { createSlot } from '../../services/slotService'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Authenticated (Officer / Admin): Create new procurement time slot
router.post('/', authenticateToken, async (req, res) => {
  try {
    const slot = await createSlot(req.body, req.user!)
    res.status(201).json({ slot })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to create slot' })
  }
})

export default router
