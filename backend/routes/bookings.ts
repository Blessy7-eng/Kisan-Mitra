import { Router } from 'express'
import { createBooking, getBookingById, updateBookingStatus } from '../../services/bookingService'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// Authenticated (FARMER): Reserve slot and generate token
router.post('/', authenticateToken, async (req, res) => {
  try {
    const booking = await createBooking(req.body, req.user!)
    res.status(201).json({ booking })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to create booking' })
  }
})

// Authenticated (Owner / Assigned Officer / Admin): Get booking by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const booking = await getBookingById(id, req.user!)
    res.status(200).json({ booking })
  } catch (error: any) {
    const status = error.statusCode || 404
    res.status(status).json({ error: error.message || 'Booking not found' })
  }
})

// Authenticated (Farmer can cancel / Officer can progress lifecycle): Update booking status
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const updated = await updateBookingStatus(id, req.body, req.user!)
    res.status(200).json({ booking: updated })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to update booking status' })
  }
})

export default router
