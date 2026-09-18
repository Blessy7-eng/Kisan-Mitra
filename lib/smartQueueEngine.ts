export type QueueStatus = 'Waiting' | 'Processing' | 'Completed' | 'Delayed'

export type CentreState = {
  queue: number
  capacity: number
  processingMinutes: number
  delayMinutes: number
  bookings: number
  counters: number
}

export interface CentralQueueMetrics {
  queuePosition: number
  farmersAhead: number
  etaMinutes: number
  arrivalWindow: string
  centreLoadPercent: number
  centreStatus: string
  alternativeCentre: string
  isDelayed: boolean
  delayMinutes: number
}

/**
 * Validates operational inputs for Smart Queue Engine.
 * Rejects invalid/out-of-bound values such as <= 0 processingSpeed or capacity.
 */
export function validateCentreState(centre: Partial<CentreState>): CentreState {
  if (centre.processingMinutes !== undefined && centre.processingMinutes <= 0) {
    throw new Error('Invalid processing speed: must be greater than 0 minutes')
  }
  if (centre.capacity !== undefined && centre.capacity <= 0) {
    throw new Error('Invalid daily capacity: must be greater than 0')
  }

  const queue = Math.max(0, Math.floor(Number(centre.queue) || 0))
  const capacity = Math.max(1, Math.floor(Number(centre.capacity) || 60))
  const processingMinutes = Math.max(0.1, Number(centre.processingMinutes) || 5.25)
  const delayMinutes = Math.max(0, Math.floor(Number(centre.delayMinutes) || 0))
  const bookings = Math.max(0, Math.floor(Number(centre.bookings) || 0))
  const counters = Math.max(1, Math.floor(Number(centre.counters) || 4))

  return {
    queue,
    capacity,
    processingMinutes,
    delayMinutes,
    bookings,
    counters,
  }
}

export function calculateETA(farmersAhead: number, centre: CentreState): number {
  if (farmersAhead < 0) {
    farmersAhead = 0
  }
  const ahead = Math.max(0, Math.floor(Number(farmersAhead) || 0))
  const processing = Math.max(0.1, Number(centre?.processingMinutes) || 5.25)
  const delay = Math.max(0, Number(centre?.delayMinutes) || 0)
  const eta = Math.round(ahead * processing + delay)
  return Math.max(0, isNaN(eta) ? 0 : eta)
}

export function calculateArrivalWindow(baseMinutes: number, eta: number): string {
  const validBase = Math.max(0, Number(baseMinutes) || 0)
  const validEta = Math.max(0, Number(eta) || 0)
  const start = Math.floor(validBase + validEta)
  const end = start + 20
  const format = (minutes: number) => {
    const total = Math.max(0, minutes)
    const hour = Math.floor(total / 60) % 24
    const minute = total % 60
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
  }
  return `${format(start)} – ${format(end)}`
}

export function calculateCentreLoad(centre: CentreState): number {
  const queue = Math.max(0, Number(centre?.queue) || 0)
  const counters = Math.max(1, Number(centre?.counters) || 1)
  const bookings = Math.max(0, Number(centre?.bookings) || 0)
  const calculated = Math.round((queue / (counters * 10)) * 100 + bookings / 5)
  return Math.max(0, Math.min(100, isNaN(calculated) ? 0 : calculated))
}

export function getCentreStatus(load: number): string {
  return load >= 85 ? 'High Load' : load >= 70 ? 'Watch' : 'Normal'
}

export function getAlternativeCentre(load: number): string {
  return load >= 85 ? 'Nashik Procurement Centre' : 'No alternative required'
}

export function allocateBestSlot(load: number): string {
  return load >= 85 ? '12:20 – 12:40 PM' : '10:40 – 11:00 AM'
}

export function handleMissedSlot(load: number) {
  return load >= 85
    ? { centre: 'Nashik Procurement Centre', slot: '2:20 – 2:40 PM', wait: 28 }
    : { centre: 'Nashik Procurement Centre', slot: '12:20 – 12:40 PM', wait: 20 }
}

/**
 * Single Authoritative Smart Queue Calculation Result.
 * Used identically across Farmer Dashboard, Officer Dashboard, ETA API, and Socket.IO broadcasts.
 */
export function calculateCentralQueueMetrics(
  rawAhead: number,
  centre: CentreState,
  baseMinutes?: number
): CentralQueueMetrics {
  const validatedCentre = validateCentreState(centre)
  const farmersAhead = Math.max(0, Math.floor(Number(rawAhead) || 0))
  const queuePosition = farmersAhead + 1

  const etaMinutes = calculateETA(farmersAhead, validatedCentre)
  const now = new Date()
  const currentMinutes =
    baseMinutes !== undefined
      ? baseMinutes
      : now.getHours() * 60 + now.getMinutes()

  const arrivalWindow = calculateArrivalWindow(currentMinutes, etaMinutes)
  const centreLoadPercent = calculateCentreLoad(validatedCentre)
  const centreStatus = getCentreStatus(centreLoadPercent)
  const alternativeCentre = getAlternativeCentre(centreLoadPercent)
  const isDelayed = validatedCentre.delayMinutes > 0

  return {
    queuePosition,
    farmersAhead,
    etaMinutes,
    arrivalWindow,
    centreLoadPercent,
    centreStatus,
    alternativeCentre,
    isDelayed,
    delayMinutes: validatedCentre.delayMinutes,
  }
}

