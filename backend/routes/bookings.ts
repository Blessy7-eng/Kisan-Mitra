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
    // Log full detailed Prisma/DB error only on the server
    console.error('[POST /api/bookings Error]:', error)

    const rawMessage = typeof error?.message === 'string' ? error.message : ''
    const errorCode = error?.code || ''

    const isTimeoutOrDbFailure =
      errorCode === 'P2024' ||
      errorCode === 'P2028' ||
      errorCode === 'P1001' ||
      errorCode === 'P1008' ||
      errorCode === 'P1017' ||
      rawMessage.includes('Transaction API error') ||
      rawMessage.includes('expired transaction') ||
      rawMessage.includes('timeout') ||
      rawMessage.includes('Timeout') ||
      rawMessage.includes('connection') ||
      rawMessage.includes('ECONNREFUSED') ||
      rawMessage.includes('ETIMEDOUT') ||
      rawMessage.includes('PrismaClient')

    const isSlotUnavailable =
      rawMessage.includes('slot is no longer available') ||
      rawMessage.includes('Selected slot is fully booked') ||
      rawMessage.includes('Slot not found') ||
      rawMessage.includes('Procurement centre not found')

    const isDuplicate =
      errorCode === 'P2002' ||
      rawMessage.includes('already have an active booking')

    if (isTimeoutOrDbFailure) {
      return res.status(503).json({
        error: 'Booking is taking longer than expected. Please try again.',
      })
    }

    if (isDuplicate) {
      return res.status(409).json({
        error: 'You already have an active booking.',
      })
    }

    if (isSlotUnavailable) {
      return res.status(409).json({
        error: 'This slot is no longer available. Please select another slot.',
      })
    }

    const status = error.statusCode || 400
    // Strictly sanitized message (never leak Prisma stack or internals)
    const clientSafeMessage =
      typeof error.message === 'string' &&
      !error.message.includes('prisma') &&
      !error.message.includes('SELECT') &&
      !error.message.includes('at ') &&
      !error.message.includes('file://') &&
      !error.message.includes('Database')
        ? error.message
        : 'Booking is taking longer than expected. Please try again.'

    res.status(status).json({ error: clientSafeMessage })
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
