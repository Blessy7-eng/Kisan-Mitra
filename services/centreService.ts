import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { AuthenticatedUser } from '@/lib/auth'
import { calculateCentreLoad, getCentreStatus } from '@/lib/smartQueueEngine'
import { recalculateCentreQueueAndBroadcast } from './queueService'

export interface CentreUpdateInput {
  name?: string
  location?: string
  dailyCapacity?: number
  processingRate?: number
  currentQueue?: number
  status?: string
}

export async function listCentres() {
  const centres = await prisma.centre.findMany({
    include: {
      _count: {
        select: {
          slots: true,
          bookings: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return centres.map((centre) => {
    const centreLoad = calculateCentreLoad({
      queue: centre.currentQueue,
      capacity: centre.dailyCapacity,
      processingMinutes: centre.processingRate,
      delayMinutes: 0,
      bookings: centre._count.bookings,
      counters: 4,
    })

    return {
      ...centre,
      calculatedLoadPercent: centreLoad,
      loadStatus: getCentreStatus(centreLoad),
    }
  })
}

export async function getCentreById(id: string) {
  const centre = await prisma.centre.findUnique({
    where: { id },
    include: {
      slots: {
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      },
      _count: {
        select: {
          bookings: true,
        },
      },
    },
  })

  if (!centre) {
    throw new Error('Centre not found')
  }

  const centreLoad = calculateCentreLoad({
    queue: centre.currentQueue,
    capacity: centre.dailyCapacity,
    processingMinutes: centre.processingRate,
    delayMinutes: 0,
    bookings: centre._count.bookings,
    counters: 4,
  })

  return {
    ...centre,
    calculatedLoadPercent: centreLoad,
    loadStatus: getCentreStatus(centreLoad),
  }
}

export async function updateCentre(
  id: string,
  input: CentreUpdateInput,
  currentUser: AuthenticatedUser
) {
  // Security Checks
  if (currentUser.role === Role.FARMER) {
    const error: any = new Error('Forbidden: Farmers cannot modify centre parameters')
    error.statusCode = 403
    throw error
  }

  if (currentUser.role === Role.OFFICER) {
    if (currentUser.assignedCentreId && currentUser.assignedCentreId !== id) {
      const error: any = new Error('Forbidden: Officers can only manage their assigned centre')
      error.statusCode = 403
      throw error
    }
  }

  const existing = await prisma.centre.findUnique({ where: { id } })
  if (!existing) {
    const error: any = new Error('Centre not found')
    error.statusCode = 404
    throw error
  }

  const updated = await prisma.centre.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.dailyCapacity !== undefined && { dailyCapacity: Number(input.dailyCapacity) }),
      ...(input.processingRate !== undefined && { processingRate: Number(input.processingRate) }),
      ...(input.currentQueue !== undefined && { currentQueue: Math.max(0, Number(input.currentQueue)) }),
      ...(input.status !== undefined && { status: input.status }),
    },
  })

  // STEP 4 & 5: Trigger queue recalculation orchestration and Socket.IO broadcast
  const queueRecalc = await recalculateCentreQueueAndBroadcast(id)

  return {
    ...updated,
    calculatedLoadPercent: queueRecalc.loadPercent,
    loadStatus: queueRecalc.centreStatus,
    recalculatedQueue: queueRecalc.updates,
  }
}
