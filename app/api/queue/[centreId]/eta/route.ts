import { NextRequest, NextResponse } from 'next/server'
import { getQueueETA } from '@/services/queueService'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ centreId: string }> }
) {
  try {
    const { centreId } = await params
    const searchParams = req.nextUrl.searchParams
    const bookingId = searchParams.get('bookingId') || undefined

    const etaData = await getQueueETA(centreId, bookingId)
    return NextResponse.json(etaData, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Failed to calculate queue ETA' },
      { status }
    )
  }
}
