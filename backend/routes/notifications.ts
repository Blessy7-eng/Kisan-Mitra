import { Router } from 'express'
import { authenticateToken } from '../middleware/auth'
import { getUserNotifications } from '../../services/notificationService'

const router = Router()

// Authenticated: Get notifications for the current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await getUserNotifications(req.user!)
    res.status(200).json({ notifications })
  } catch (error: any) {
    const status = error.statusCode || 500
    res.status(status).json({ error: error.message || 'Failed to fetch notifications' })
  }
})

export default router
