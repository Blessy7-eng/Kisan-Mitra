import { NextRequest, NextResponse } from 'next/server'
import { registerUser } from '@/services/authService'
import { Role } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Enforce that public registration strictly creates FARMER accounts
    const result = await registerUser({
      name: body.name,
      phone: body.phone,
      password: body.password,
      email: body.email,
      language: body.language || 'en',
      role: Role.FARMER,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status }
    )
  }
}
