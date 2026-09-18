import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) {
    return secret
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Kisan-Mitra] Warning: JWT_SECRET environment variable is not set in production. Using fallback secret.')
  }
  return 'kisan-mitra-dev-fallback-secret-non-production'
}

export interface AuthTokenPayload {
  userId: string
  phone: string
  role: Role
  assignedCentreId?: string | null
}

export interface AuthenticatedUser {
  id: string
  name: string
  phone: string
  role: Role
  language: string
  assignedCentreId: string | null
  createdAt: Date
  updatedAt: Date
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthTokenPayload
  } catch {
    return null
  }
}

export function getAuthTokenFromHeader(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7).trim()
}

export function sanitizeUser<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
  const copy = { ...user }
  delete copy.passwordHash
  return copy
}
