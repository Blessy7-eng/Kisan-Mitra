import { NextResponse } from 'next/server'
import { listCentres } from '@/services/centreService'

export async function GET() {
  try {
    const centres = await listCentres()
    return NextResponse.json({ centres }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch centres' },
      { status: 500 }
    )
  }
}
