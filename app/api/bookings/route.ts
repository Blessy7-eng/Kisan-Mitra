import { NextRequest, NextResponse } from 'next/server'
import { createBooking } from '@/services/bookingService'
import { authenticateRequest } from '@/services/authService'

export async function POST(req: NextRequest) {
  try {
    const currentUser = await authenticateRequest(req)
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to create a booking' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const booking = await createBooking(body, currentUser)
    return NextResponse.json({ booking }, { status: 201 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status }
    )
  }
}
