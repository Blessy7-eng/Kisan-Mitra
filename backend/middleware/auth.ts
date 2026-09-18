import { Request, Response, NextFunction } from 'express'
import { verifyToken, sanitizeUser, AuthenticatedUser } from '../../lib/auth'
import { prisma } from '../../lib/prisma'
import { Role } from '@prisma/client'

// Extend Express Request type to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token' })
      return
    }

    const token = authHeader.substring(7).trim()
    const payload = verifyToken(token)

    if (!payload || !payload.userId) {
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User account not found' })
      return
    }

    req.user = sanitizeUser(user) as AuthenticatedUser
    next()
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized: Authentication failed' })
  }
}

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' })
      return
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Access restricted to roles: ${allowedRoles.join(', ')}`,
      })
      return
    }

    next()
  }
}
