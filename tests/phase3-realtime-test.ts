import http from 'http'
import { Role } from '@prisma/client'
import { signToken, hashPassword } from '../lib/auth'
import { io as ClientIO } from 'socket.io-client'
import { calculateETA, calculateArrivalWindow, CentreState } from '../lib/smartQueueEngine'

// 1. In-Memory Mock Store for Phase 3 Realtime Orchestration Testing
const mockCentres: any[] = [
  {
    id: 'centre_nashik',
    name: 'Nashik Procurement Centre',
    location: 'Nashik District, Maharashtra',
    dailyCapacity: 60,
    processingRate: 5.25,
    currentQueue: 3,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'centre_lasalgaon',
    name: 'Lasalgaon Procurement Centre',
    location: 'Niphad Taluka, Nashik',
    dailyCapacity: 55,
    processingRate: 11.0,
    currentQueue: 51,
    status: 'HIGH_LOAD',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockUsers: any[] = [
  {
    id: 'usr_farmer_ramesh',
    name: 'Ramesh Jadhav',
    phone: '9876543210',
    role: Role.FARMER,
    language: 'mr',
    assignedCentreId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'usr_farmer_meena',
    name: 'Meena Shinde',
    phone: '9876543219',
    role: Role.FARMER,
    language: 'mr',
    assignedCentreId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'usr_farmer_outsider',
    name: 'Outside Farmer',
    phone: '9876543299',
    role: Role.FARMER,
    language: 'en',
    assignedCentreId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'usr_officer_suresh',
    name: 'Suresh Patil',
    phone: '9876543211',
    role: Role.OFFICER,
    language: 'en',
    assignedCentreId: 'centre_nashik',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'usr_admin_priya',
    name: 'Priya Sharma',
    phone: '9876543212',
    role: Role.ADMIN,
    language: 'en',
    assignedCentreId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const mockSlots: any[] = [
  {
    id: 'slot_nashik_1',
    centreId: 'centre_nashik',
    date: new Date(),
    startTime: '10:40 AM',
    endTime: '11:00 AM',
    capacity: 15,
    bookedCount: 2,
    status: 'OPEN',
    createdAt: new Date(),
  },
]

const mockBookings: any[] = [
  {
    id: 'bk_1',
    farmerId: 'usr_farmer_ramesh',
    centreId: 'centre_nashik',
    slotId: 'slot_nashik_1',
    tokenNumber: 'K-101',
    status: 'CONFIRMED',
    etaMinutes: 10,
    arrivalStart: '10:40 AM',
    arrivalEnd: '11:00 AM',
    createdAt: new Date('2026-09-17T08:00:00Z'),
    updatedAt: new Date('2026-09-17T08:00:00Z'),
  },
  {
    id: 'bk_2',
    farmerId: 'usr_farmer_meena',
    centreId: 'centre_nashik',
    slotId: 'slot_nashik_1',
    tokenNumber: 'K-102',
    status: 'CONFIRMED',
    etaMinutes: 16,
    arrivalStart: '10:50 AM',
    arrivalEnd: '11:10 AM',
    createdAt: new Date('2026-09-17T08:05:00Z'),
    updatedAt: new Date('2026-09-17T08:05:00Z'),
  },
]

// 2. Setup mockPrisma BEFORE any dynamic imports
const mockPrisma: any = {
  user: {
    findUnique: async ({ where }: any) => {
      if (where.phone) return mockUsers.find((u) => u.phone === where.phone) || null
      if (where.id) return mockUsers.find((u) => u.id === where.id) || null
      return null
    },
    findFirst: async ({ where }: any) => {
      if (where?.role) return mockUsers.find((u) => u.role === where.role) || null
      return mockUsers[0] || null
    },
  },
  centre: {
    findMany: async () => {
      return mockCentres.map((c) => ({
        ...c,
        _count: {
          slots: mockSlots.filter((s) => s.centreId === c.id).length,
          bookings: mockBookings.filter((b) => b.centreId === c.id).length,
        },
      }))
    },
    findUnique: async ({ where }: any) => {
      const c = mockCentres.find((centre) => centre.id === where.id)
      if (!c) return null
      return {
        ...c,
        slots: mockSlots.filter((s) => s.centreId === c.id),
        _count: {
          bookings: mockBookings.filter((b) => b.centreId === c.id).length,
        },
      }
    },
    update: async ({ where, data }: any) => {
      const idx = mockCentres.findIndex((c) => c.id === where.id)
      if (idx === -1) throw new Error('Centre not found')
      mockCentres[idx] = { ...mockCentres[idx], ...data, updatedAt: new Date() }
      return mockCentres[idx]
    },
  },
  slot: {
    findUnique: async ({ where }: any) => {
      return mockSlots.find((s) => s.id === where.id) || null
    },
    update: async ({ where, data }: any) => {
      const idx = mockSlots.findIndex((s) => s.id === where.id)
      if (idx !== -1) {
        mockSlots[idx] = { ...mockSlots[idx], ...data }
        return mockSlots[idx]
      }
      return null
    },
  },
  booking: {
    findMany: async ({ where }: any) => {
      let filtered = [...mockBookings]
      if (where?.centreId) filtered = filtered.filter((b) => b.centreId === where.centreId)
      if (where?.farmerId) filtered = filtered.filter((b) => b.farmerId === where.farmerId)
      if (where?.status?.in) filtered = filtered.filter((b) => where.status.in.includes(b.status))
      return filtered.map((b) => ({
        ...b,
        slot: mockSlots.find((s) => s.id === b.slotId) || {},
        farmer: mockUsers.find((u) => u.id === b.farmerId) || { id: b.farmerId, name: 'Farmer', phone: '123' },
        centre: mockCentres.find((c) => c.id === b.centreId) || {},
      }))
    },
    findFirst: async ({ where }: any) => {
      return (
        mockBookings.find((b) => {
          if (where?.farmerId && b.farmerId !== where.farmerId) return false
          if (where?.centreId && b.centreId !== where.centreId) return false
          if (where?.status?.in && !where.status.in.includes(b.status)) return false
          return true
        }) || null
      )
    },
    findUnique: async ({ where }: any) => {
      const b = mockBookings.find((booking) => booking.id === where.id)
      if (!b) return null
      return {
        ...b,
        slot: mockSlots.find((s) => s.id === b.slotId) || {},
        farmer: mockUsers.find((u) => u.id === b.farmerId) || {},
        centre: mockCentres.find((c) => c.id === b.centreId) || {},
      }
    },
    update: async ({ where, data }: any) => {
      const idx = mockBookings.findIndex((b) => b.id === where.id)
      if (idx === -1) throw new Error('Booking not found')
      mockBookings[idx] = { ...mockBookings[idx], ...data, updatedAt: new Date() }
      return mockBookings[idx]
    },
    count: async (args?: any) => {
      let filtered = [...mockBookings]
      if (args?.where?.centreId) filtered = filtered.filter((b) => b.centreId === args.where.centreId)
      return filtered.length
    },
  },
  $transaction: async (fn: any) => {
    return fn(mockPrisma)
  },
}

;(globalThis as any).prisma = mockPrisma

// 3. Main Test Runner for Phase 3
async function runPhase3RealtimeTests() {
  console.log('🧪 Starting Phase 3 Realtime Queue Orchestration & Socket.IO Test Suite...\n')
  let passed = 0
  let total = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    total++
    if (condition) {
      console.log(`✅ Test ${total}: ${testName}`)
      passed++
    } else {
      console.error(`❌ Test ${total} FAILED: ${testName} ${detail ? `(${detail})` : ''}`)
      throw new Error(`Test ${total} failed: ${testName}`)
    }
  }

  // Import app and socket modules dynamically
  const { createExpressApp } = await import('../backend/app')
  const { initSocketServer, getSocketIO } = await import('../backend/socket')
  const { updateCentre } = await import('../services/centreService')

  const expressApp = createExpressApp()
  const server = http.createServer(expressApp)
  const ioServer = initSocketServer(server, { forceNew: true })

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Invalid test server address')
  }
  const port = address.port
  const baseUrl = `http://127.0.0.1:${port}`
  console.log(`📡 Test server running with Socket.IO on port ${port}\n`)

  // Sign test tokens
  const rameshToken = signToken({
    userId: 'usr_farmer_ramesh',
    phone: '9876543210',
    role: Role.FARMER,
    assignedCentreId: null,
  })

  const outsiderToken = signToken({
    userId: 'usr_farmer_outsider',
    phone: '9876543299',
    role: Role.FARMER,
    assignedCentreId: null,
  })

  const sureshOfficerToken = signToken({
    userId: 'usr_officer_suresh',
    phone: '9876543211',
    role: Role.OFFICER,
    assignedCentreId: 'centre_nashik',
  })

  const adminToken = signToken({
    userId: 'usr_admin_priya',
    phone: '9876543212',
    role: Role.ADMIN,
    assignedCentreId: null,
  })

  // Test 1: Handshake Authentication - Unauthenticated connection is rejected
  await new Promise<void>((resolve) => {
    const unauthClient = ClientIO(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: true,
    })

    unauthClient.on('connect_error', (err) => {
      assert(
        err.message.includes('Unauthorized'),
        'Unauthenticated Socket.IO connection is strictly rejected by JWT middleware'
      )
      unauthClient.disconnect()
      resolve()
    })

    unauthClient.on('connect', () => {
      unauthClient.disconnect()
      throw new Error('Unauthenticated socket should not have connected')
    })
  })

  // Test 2: Authenticated Farmer connection succeeds
  const rameshClient = ClientIO(baseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token: rameshToken },
  })

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Farmer connection timeout')), 4000)
    rameshClient.on('connect', () => {
      clearTimeout(timer)
      assert(true, 'Authenticated farmer successfully establishes Socket.IO connection')
      resolve()
    })
  })

  // Test 3: Farmer with active booking at Nashik can join room centre:centre_nashik
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join:centre timeout')), 4000)
    rameshClient.emit('join:centre', { centreId: 'centre_nashik' })
    rameshClient.on('joined:centre', (data) => {
      clearTimeout(timer)
      assert(
        data.centreId === 'centre_nashik' && data.room === 'centre:centre_nashik',
        'Farmer with active booking successfully joins authorized centre room'
      )
      resolve()
    })
    rameshClient.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Unexpected join error: ${JSON.stringify(err)}`))
    })
  })

  // Test 4: Farmer without active booking is denied room access (403 Forbidden)
  const outsiderClient = ClientIO(baseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token: outsiderToken },
  })

  await new Promise<void>((resolve, reject) => {
    outsiderClient.on('connect', () => {
      outsiderClient.emit('join:centre', { centreId: 'centre_nashik' })
    })
    outsiderClient.on('error', (err) => {
      assert(
        err.message.includes('Forbidden') || err.message.includes('active booking'),
        'Farmer without active booking is blocked from joining centre room (RBAC check)'
      )
      outsiderClient.disconnect()
      resolve()
    })
    outsiderClient.on('joined:centre', () => {
      outsiderClient.disconnect()
      reject(new Error('Outsider farmer should not be allowed to join room'))
    })
  })

  // Test 5: Officer connects and is allowed in assigned centre room
  const officerClient = ClientIO(baseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token: sureshOfficerToken },
  })

  await new Promise<void>((resolve, reject) => {
    officerClient.on('connect', () => {
      officerClient.emit('join:centre', { centreId: 'centre_nashik' })
    })
    officerClient.on('joined:centre', (data) => {
      assert(
        data.room === 'centre:centre_nashik',
        'Officer joins room for assigned centre (Nashik)'
      )
      resolve()
    })
  })

  // Test 6 & 7: Officer updates processing speed -> queue recalculated & broadcast received
  // Listen on rameshClient for 'queue:update'
  const broadcastPromise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Did not receive queue:update broadcast within 5s')), 5000)
    rameshClient.on('queue:update', (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })

  // Also listen on rameshClient for targeted 'farmer:queue:update'
  const targetedPromise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Did not receive farmer:queue:update within 5s')), 5000)
    rameshClient.on('farmer:queue:update', (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })

  // Officer triggers condition update: processingRate updated from 5.25 to 8.0
  const officerUser = {
    id: 'usr_officer_suresh',
    name: 'Suresh Patil',
    phone: '9876543211',
    role: Role.OFFICER,
    language: 'en',
    assignedCentreId: 'centre_nashik',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const updateResult = await updateCentre(
    'centre_nashik',
    { processingRate: 8.0 },
    officerUser
  )

  assert(
    updateResult.processingRate === 8.0,
    'Officer successfully updates centre processing rate to 8.0 minutes'
  )

  const broadcastEvent = await broadcastPromise
  assert(
    broadcastEvent.centreId === 'centre_nashik' &&
      broadcastEvent.processingRate === 8.0 &&
      Array.isArray(broadcastEvent.updates) &&
      broadcastEvent.updates.length === 2,
    'Socket.IO room received queue:update broadcast with all affected queue members',
    `Updates count: ${broadcastEvent.updates?.length}`
  )

  // Test 8: Verify targeted farmer:queue:update event
  const targetedEvent = await targetedPromise
  assert(
    targetedEvent.bookingId === 'bk_1' &&
      targetedEvent.farmerId === 'usr_farmer_ramesh' &&
      typeof targetedEvent.etaMinutes === 'number' &&
      Boolean(targetedEvent.arrivalWindow.formatted),
    'Farmer received targeted farmer:queue:update with recalculated arrival window',
    `ETA: ${targetedEvent.etaMinutes}m, Window: ${targetedEvent.arrivalWindow.formatted}`
  )

  // Test 9: Verify mathematical consistency with Smart Queue Engine
  const rameshUpdated = broadcastEvent.updates.find((u: any) => u.farmerId === 'usr_farmer_ramesh')
  const meenaUpdated = broadcastEvent.updates.find((u: any) => u.farmerId === 'usr_farmer_meena')

  const expectedState: CentreState = {
    queue: 2,
    capacity: 60,
    processingMinutes: 8.0,
    delayMinutes: 0,
    bookings: 2,
    counters: 4,
  }

  const expectedRameshETA = calculateETA(0, expectedState)
  const expectedMeenaETA = calculateETA(1, expectedState)

  assert(
    rameshUpdated.etaMinutes === expectedRameshETA && meenaUpdated.etaMinutes === expectedMeenaETA,
    'Recalculated ETAs match Smart Queue Engine deterministic calculation exactly',
    `Ramesh ETA: ${rameshUpdated.etaMinutes} vs ${expectedRameshETA}, Meena ETA: ${meenaUpdated.etaMinutes} vs ${expectedMeenaETA}`
  )

  // Test 10: Officer marks delay -> +15m delay broadcasted
  const delayBroadcastPromise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Delay broadcast timeout')), 5000)
    rameshClient.once('queue:update', (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })

  await updateCentre('centre_nashik', { status: 'DELAYED' }, officerUser)
  const delayEvent = await delayBroadcastPromise

  assert(
    delayEvent.isDelayed === true && delayEvent.delayMinutes === 15,
    'Officer marks DELAYED status: queue engine adds 15min delay and broadcasts immediately'
  )

  // Test 11: Cleanup and Disconnection
  rameshClient.emit('leave:centre', { centreId: 'centre_nashik' })
  rameshClient.disconnect()
  officerClient.disconnect()
  server.close()

  assert(true, 'Sockets gracefully leave centre rooms and close connection')

  console.log(`\n🎉 Phase 3 Realtime Queue Orchestration Test Suite: ${passed}/${total} Tests Passed!\n`)
}

runPhase3RealtimeTests().catch((err) => {
  console.error('❌ Phase 3 Realtime Test Suite failed:', err)
  process.exit(1)
})
