import { prisma } from '@/lib/prisma'
import {
  calculateETA,
  calculateArrivalWindow,
  calculateCentreLoad,
  getCentreStatus,
  getAlternativeCentre,
  CentreState,
} from '@/lib/smartQueueEngine'
import { getSocketIO } from '@/backend/socket'

export interface RecalculatedQueueUpdate {
  centreId: string
  centreName: string
  bookingId: string
  tokenNumber: string
  farmerId: string
  farmerName?: string
  positionInQueue: number
  farmersAhead: number
  etaMinutes: number
  arrivalWindow: {
    start: string
    end: string
    formatted: string
  }
  status: string
  centreLoadPercent: number
  centreStatus: string
  delayMinutes: number
  isDelayed: boolean
  updatedAt: string
}

export async function recalculateCentreQueueAndBroadcast(centreId: string) {
  const centre = await prisma.centre.findUnique({
    where: { id: centreId },
  })

  if (!centre) {
    const error: any = new Error('Centre not found')
    error.statusCode = 404
    throw error
  }

  // Retrieve active bookings in queue order (CONFIRMED, PROCESSING, PENDING)
  const activeBookings = await prisma.booking.findMany({
    where: {
      centreId,
      status: { in: ['CONFIRMED', 'PROCESSING', 'PENDING'] },
    },
    include: {
      slot: true,
      farmer: {
        select: { id: true, name: true, phone: true },
      },
    },
    orderBy: [
      { slot: { date: 'asc' } },
      { slot: { startTime: 'asc' } },
      { createdAt: 'asc' },
    ],
  })

  const currentlyProcessing = activeBookings.find((b) => b.status === 'PROCESSING') || null
  const waitingBookings = activeBookings.filter((b) => b.status !== 'PROCESSING')

  const isDelayed = centre.status === 'DELAYED'
  const centreState: CentreState = {
    queue: waitingBookings.length,
    capacity: centre.dailyCapacity,
    processingMinutes: centre.processingRate,
    delayMinutes: isDelayed ? 15 : 0,
    bookings: activeBookings.length,
    counters: 4,
  }

  const loadPercent = calculateCentreLoad(centreState)
  const centreStatus = getCentreStatus(loadPercent)
  const alternativeCentre = getAlternativeCentre(loadPercent)

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const affectedPayloads: RecalculatedQueueUpdate[] = []

  // Recalculate ETA and arrival window for each active booking using the existing Smart Queue Engine
  for (let i = 0; i < activeBookings.length; i++) {
    const b = activeBookings[i]
    const ahead = Math.max(0, i - (currentlyProcessing ? 1 : 0))

    // SOURCE OF TRUTH: Call existing Smart Queue Engine functions
    const etaMinutes = calculateETA(ahead, centreState)
    const arrivalWindowStr = calculateArrivalWindow(currentMinutes, etaMinutes)
    const parts = arrivalWindowStr.split(' – ')
    const startStr = (parts[0] || b.arrivalStart).trim()
    const endStr = (parts[1] || b.arrivalEnd).trim()

    // Persist updated ETA in the database
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        etaMinutes,
        arrivalStart: startStr,
        arrivalEnd: endStr,
      },
    })

    affectedPayloads.push({
      centreId: centre.id,
      centreName: centre.name,
      bookingId: b.id,
      tokenNumber: b.tokenNumber,
      farmerId: b.farmerId,
      farmerName: b.farmer.name,
      positionInQueue: ahead + 1,
      farmersAhead: ahead,
      etaMinutes,
      arrivalWindow: {
        start: startStr,
        end: endStr,
        formatted: arrivalWindowStr,
      },
      status: b.status,
      centreLoadPercent: loadPercent,
      centreStatus,
      delayMinutes: centreState.delayMinutes,
      isDelayed,
      updatedAt: new Date().toISOString(),
    })
  }

  // Socket.IO Broadcast: ONLY AFTER DATABASE UPDATE HAS SUCCEEDED
  const io = getSocketIO()
  if (io) {
    const broadcastPayload = {
      centreId: centre.id,
      centreName: centre.name,
      centreStatus,
      centreLoadPercent: loadPercent,
      processingRate: centre.processingRate,
      delayMinutes: centreState.delayMinutes,
      isDelayed,
      alternativeCentre,
      activeCount: activeBookings.length,
      waitingCount: waitingBookings.length,
      updates: affectedPayloads,
      updatedAt: new Date().toISOString(),
    }

    // Broadcast to the authenticated centre room
    io.to(`centre:${centre.id}`).emit('queue:update', broadcastPayload)

    // Emit targeted payload to each farmer's private room
    for (const farmerUpdate of affectedPayloads) {
      io.to(`user:${farmerUpdate.farmerId}`).emit('farmer:queue:update', farmerUpdate)
    }

    console.log(`📡 [Socket.IO] Broadcasted queue:update for centre ${centre.name} (${centre.id}) with ${affectedPayloads.length} recalculated bookings`)
  }

  return {
    centre,
    centreState,
    loadPercent,
    centreStatus,
    alternativeCentre,
    activeCount: activeBookings.length,
    waitingCount: waitingBookings.length,
    updates: affectedPayloads,
  }
}

