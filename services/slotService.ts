import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { AuthenticatedUser } from '@/lib/auth'

export interface CreateSlotInput {
  centreId: string
  date: string | Date
  startTime: string
  endTime: string
  capacity?: number
}

export async function getSlotsByCentre(centreId: string, dateFilter?: string) {
  const centre = await prisma.centre.findUnique({ where: { id: centreId } })
  if (!centre) {
    const error: any = new Error('Centre not found')
    error.statusCode = 404
    throw error
  }

  const whereClause: any = { centreId }
  if (dateFilter) {
    const startOfDay = new Date(dateFilter)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const endOfDay = new Date(dateFilter)
    endOfDay.setUTCHours(23, 59, 59, 999)
    whereClause.date = {
      gte: startOfDay,
      lte: endOfDay,
    }
  }

  const slots = await prisma.slot.findMany({
    where: whereClause,
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  })

  return slots.map((slot) => ({
    ...slot,
    availableCapacity: Math.max(0, slot.capacity - slot.bookedCount),
    isFull: slot.bookedCount >= slot.capacity,
  }))
}

export async function createSlot(input: CreateSlotInput, currentUser: AuthenticatedUser) {
  if (currentUser.role === Role.FARMER) {
    const error: any = new Error('Forbidden: Farmers cannot create slots')
    error.statusCode = 403
    throw error
  }

  if (currentUser.role === Role.OFFICER) {
    if (currentUser.assignedCentreId && currentUser.assignedCentreId !== input.centreId) {
      const error: any = new Error('Forbidden: Officers can only create slots for their assigned centre')
      error.statusCode = 403
      throw error
    }
  }

  const { centreId, date, startTime, endTime, capacity = 15 } = input

  if (!centreId || !date || !startTime || !endTime) {
    const error: any = new Error('centreId, date, startTime, and endTime are required')
    error.statusCode = 400
    throw error
  }

  const centre = await prisma.centre.findUnique({ where: { id: centreId } })
  if (!centre) {
    const error: any = new Error('Centre not found')
    error.statusCode = 404
    throw error
  }

  const slotDate = new Date(date)

  const slot = await prisma.slot.create({
    data: {
      centreId,
      date: slotDate,
      startTime,
      endTime,
      capacity: Number(capacity),
      bookedCount: 0,
      status: 'OPEN',
    },
  })

  return slot
}
