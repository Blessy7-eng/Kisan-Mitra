import { Router } from 'express'
import { authenticateToken, requireRole } from '../middleware/auth'
import { updateProcurementStage, getProcurementSummary } from '../../services/procurementService'
import { Role } from '@prisma/client'

const router = Router()

// Officer / Admin: Update procurement stage (weighing, inspection, completed)
router.post('/stage', authenticateToken, requireRole([Role.OFFICER, Role.ADMIN]), async (req, res) => {
  try {
    const { bookingId, stage, produceType, weightQuintals, moisturePercent, grade, notes } = req.body
    if (!bookingId || !stage) {
      return res.status(400).json({ error: 'bookingId and stage are required' })
    }

    const result = await updateProcurementStage(
      {
        bookingId,
        stage,
        produceType,
        weightQuintals,
        moisturePercent,
        grade,
        notes,
      },
      req.user!
    )

    res.status(200).json({ procurement: result })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to update procurement stage' })
  }
})

// Officer / Admin: Summary of procurement for a centre
router.get('/summary/:centreId', authenticateToken, requireRole([Role.OFFICER, Role.ADMIN]), async (req, res) => {
  try {
    const centreId = Array.isArray(req.params.centreId) ? req.params.centreId[0] : req.params.centreId
    const summary = await getProcurementSummary(centreId, req.user!)
    res.status(200).json({ summary })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to fetch procurement summary' })
  }
})

export default router
