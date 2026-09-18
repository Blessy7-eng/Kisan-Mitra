import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { getBookingPaymentStatus, listFarmerPayments } from '../../services/paymentService'

const router = Router()

// Authenticated: Get payment / DBT status for a specific booking
router.get('/booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const bookingId = Array.isArray(req.params.bookingId) ? req.params.bookingId[0] : req.params.bookingId
    const payment = await getBookingPaymentStatus(bookingId, req.user!)
    res.status(200).json({ payment })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to fetch payment status' })
  }
})

// Authenticated: List payments for a farmer
router.get('/farmer/:farmerId', authenticateToken, async (req, res) => {
  try {
    const farmerId = Array.isArray(req.params.farmerId) ? req.params.farmerId[0] : req.params.farmerId
    const payments = await listFarmerPayments(farmerId, req.user!)
    res.status(200).json({ payments })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to fetch farmer payments' })
  }
})

export default router
