import { NextRequest, NextResponse } from 'next/server'
import { getCentreById, updateCentre } from '@/services/centreService'
import { authenticateRequest } from '@/services/authService'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const centre = await getCentreById(id)
    return NextResponse.json({ centre }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 404
    return NextResponse.json(
      { error: error.message || 'Failed to fetch centre' },
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
    const updated = await updateCentre(id, body, currentUser)
    return NextResponse.json({ centre: updated }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Failed to update centre' },
      { status }
    )
  }
}
