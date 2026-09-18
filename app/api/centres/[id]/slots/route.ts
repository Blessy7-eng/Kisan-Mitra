import { NextRequest, NextResponse } from 'next/server'
import { getSlotsByCentre } from '@/services/slotService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = req.nextUrl.searchParams
    const date = searchParams.get('date') || undefined

    const slots = await getSlotsByCentre(id, date)
    return NextResponse.json({ slots }, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Failed to fetch slots' },
      { status }
    )
  }
}
