import { Router } from 'express'
import { registerUser, loginUser } from '../../services/authService'
import { authenticateToken } from '../middleware/auth'
import { Role } from '@prisma/client'

const router = Router()

// Public Registration - Security Fix: Enforce FARMER role for all public self-registrations
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, language } = req.body

    // Mitigate privilege escalation: Public registration cannot create OFFICER or ADMIN
    const result = await registerUser({
      name,
      phone,
      password,
      language,
      role: Role.FARMER,
    })

    res.status(201).json(result)
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Registration failed' })
  }
})

// Public Login
router.post('/login', async (req, res) => {
  try {
    const { phone, password, role, expectedRole } = req.body
    const targetRole = expectedRole || role
    const result = await loginUser({ phone, password, expectedRole: targetRole })
    res.status(200).json(result)
  } catch (error: any) {
    const status = error.statusCode || 400
    res.status(status).json({ error: error.message || 'Login failed' })
  }
})

// Authenticated Session Profile Check
router.get('/me', authenticateToken, (req, res) => {
  res.status(200).json({ user: req.user })
})

export default router
