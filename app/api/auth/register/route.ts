import { NextRequest, NextResponse } from 'next/server'
import { registerUser } from '@/services/authService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await registerUser(body)
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status }
    )
  }
}
