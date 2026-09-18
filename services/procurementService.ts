import { prisma } from '@/lib/prisma'
import { AuthenticatedUser } from '@/lib/auth'
import { Role } from '@prisma/client'
import { recalculateCentreQueueAndBroadcast } from './queueService'

export type ProcurementStage =
  | 'BOOKING_CONFIRMED'
  | 'ARRIVED_AT_MANDI'
  | 'PRODUCE_VERIFICATION'
  | 'WEIGHING_UNLOADING'
  | 'PROCUREMENT_COMPLETED'
  | 'CANCELLED'

export interface UpdateStageInput {
  bookingId: string
  stage: ProcurementStage
  produceType?: string
  weightQuintals?: number
  moisturePercent?: number
  grade?: string
  notes?: string
}

export async function updateProcurementStage(input: UpdateStageInput, currentUser: AuthenticatedUser) {
  const { bookingId, stage, produceType, weightQuintals, moisturePercent, grade, notes } = input

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { centre: true, farmer: true },
  })

  if (!booking) {
    const error: any = new Error('Booking not found')
    error.statusCode = 404
    throw error
  }

  // RBAC: Only Officer assigned to this centre or Admin can progress procurement
  if (currentUser.role === Role.OFFICER && currentUser.assignedCentreId !== booking.centreId) {
    const error: any = new Error('Forbidden: You are only authorized to manage procurement for your assigned centre')
    error.statusCode = 403
    throw error
  }

  if (currentUser.role === Role.FARMER) {
    const error: any = new Error('Forbidden: Farmers cannot modify procurement stages')
    error.statusCode = 403
    throw error
  }

  let newStatus = booking.status
  if (stage === 'ARRIVED_AT_MANDI' || stage === 'PRODUCE_VERIFICATION') {
    newStatus = 'PROCESSING'
  } else if (stage === 'PROCUREMENT_COMPLETED') {
    newStatus = 'COMPLETED'
  } else if (stage === 'CANCELLED') {
    newStatus = 'CANCELLED'
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: newStatus,
    },
    include: {
      slot: true,
      farmer: { select: { id: true, name: true, phone: true } },
      centre: true,
    },
  })

  // Recalculate queue if status changed
  await recalculateCentreQueueAndBroadcast(booking.centreId)

  return {
    bookingId: updatedBooking.id,
    tokenNumber: updatedBooking.tokenNumber,
    centreId: updatedBooking.centreId,
    status: updatedBooking.status,
    stage,
    produceType: produceType || 'Soybean / Wheat',
    weightQuintals: weightQuintals || null,
    moisturePercent: moisturePercent || null,
    grade: grade || 'Grade A',
    notes: notes || null,
    updatedAt: new Date().toISOString(),
  }
}

export async function getProcurementSummary(centreId: string, currentUser: AuthenticatedUser) {
  if (currentUser.role === Role.OFFICER && currentUser.assignedCentreId !== centreId) {
    const error: any = new Error('Forbidden: Not authorized for this centre')
    error.statusCode = 403
    throw error
  }

  const bookings = await prisma.booking.findMany({
    where: { centreId },
    include: { farmer: { select: { name: true, phone: true } } },
  })

  return {
    centreId,
    totalBookings: bookings.length,
    completed: bookings.filter((b) => b.status === 'COMPLETED').length,
    inProgress: bookings.filter((b) => b.status === 'PROCESSING').length,
    waiting: bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'PENDING').length,
    cancelled: bookings.filter((b) => b.status === 'CANCELLED').length,
  }
}
