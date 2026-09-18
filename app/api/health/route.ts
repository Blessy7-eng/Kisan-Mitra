import { NextResponse } from 'next/server'
import { checkDatabaseHealth } from '@/lib/prisma'

export async function GET() {
  try {
    const dbHealth = await checkDatabaseHealth()
    if (!dbHealth.connected) {
      return NextResponse.json({
        status: 'unhealthy',
        service: 'Kisan-Mitra Backend',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      }, { status: 503 })
    }

    return NextResponse.json({
      status: 'ok',
      service: 'Kisan-Mitra Backend',
      database: dbHealth.mode === 'mysql' ? 'connected' : 'fallback_memory',
      timestamp: new Date().toISOString(),
    }, { status: 200 })
  } catch {
    return NextResponse.json({
      status: 'unhealthy',
      service: 'Kisan-Mitra Backend',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
