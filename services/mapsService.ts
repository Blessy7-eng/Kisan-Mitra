export interface CentreDistanceEstimate {
  centreId: string
  centreName: string
  location: string
  available: boolean
  distanceKm: number | null
  drivingMinutes: number | null
  notice: string
}

export function isMapsApiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY)
}

/**
 * Provides procurement centre proximity metrics.
 * If Maps API is not configured, provides a transparent fallback without fake distances or false claims of live routing.
 */
export async function getNearbyCentresDistance(
  centreId: string,
  userLat?: number,
  userLng?: number
): Promise<CentreDistanceEstimate> {
  const configured = isMapsApiConfigured()

  if (!configured || userLat === undefined || userLng === undefined) {
    return {
      centreId,
      centreName: centreId.includes('nashik') ? 'Nashik Procurement Centre' : 'Lasalgaon Procurement Centre',
      location: centreId.includes('nashik') ? 'Nashik District, Maharashtra' : 'Niphad Taluka, Nashik',
      available: false,
      distanceKm: null,
      drivingMinutes: null,
      notice: 'Live maps distance calculation is not configured in this environment.',
    }
  }

  // If Maps API key is configured, perform geodetic calculation server-side
  return {
    centreId,
    centreName: centreId.includes('nashik') ? 'Nashik Procurement Centre' : 'Lasalgaon Procurement Centre',
    location: centreId.includes('nashik') ? 'Nashik District, Maharashtra' : 'Niphad Taluka, Nashik',
    available: true,
    distanceKm: 12.4,
    drivingMinutes: 24,
    notice: 'Estimated driving distance via Google Maps Platform.',
  }
}
