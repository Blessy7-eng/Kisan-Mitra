import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/services/authService'

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authentication token' },
        { status: 401 }
      )
    }
    return NextResponse.json({ user }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Authentication check failed' },
      { status: 401 }
    )
  }
}
