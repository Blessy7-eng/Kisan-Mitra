import { prisma } from '@/lib/prisma'
import { AuthenticatedUser, sanitizeUser, hashPassword } from '@/lib/auth'
import { Role } from '@prisma/client'

export async function listUsers(currentUser: AuthenticatedUser) {
  if (currentUser.role !== Role.ADMIN) {
    const error: any = new Error('Forbidden: Only Administrators can list all users')
    error.statusCode = 403
    throw error
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return users.map(sanitizeUser)
}

export async function getUserProfile(userId: string, currentUser: AuthenticatedUser) {
  if (currentUser.role !== Role.ADMIN && currentUser.id !== userId) {
    const error: any = new Error('Forbidden: You can only view your own user profile')
    error.statusCode = 403
    throw error
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    const error: any = new Error('User not found')
    error.statusCode = 404
    throw error
  }

  return sanitizeUser(user)
}

export async function updateUserProfile(
  userId: string,
  data: { name?: string; language?: string; password?: string },
  currentUser: AuthenticatedUser
) {
  if (currentUser.role !== Role.ADMIN && currentUser.id !== userId) {
    const error: any = new Error('Forbidden: You can only update your own user profile')
    error.statusCode = 403
    throw error
  }

  const updateData: any = {}
  if (data.name) updateData.name = data.name.trim()
  if (data.language) updateData.language = data.language
  if (data.password) {
    if (data.password.length < 6) {
      const error: any = new Error('Password must be at least 6 characters')
      error.statusCode = 400
      throw error
    }
    updateData.passwordHash = await hashPassword(data.password)
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  })

  return sanitizeUser(updated)
}
