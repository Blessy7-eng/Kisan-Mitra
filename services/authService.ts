import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import {
  hashPassword,
  comparePassword,
  signToken,
  getAuthTokenFromHeader,
  verifyToken,
  sanitizeUser,
  AuthenticatedUser,
} from '@/lib/auth'

export interface RegisterInput {
  name: string
  phone: string
  password: string
  email?: string
  role?: Role
  language?: string
  assignedCentreId?: string
}

export interface LoginInput {
  phone: string
  password: string
}

export async function registerUser(input: RegisterInput) {
  const { name, phone, password, role = Role.FARMER, language = 'en', assignedCentreId } = input

  if (!name || !phone || !password) {
    throw new Error('Name, phone, and password are required')
  }

  const cleanPhone = phone.trim()
  if (cleanPhone.length < 10) {
    throw new Error('Phone number must be at least 10 digits')
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  const existing = await prisma.user.findUnique({
    where: { phone: cleanPhone },
  })

  if (existing) {
    throw new Error('User with this phone number already exists')
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      phone: cleanPhone,
      passwordHash,
      role,
      language,
      assignedCentreId: assignedCentreId || null,
    },
  })

  const token = signToken({
    userId: user.id,
    phone: user.phone,
    role: user.role,
    assignedCentreId: user.assignedCentreId,
  })

  return {
    user: sanitizeUser(user),
    token,
  }
}

export async function loginUser(input: LoginInput) {
  const { phone, password } = input

  if (!phone || !password) {
    throw new Error('User ID or mobile number and password are required')
  }

  const cleanPhone = phone.trim()

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: cleanPhone },
        { id: cleanPhone },
      ],
    },
  })

  if (!user) {
    throw new Error('Invalid User ID / mobile number or password')
  }

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) {
    throw new Error('Invalid User ID / mobile number or password')
  }

  const token = signToken({
    userId: user.id,
    phone: user.phone,
    role: user.role,
    assignedCentreId: user.assignedCentreId,
  })

  return {
    user: sanitizeUser(user),
    token,
  }
}

export async function authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
  const token = getAuthTokenFromHeader(req)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload || !payload.userId) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  })

  if (!user) return null

  return sanitizeUser(user) as AuthenticatedUser
}
