import { NextRequest, NextResponse } from 'next/server'
import { getCentreQueue } from '@/services/queueService'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ centreId: string }> }
) {
  try {
    const { centreId } = await params
    const queueData = await getCentreQueue(centreId)
    return NextResponse.json(queueData, { status: 200 })
  } catch (error: any) {
    const status = error.statusCode || 400
    return NextResponse.json(
      { error: error.message || 'Failed to fetch queue' },
      { status }
    )
  }
}
