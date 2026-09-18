import { NextRequest, NextResponse } from 'next/server'
import { createSlot } from '@/services/slotService'
import { authenticateRequest } from '@/services/authService'

export async function POST(req: NextRequest) {
  try {
    const currentUser = await authenticateRequest(req)
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const slot = await createSlot(body, currentUser)
    return NextResponse.json({ slot }, { status: 201 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Failed to create slot' },
      { status }
    )
  }
}
