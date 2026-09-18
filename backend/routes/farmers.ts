import { Router } from 'express'
import { getFarmerBookings } from '../../services/bookingService'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Authenticated (Owner farmer / Officer / Admin): Get all bookings for farmer
router.get('/:id/bookings', authenticateToken, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const bookings = await getFarmerBookings(id, req.user!)
    res.status(200).json({ bookings })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to fetch farmer bookings' })
  }
})

export default router
