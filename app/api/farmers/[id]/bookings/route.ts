import { NextRequest, NextResponse } from 'next/server'
import { getFarmerBookings } from '@/services/bookingService'
import { authenticateRequest } from '@/services/authService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await authenticateRequest(req)
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      )
    }

    const { id } = await params
    const bookings = await getFarmerBookings(id, currentUser)
    return NextResponse.json({ bookings }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Failed to fetch farmer bookings' },
      { status }
    )
  }
}
