export type QueueStatus = 'Waiting' | 'Processing' | 'Completed' | 'Delayed'

export type CentreState = {
  queue: number
  capacity: number
  processingMinutes: number
  delayMinutes: number
  bookings: number
  counters: number
}

export function calculateETA(farmersAhead: number, centre: CentreState) {
  return Math.max(0, Math.round(farmersAhead * centre.processingMinutes + centre.delayMinutes))
}

export function calculateArrivalWindow(baseMinutes: number, eta: number) {
  const start = baseMinutes + eta
  const end = start + 20
  const format = (minutes: number) => {
    const hour = Math.floor(minutes / 60) % 24
    const minute = minutes % 60
    const suffix = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
  }
  return `${format(start)} – ${format(end)}`
}

export function calculateCentreLoad(centre: CentreState) {
  return Math.min(100, Math.round((centre.queue / Math.max(1, centre.counters * 10)) * 100 + centre.bookings / 5))
}

export function getCentreStatus(load: number) {
  return load >= 85 ? 'High Load' : load >= 70 ? 'Watch' : 'Normal'
}

export function getAlternativeCentre(load: number) {
  return load >= 85 ? 'Nashik Procurement Centre' : 'No alternative required'
}

export function allocateBestSlot(load: number) {
  return load >= 85 ? '12:20 – 12:40 PM' : '10:40 – 11:00 AM'
}

export function handleMissedSlot(load: number) {
  return load >= 85 ? { centre: 'Nashik Procurement Centre', slot: '2:20 – 2:40 PM', wait: 28 } : { centre: 'Nashik Procurement Centre', slot: '12:20 – 12:40 PM', wait: 20 }
}