export async function getCentreQueue(centreId: string) {
  const centre = await prisma.centre.findUnique({
    where: { id: centreId },
  })

  if (!centre) {
    const error: any = new Error('Centre not found')
    error.statusCode = 404
    throw error
  }

  // Active bookings (waiting or currently processing)
  const activeBookings = await prisma.booking.findMany({
    where: {
      centreId,
      status: { in: ['CONFIRMED', 'PROCESSING', 'PENDING'] },
    },
    include: {
      slot: true,
      farmer: {
        select: { id: true, name: true, phone: true },
      },
    },
    orderBy: [
      { slot: { date: 'asc' } },
      { slot: { startTime: 'asc' } },
      { createdAt: 'asc' },
    ],
  })

  const currentlyProcessing = activeBookings.find((b) => b.status === 'PROCESSING') || null
  const waitingList = activeBookings.filter((b) => b.status !== 'PROCESSING')

  const centreState: CentreState = {
    queue: waitingList.length,
    capacity: centre.dailyCapacity,
    processingMinutes: centre.processingRate,
    delayMinutes: centre.status === 'DELAYED' ? 15 : 0,
    bookings: activeBookings.length,
    counters: 4,
  }

  const loadPercent = calculateCentreLoad(centreState)

  return {
    centre: {
      id: centre.id,
      name: centre.name,
      location: centre.location,
      status: centre.status,
      dailyCapacity: centre.dailyCapacity,
      processingRate: centre.processingRate,
      calculatedLoadPercent: loadPercent,
      loadStatus: getCentreStatus(loadPercent),
      alternativeCentre: getAlternativeCentre(loadPercent),
    },
    summary: {
      totalActive: activeBookings.length,
      currentlyProcessingToken: currentlyProcessing?.tokenNumber || null,
      waitingCount: waitingList.length,
      activeCounters: 4,
    },
    queue: activeBookings.map((b, index) => {
      const ahead = Math.max(0, index - (currentlyProcessing ? 1 : 0))
      const dynamicEta = calculateETA(ahead, centreState)
      return {
        id: b.id,
        tokenNumber: b.tokenNumber,
        farmerName: b.farmer.name,
        slotTime: `${b.slot.startTime} – ${b.slot.endTime}`,
        status: b.status,
        positionInQueue: ahead + 1,
        liveEtaMinutes: dynamicEta,
        arrivalWindow: `${b.arrivalStart} – ${b.arrivalEnd}`,
      }
    }),
  }
}

export async function getQueueETA(centreId: string, bookingId?: string) {
  const centre = await prisma.centre.findUnique({
    where: { id: centreId },
    include: {
      _count: {
        select: { bookings: true },
      },
    },
  })

  if (!centre) {
    const error: any = new Error('Centre not found')
    error.statusCode = 404
    throw error
  }

  const activeWaitingCount = await prisma.booking.count({
    where: {
      centreId,
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
  })

  const centreState: CentreState = {
    queue: activeWaitingCount,
    capacity: centre.dailyCapacity,
    processingMinutes: centre.processingRate,
    delayMinutes: centre.status === 'DELAYED' ? 15 : 0,
    bookings: centre._count.bookings,
    counters: 4,
  }

  let targetBooking = null
  let farmersAhead = activeWaitingCount

  if (bookingId) {
    targetBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true },
    })

    if (targetBooking && targetBooking.centreId === centreId) {
      farmersAhead = await prisma.booking.count({
        where: {
          centreId,
          status: { in: ['CONFIRMED', 'PENDING'] },
          createdAt: { lt: targetBooking.createdAt },
        },
      })
    }
  }

  const etaMinutes = calculateETA(farmersAhead, centreState)
  const currentMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const liveArrivalWindow = calculateArrivalWindow(currentMinutes, etaMinutes)
  const load = calculateCentreLoad(centreState)

  return {
    centreId: centre.id,
    centreName: centre.name,
    farmersAhead,
    etaMinutes,
    liveArrivalWindow,
    centreLoadPercent: load,
    centreStatus: getCentreStatus(load),
    alternativeCentre: getAlternativeCentre(load),
    isDelayed: centre.status === 'DELAYED',
    delayMinutes: centreState.delayMinutes,
    targetBooking: targetBooking
      ? {
          id: targetBooking.id,
          tokenNumber: targetBooking.tokenNumber,
          status: targetBooking.status,
          assignedSlot: `${targetBooking.slot.startTime} – ${targetBooking.slot.endTime}`,
        }
      : null,
  }
}
