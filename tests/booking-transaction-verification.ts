import http from 'http'
import assert from 'assert'
import type { AddressInfo } from 'net'
import { io as ClientIO } from 'socket.io-client'
import { createExpressApp } from '../backend/app'
import { initSocketServer } from '../backend/socket'
import prisma from '../lib/prisma'

async function runBookingVerificationSuite() {
  console.log('🧪 Starting Kisan-Mitra Booking Transaction & Concurrency Verification Suite...\n')

  // Setup Express server with Socket.IO
  const app = createExpressApp()
  const server = http.createServer(app)
  const io = initSocketServer(server)

  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`📡 Test server running on ${baseUrl}`)

  try {
    // 1. Farmer login
    console.log('\n--- Step 1: Farmer Login ---')
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', password: 'farmer123', expectedRole: 'FARMER' }),
    })
    assert.strictEqual(loginRes.status, 200, `Login should return 200, got ${loginRes.status}`)
    const loginData = await loginRes.json()
    assert.ok(loginData.token, 'Must return JWT token')
    const farmerToken = loginData.token
    const farmerId = loginData.user.id
    console.log(`✅ Farmer logged in: ${loginData.user.name} (${farmerId})`)

    // Setup Socket.IO client to listen for real-time broadcasts
    const socket = ClientIO(baseUrl, {
      auth: { token: farmerToken },
      transports: ['websocket'],
    })

    let queueUpdateReceived = false
    let farmerQueueUpdateReceived = false
    let receivedTokenFromSocket = ''

    socket.on('connect', () => {
      // Join centre room
      socket.emit('subscribe:centre', 'centre_nashik')
    })

    socket.on('queue:update', (data: any) => {
      queueUpdateReceived = true
    })

    socket.on('farmer:queue:update', (data: any) => {
      farmerQueueUpdateReceived = true
      receivedTokenFromSocket = data.tokenNumber
    })

    // Wait 200ms for socket connection
    await new Promise((r) => setTimeout(r, 200))

    // 2. Select centre
    console.log('\n--- Step 2: Select Centre ---')
    const centresRes = await fetch(`${baseUrl}/api/centres`)
    assert.strictEqual(centresRes.status, 200)
    const centresData = await centresRes.json()
    assert.ok(Array.isArray(centresData.centres) && centresData.centres.length > 0)
    const selectedCentre = centresData.centres[0]
    console.log(`✅ Selected Centre: ${selectedCentre.name} (${selectedCentre.id})`)

    // Subscribe to the selected centre's real-time events
    socket.emit('subscribe:centre', selectedCentre.id)
    await new Promise((r) => setTimeout(r, 100))

    // 3. Load slots
    console.log('\n--- Step 3: Load Slots ---')
    const slotsRes = await fetch(`${baseUrl}/api/centres/${selectedCentre.id}/slots`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    })
    assert.strictEqual(slotsRes.status, 200)
    const slotsData = await slotsRes.json()
    assert.ok(Array.isArray(slotsData.slots) && slotsData.slots.length > 0)
    console.log(`✅ Loaded ${slotsData.slots.length} slots for ${selectedCentre.name}`)

    // 4. Select available slot
    console.log('\n--- Step 4: Select Available Slot ---')
    // We create a dedicated fresh test slot to verify capacity transitions cleanly
    const testSlot = await prisma.slot.create({
      data: {
        id: `slot_test_${Date.now()}`,
        centreId: selectedCentre.id,
        date: new Date(),
        startTime: '02:00 PM',
        endTime: '02:30 PM',
        capacity: 2,
        bookedCount: 0,
        status: 'OPEN',
      },
    })
    console.log(`✅ Created test slot: ${testSlot.id} (Capacity: ${testSlot.capacity}, Booked: ${testSlot.bookedCount})`)

    // 5 & 6. Confirm booking via POST /api/bookings
    console.log('\n--- Step 5 & 6: Confirm Booking (POST /api/bookings) ---')
    const bookRes1 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`,
      },
      body: JSON.stringify({
        centreId: selectedCentre.id,
        slotId: testSlot.id,
        produceType: 'Wheat',
        quantity: 1500,
      }),
    })
    assert.strictEqual(bookRes1.status, 201, `Booking should return 201, got ${bookRes1.status}`)
    const bookData1 = await bookRes1.json()
    assert.ok(bookData1.booking, 'Response must contain booking object')
    console.log('✅ POST /api/bookings succeeded with 201 Created')

    // 7, 8, 9. Verify database transaction completes, slot update succeeds, booking created
    console.log('\n--- Step 7, 8, 9: Verify Transaction, Slot Update, and Booking Record in DB ---')
    const slotAfterBook = await prisma.slot.findUnique({ where: { id: testSlot.id } })
    assert.strictEqual(slotAfterBook?.bookedCount, 1, `Slot bookedCount must be 1, got ${slotAfterBook?.bookedCount}`)
    console.log(`✅ Slot bookedCount successfully incremented: ${slotAfterBook?.bookedCount} / ${slotAfterBook?.capacity}`)

    const bookingInDb = await prisma.booking.findUnique({ where: { id: bookData1.booking.id } })
    assert.ok(bookingInDb, 'Booking must exist in database')
    assert.strictEqual(bookingInDb.status, 'CONFIRMED')
    assert.strictEqual(bookingInDb.farmerId, farmerId)
    console.log(`✅ Booking record verified in database: ID=${bookingInDb.id}, Status=${bookingInDb.status}`)

    // 10. Verify real K-XXX token is returned
    console.log('\n--- Step 10: Verify Real K-XXX Token ---')
    assert.match(bookData1.booking.tokenNumber, /^K-\d+$/, `Token must match K-XXX format, got ${bookData1.booking.tokenNumber}`)
    console.log(`✅ Authoritative backend token returned: ${bookData1.booking.tokenNumber}`)

    // 11. Verify queue position, ETA, arrival window
    console.log('\n--- Step 11: Verify Queue Position & ETA ---')
    assert.ok(bookData1.booking.queuePosition !== undefined, 'queuePosition must be present')
    assert.ok(bookData1.booking.farmersAhead !== undefined, 'farmersAhead must be present')
    assert.ok(bookData1.booking.etaMinutes !== undefined, 'etaMinutes must be present')
    assert.ok(bookData1.booking.arrivalWindow, 'arrivalWindow must be present')
    console.log(`✅ Queue metrics verified: Position=${bookData1.booking.queuePosition}, Ahead=${bookData1.booking.farmersAhead}, ETA=${bookData1.booking.etaMinutes}m, Window=${bookData1.booking.arrivalWindow}`)

    // 12. Verify Socket.IO update
    console.log('\n--- Step 12: Verify Socket.IO Real-time Update ---')
    // Wait briefly for socket broadcast delivery
    await new Promise((r) => setTimeout(r, 400))
    assert.ok(farmerQueueUpdateReceived || queueUpdateReceived, 'Socket.IO event must be emitted after transaction commit')
    assert.strictEqual(receivedTokenFromSocket, bookData1.booking.tokenNumber, `Socket event must match generated token (${bookData1.booking.tokenNumber})`)
    console.log(`✅ Real-time Socket.IO update verified with token: ${receivedTokenFromSocket}`)

    // 13 & 15. Try clicking Confirm Booking twice (same slot duplicate)
    console.log('\n--- Step 13 & 15: Try Booking the Same Slot Again (Duplicate Active Booking) ---')
    const duplicateRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`,
      },
      body: JSON.stringify({
        centreId: selectedCentre.id,
        slotId: testSlot.id,
        produceType: 'Wheat',
        quantity: 1000,
      }),
    })
    assert.strictEqual(duplicateRes.status, 409, `Duplicate booking should return 409, got ${duplicateRes.status}`)
    const duplicateData = await duplicateRes.json()
    assert.strictEqual(duplicateData.error, 'You already have an active booking.')
    console.log(`✅ Duplicate booking rejected safely: "${duplicateData.error}"`)

    // 14. Try booking a full slot
    console.log('\n--- Step 14: Try Booking a Full Slot ---')
    // Log in second farmer to test slot capacity saturation
    const loginRes2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543219', password: 'farmer123', expectedRole: 'FARMER' }),
    })
    const farmerToken2 = (await loginRes2.json()).token

    // Farmer 2 books spot 2 of 2 in testSlot
    const bookRes2 = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken2}`,
      },
      body: JSON.stringify({
        centreId: selectedCentre.id,
        slotId: testSlot.id,
        produceType: 'Soybean',
        quantity: 800,
      }),
    })
    assert.strictEqual(bookRes2.status, 201)
    const slotFullCheck = await prisma.slot.findUnique({ where: { id: testSlot.id } })
    assert.strictEqual(slotFullCheck?.bookedCount, 2)
    assert.strictEqual(slotFullCheck?.status, 'FULL')
    console.log(`✅ Slot reached full capacity (2/2) with status="FULL"`)

    // Now attempt a 3rd booking on the now FULL slot (using a newly registered unique farmer)
    const uniquePhone = `911${Date.now().toString().slice(-7)}`
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Third Farmer', phone: uniquePhone, password: 'farmer123' }),
    })
    const regData = await registerRes.json()
    assert.ok(regData.token, 'Must receive token for registered user')
    const farmerToken3 = regData.token

    const fullSlotAttemptRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken3}`,
      },
      body: JSON.stringify({
        centreId: selectedCentre.id,
        slotId: testSlot.id,
        produceType: 'Wheat',
        quantity: 500,
      }),
    })
    assert.strictEqual(fullSlotAttemptRes.status, 409, `Full slot booking must return 409, got ${fullSlotAttemptRes.status}`)
    const fullSlotData = await fullSlotAttemptRes.json()
    assert.strictEqual(fullSlotData.error, 'This slot is no longer available. Please select another slot.')
    console.log(`✅ Full slot booking rejected safely: "${fullSlotData.error}"`)

    // 16. Verify safe error messages
    console.log('\n--- Step 16: Verify Safe Error Messages (No leaked Prisma or DB internals) ---')
    // Attempt with invalid centre
    const invalidRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken3}`,
      },
      body: JSON.stringify({
        centreId: 'nonexistent_centre',
        slotId: testSlot.id,
      }),
    })
    const invalidData = await invalidRes.json()
    assert.ok(!invalidData.error.includes('prisma'), 'Error must not contain "prisma"')
    assert.ok(!invalidData.error.includes('SELECT'), 'Error must not contain SQL')
    assert.ok(!invalidData.error.includes('stack'), 'Error must not contain stack traces')
    console.log(`✅ Safe error handling verified: sanitized message returned: "${invalidData.error}"`)

    socket.disconnect()
    console.log('\n🎉 ALL 16 VERIFICATION STEPS PASSED SUCCESSFULLY!')
  } finally {
    server.close()
  }
}

runBookingVerificationSuite().catch((err) => {
  console.error('❌ Verification suite failed:', err)
  process.exit(1)
})
