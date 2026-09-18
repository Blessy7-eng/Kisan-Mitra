import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'
import { AuthenticatedUser } from '@/lib/auth'
import {
  calculateETA,
  calculateArrivalWindow,
  CentreState,
} from '@/lib/smartQueueEngine'
import { recalculateCentreQueueAndBroadcast } from './queueService'

export interface CreateBookingInput {
  centreId: string
  slotId: string
}

export interface UpdateBookingStatusInput {
  status: 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'MISSED'
}

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i)
  if (!match) return 600
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const modifier = match[3]?.toUpperCase()
  if (modifier === 'PM' && hours < 12) hours += 12
  if (modifier === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

export async function createBooking(input: CreateBookingInput, currentUser: AuthenticatedUser) {
  // Rule 1: Only FARMER users can create their own farmer booking
  if (currentUser.role !== Role.FARMER) {
    const error: any = new Error('Forbidden: Only registered farmers can create procurement bookings')
    error.statusCode = 403
    throw error
  }

  const { centreId, slotId } = input
  if (!centreId || !slotId) {
    const error: any = new Error('centreId and slotId are required')
    error.statusCode = 400
    throw error
  }

  // Verify centre exists and is active
  const centre = await prisma.centre.findUnique({
    where: { id: centreId },
    include: {
      _count: {
        select: { bookings: true },
      },
    },
  })

  if (!centre) {
    const error: any = new Error('Procurement centre not found')
    error.statusCode = 404
    throw error
  }

  // Atomic check and update on slot capacity
  const bookingResult = await prisma.$transaction(async (tx) => {
    const slot = await tx.slot.findUnique({
      where: { id: slotId },
    })

    if (!slot) {
      const error: any = new Error('Slot not found')
      error.statusCode = 404
      throw error
    }

    if (slot.centreId !== centreId) {
      const error: any = new Error('Slot does not belong to the specified centre')
      error.statusCode = 400
      throw error
    }

    // Rule 6: Validate slot capacity
    if (slot.bookedCount >= slot.capacity || slot.status === 'FULL' || slot.status === 'CLOSED') {
      const error: any = new Error('Selected slot is fully booked or closed')
      error.statusCode = 409
      throw error
    }

    // Check if farmer already has an active booking for this date/centre
    const existingBooking = await tx.booking.findFirst({
      where: {
        farmerId: currentUser.id,
        slotId: slot.id,
        status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] },
      },
    })

    if (existingBooking) {
      const error: any = new Error('You already have an active booking for this time slot')
      error.statusCode = 409
      throw error
    }

    // Calculate queue position and ETA using existing Smart Queue Engine
    const waitingAhead = await tx.booking.count({
      where: {
        centreId,
        slotId,
        status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] },
      },
    })

    const centreState: CentreState = {
      queue: centre.currentQueue + waitingAhead,
      capacity: centre.dailyCapacity,
      processingMinutes: centre.processingRate,
      delayMinutes: 0,
      bookings: centre._count.bookings,
      counters: 4,
    }

    const etaMinutes = calculateETA(waitingAhead, centreState)
    const baseMinutes = parseTimeToMinutes(slot.startTime)
    const arrivalWindow = calculateArrivalWindow(baseMinutes, etaMinutes)
    const [arrivalStart, arrivalEnd] = arrivalWindow.includes(' – ')
      ? arrivalWindow.split(' – ')
      : [slot.startTime, slot.endTime]

    // Rule 4 & 5: Backend-generated authoritative token number
    const totalBookings = await tx.booking.count()
    const tokenNumber = `K-${100 + totalBookings + 1}`

    const newBooking = await tx.booking.create({
      data: {
        farmerId: currentUser.id,
        centreId,
        slotId,
        tokenNumber,
        status: 'CONFIRMED',
        etaMinutes,
        arrivalStart: arrivalStart.trim(),
        arrivalEnd: arrivalEnd.trim(),
      },
      include: {
        centre: true,
        slot: true,
        farmer: {
          select: { id: true, name: true, phone: true, language: true },
        },
      },
    })

    // Increment slot bookedCount and update status if full
    const newBookedCount = slot.bookedCount + 1
    await tx.slot.update({
      where: { id: slotId },
      data: {
        bookedCount: newBookedCount,
        status: newBookedCount >= slot.capacity ? 'FULL' : 'OPEN',
      },
    })

    // Update centre current queue
    await tx.centre.update({
      where: { id: centreId },
      data: {
        currentQueue: { increment: 1 },
      },
    })

    return newBooking
  })

  // Trigger recalculation and realtime broadcast for newly queued booking
  try {
    await recalculateCentreQueueAndBroadcast(centreId)
  } catch (err) {
    console.error('Failed to recalculate queue after booking creation:', err)
  }

  return bookingResult
}

