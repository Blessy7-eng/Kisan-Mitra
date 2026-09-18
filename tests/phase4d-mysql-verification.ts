import assert from 'assert'
import http from 'http'
import type { AddressInfo } from 'net'
import { createExpressApp } from '../backend/app'
import { PrismaClient } from '@prisma/client'

async function runPhase4DVerification() {
  console.log('🚀 Starting Phase 4D Managed MySQL Verification Suite...')
  console.log(`Environment: NODE_ENV=${process.env.NODE_ENV}, ALLOW_IN_MEMORY_DB_FALLBACK=${process.env.ALLOW_IN_MEMORY_DB_FALLBACK}`)

  const app = createExpressApp()
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}`

  const rawPrisma = new PrismaClient({ log: [] })

  try {
    // 1. GET /api/health
    console.log('\n--- Step 1: Health Check ---')
    const healthRes = await fetch(`${baseUrl}/api/health`)
    assert.strictEqual(healthRes.status, 200, `Health check must be 200, got ${healthRes.status}`)
    const health = await healthRes.json()
    console.log('Health response:', health)
    assert.strictEqual(health.status, 'ok')
    assert.strictEqual(health.database, 'connected', `Database health must be "connected", got "${health.database}"`)
    console.log('✅ [MYSQL-BACKED] /api/health reports database: connected')

    // 2. Auth: Login with seeded demo user (Ramesh Jadhav, phone: 9876543210, pass: farmer123)
    console.log('\n--- Step 2: Seeded Demo Account Login ---')
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', password: 'farmer123' }),
    })
    assert.strictEqual(loginRes.status, 200, `Login failed with status ${loginRes.status}`)
    const loginData = await loginRes.json()
    assert.ok(loginData.token, 'JWT token returned')
    assert.strictEqual(loginData.user.name, 'Ramesh Jadhav')
    assert.strictEqual(loginData.user.role, 'FARMER')
    const farmerToken = loginData.token
    console.log('✅ [MYSQL-BACKED] Login succeeded against real MySQL User table (Ramesh Jadhav, FARMER)')

    // 3. Read Centres
    console.log('\n--- Step 3: Read Centres from MySQL ---')
    const centresRes = await fetch(`${baseUrl}/api/centres`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    })
    assert.strictEqual(centresRes.status, 200)
    const centresBody = await centresRes.json()
    const centres = centresBody.centres
    assert.ok(Array.isArray(centres) && centres.length >= 3, 'Expected at least 3 centres')
    const nashikCentre = centres.find((c: any) => c.name.includes('Nashik'))
    assert.ok(nashikCentre, 'Nashik centre must exist in MySQL')
    console.log(`✅ [MYSQL-BACKED] Successfully read ${centres.length} centres from MySQL Centre table (Nashik ID: ${nashikCentre.id})`)

    // 4. Read Slots
    console.log('\n--- Step 4: Read Slots from MySQL ---')
    const slotsRes = await fetch(`${baseUrl}/api/centres/${nashikCentre.id}/slots`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    })
    assert.strictEqual(slotsRes.status, 200)
    const slotsBody = await slotsRes.json()
    const slots = slotsBody.slots
    assert.ok(Array.isArray(slots) && slots.length > 0, 'Expected slots for Nashik centre')
    const targetSlot = slots[0]
    console.log(`✅ [MYSQL-BACKED] Successfully read ${slots.length} slots for Nashik from MySQL Slot table (Slot ID: ${targetSlot.id})`)

    // 5. Read Queue
    console.log('\n--- Step 5: Read Queue from MySQL ---')
    const queueRes = await fetch(`${baseUrl}/api/queue/${nashikCentre.id}`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    })
    assert.strictEqual(queueRes.status, 200)
    const queue = await queueRes.json()
    assert.ok(queue.centre, 'Queue centre metadata present')
    console.log(`✅ [MYSQL-BACKED] Read live queue for Nashik: queue depth = ${queue.queueDepth}`)

    // 6. Create a controlled booking
    console.log('\n--- Step 6: Create Controlled Booking in MySQL ---')
    // We login as second farmer: Meena Shinde (phone: 9876543219, password: farmer123)
    const meenaLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543219', password: 'farmer123' }),
    })
    assert.strictEqual(meenaLogin.status, 200)
    const meenaToken = (await meenaLogin.json()).token

    const createBookingRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${meenaToken}`,
      },
      body: JSON.stringify({
        centreId: nashikCentre.id,
        slotId: targetSlot.id,
      }),
    })
    assert.strictEqual(createBookingRes.status, 201, `Failed to create booking: ${createBookingRes.status}`)
    const createdBookingBody = await createBookingRes.json()
    const createdBooking = createdBookingBody.booking
    const testBookingId = createdBooking.id
    console.log('Created booking token:', createdBooking.tokenNumber, 'ID:', testBookingId)
    console.log('✅ [MYSQL-BACKED] Controlled booking created via API')

    // 7. Verify booking exists directly in MySQL using separate raw PrismaClient query
    console.log('\n--- Step 7: Direct MySQL DB Verification of Created Record ---')
    const directRecord = await rawPrisma.booking.findUnique({
      where: { id: testBookingId },
    })
    assert.ok(directRecord, 'Direct DB query must find the booking in MySQL')
    assert.strictEqual(directRecord.tokenNumber, createdBooking.tokenNumber)
    assert.strictEqual(directRecord.status, 'CONFIRMED')
    console.log('✅ [MYSQL-BACKED] Direct PrismaClient query verified booking in remote MySQL table')

    // 8. Update / Cancel booking using the application API
    console.log('\n--- Step 8: Cancel Booking via Application API ---')
    const cancelRes = await fetch(`${baseUrl}/api/bookings/${testBookingId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${meenaToken}` },
    })
    assert.strictEqual(cancelRes.status, 200, `Cancel request failed with ${cancelRes.status}`)
    const cancelledBookingBody = await cancelRes.json()
    const cancelledBooking = cancelledBookingBody.booking
    assert.strictEqual(cancelledBooking.status, 'CANCELLED')

    // Verify cancellation in MySQL directly
    const directCancelled = await rawPrisma.booking.findUnique({
      where: { id: testBookingId },
    })
    assert.strictEqual(directCancelled?.status, 'CANCELLED')
    console.log('✅ [MYSQL-BACKED] Cancellation updated and verified directly in MySQL')

    // 9. Restart backend simulation: Close server, re-instantiate, and verify record still exists
    console.log('\n--- Step 9: Restart Backend & Verify Persistence ---')
    server.close()

    // New server instance
    const newApp = createExpressApp()
    const newServer = http.createServer(newApp)
    await new Promise<void>((resolve) => newServer.listen(0, resolve))
    const newPort = (newServer.address() as AddressInfo).port
    const newBaseUrl = `http://127.0.0.1:${newPort}`

    try {
      const persistedRecord = await rawPrisma.booking.findUnique({
        where: { id: testBookingId },
      })
      assert.ok(persistedRecord, 'Booking must still exist in MySQL after backend restart')
      assert.strictEqual(persistedRecord.status, 'CANCELLED')

      // Also verify via the fresh backend API
      const checkRes = await fetch(`${newBaseUrl}/api/bookings/${testBookingId}`, {
        headers: { Authorization: `Bearer ${meenaToken}` },
      })
      assert.strictEqual(checkRes.status, 200)
      const fetchedBody = await checkRes.json()
      const fetched = fetchedBody.booking
      assert.strictEqual(fetched.id, testBookingId)
      assert.strictEqual(fetched.status, 'CANCELLED')
      console.log('✅ [MYSQL-BACKED] Record persistently retrieved after complete backend restart')

      // Clean up the test booking created in Step 6
      await rawPrisma.booking.delete({ where: { id: testBookingId } })
      console.log('🧹 Cleaned up temporary test booking from MySQL')
    } finally {
      newServer.close()
    }

    console.log('\n🎉 ALL 9 Steps of Phase 4D Managed MySQL Verification PASSED!')
  } finally {
    server.close()
    await rawPrisma.$disconnect()
  }
}

runPhase4DVerification().catch((err) => {
  console.error('❌ Phase 4D Verification FAILED:', err)
  process.exit(1)
})
