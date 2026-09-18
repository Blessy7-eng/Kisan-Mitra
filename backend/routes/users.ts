import { Router } from 'express'
import { authenticateToken, requireRole } from '../middleware/auth'
import { listUsers, getUserProfile, updateUserProfile } from '../../services/userService'
import { Role } from '@prisma/client'

const router = Router()

// Admin: List all registered users
router.get('/', authenticateToken, requireRole([Role.ADMIN]), async (req, res) => {
  try {
    const users = await listUsers(req.user!)
    res.status(200).json({ users })
  } catch (error: any) {
    const status = error.statusCode || 500
    res.status(status).json({ error: error.message || 'Failed to fetch users' })
  }
})

// Authenticated: Get profile of user
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const user = await getUserProfile(id, req.user!)
    res.status(200).json({ user })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to fetch profile' })
  }
})

// Authenticated: Update profile
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const updated = await updateUserProfile(id, req.body, req.user!)
    res.status(200).json({ user: updated })
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Failed to update profile' })
  }
})

export default router
