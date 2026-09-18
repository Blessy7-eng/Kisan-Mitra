import { NextRequest, NextResponse } from 'next/server'
import { getBookingById, updateBookingStatus } from '@/services/bookingService'
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
    const booking = await getBookingById(id, currentUser)
    return NextResponse.json({ booking }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 404
    return NextResponse.json(
      { error: error.message || 'Failed to fetch booking' },
      { status }
    )
  }
}

export async function PATCH(
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
    const body = await req.json()
    const updated = await updateBookingStatus(id, body, currentUser)
    return NextResponse.json({ booking: updated }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Failed to update booking status' },
      { status }
    )
  }
}