export async function getBookingById(id: string, currentUser: AuthenticatedUser) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      centre: true,
      slot: true,
      farmer: {
        select: { id: true, name: true, phone: true, language: true },
      },
    },
  })

  if (!booking) {
    const error: any = new Error('Booking not found')
    error.statusCode = 404
    throw error
  }

  // Security: FARMER can only view their own bookings
  if (currentUser.role === Role.FARMER && booking.farmerId !== currentUser.id) {
    const error: any = new Error('Forbidden: You can only view your own bookings')
    error.statusCode = 403
    throw error
  }

  // Security: OFFICER can only view bookings for their assigned centre
  if (currentUser.role === Role.OFFICER) {
    if (currentUser.assignedCentreId && currentUser.assignedCentreId !== booking.centreId) {
      const error: any = new Error('Forbidden: You can only view bookings for your assigned centre')
      error.statusCode = 403
      throw error
    }
  }

  return booking
}

export async function getFarmerBookings(farmerId: string, currentUser: AuthenticatedUser) {
  // Security check: only the farmer themselves or officer/admin can access
  if (currentUser.role === Role.FARMER && currentUser.id !== farmerId) {
    const error: any = new Error('Forbidden: Cannot view bookings for another farmer')
    error.statusCode = 403
    throw error
  }

  return await prisma.booking.findMany({
    where: { farmerId },
    include: {
      centre: true,
      slot: true,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateBookingStatus(
  id: string,
  input: UpdateBookingStatusInput,
  currentUser: AuthenticatedUser
) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { slot: true, centre: true },
  })

  if (!booking) {
    const error: any = new Error('Booking not found')
    error.statusCode = 404
    throw error
  }

  // Security checks
  if (currentUser.role === Role.FARMER) {
    // Farmer can only cancel their own pending/confirmed booking
    if (booking.farmerId !== currentUser.id) {
      const error: any = new Error('Forbidden: You can only update your own booking')
      error.statusCode = 403
      throw error
    }
    if (input.status !== 'CANCELLED') {
      const error: any = new Error('Farmers can only cancel bookings')
      error.statusCode = 403
      throw error
    }
  } else if (currentUser.role === Role.OFFICER) {
    // Officer can only update bookings for their assigned centre
    if (currentUser.assignedCentreId && currentUser.assignedCentreId !== booking.centreId) {
      const error: any = new Error('Forbidden: Officers can only update bookings for their assigned centre')
      error.statusCode = 403
      throw error
    }
  }

  const statusResult = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id },
      data: {
        status: input.status,
      },
      include: {
        centre: true,
        slot: true,
      },
    })

    // If cancelled or completed or missed, adjust centre queue
    if (['COMPLETED', 'CANCELLED', 'MISSED'].includes(input.status)) {
      if (['PENDING', 'CONFIRMED', 'PROCESSING'].includes(booking.status)) {
        await tx.centre.update({
          where: { id: booking.centreId },
          data: {
            currentQueue: { decrement: 1 },
          },
        })
      }
    }

    // If cancelled, free up slot capacity
    if (input.status === 'CANCELLED' && booking.status !== 'CANCELLED') {
      await tx.slot.update({
        where: { id: booking.slotId },
        data: {
          bookedCount: { decrement: 1 },
          status: 'OPEN',
        },
      })
    }

    return updated
  })

  // Trigger recalculation and realtime broadcast after status change
  try {
    await recalculateCentreQueueAndBroadcast(booking.centreId)
  } catch (err) {
    console.error('Failed to recalculate queue after booking status change:', err)
  }

  return statusResult
}
