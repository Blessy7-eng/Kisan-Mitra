import http from 'http'
import { Role } from '@prisma/client'
import { hashPassword, signToken } from '../lib/auth'

// In-Memory Data Store for Phase 2 API Testing (avoids needing a running MySQL daemon for CI/tests)
const mockUsers: any[] = []
const mockCentres: any[] = [
  {
    id: 'centre_nashik',
    name: 'Nashik Procurement Centre',
    location: 'Nashik District, Maharashtra',
    dailyCapacity: 60,
    processingRate: 5.25,
    currentQueue: 8,
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
const mockSlots: any[] = [
  {
    id: 'slot_1',
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
const mockBookings: any[] = []

// Setup global Prisma mock before importing app/services
const mockPrisma: any = {
  user: {
    findUnique: async ({ where }: any) => {
      if (where.phone) return mockUsers.find((u) => u.phone === where.phone) || null
      if (where.id) return mockUsers.find((u) => u.id === where.id) || null
      return null
    },
    findFirst: async ({ where }: any) => {
      if (where?.OR && Array.isArray(where.OR)) {
        return (
          mockUsers.find((u) =>
            where.OR.some(
              (cond: any) =>
                (cond.phone && u.phone === cond.phone) ||
                (cond.id && u.id === cond.id) ||
                (cond.role && u.role === cond.role)
            )
          ) || null
        )
      }
      if (where?.role && where?.phone) return mockUsers.find((u) => u.role === where.role && u.phone === where.phone) || null
      if (where?.role) return mockUsers.find((u) => u.role === where.role) || null
      if (where?.phone) return mockUsers.find((u) => u.phone === where.phone) || null
      if (where?.id) return mockUsers.find((u) => u.id === where.id) || null
      return mockUsers[0] || null
    },
    create: async ({ data }: any) => {
      const user = {
        id: `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockUsers.push(user)
      return user
    },
    deleteMany: async () => {},
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
    findMany: async ({ where }: any) => {
      return mockSlots.filter((s) => s.centreId === where.centreId)
    },
    findUnique: async ({ where }: any) => {
      return mockSlots.find((s) => s.id === where.id) || null
    },
    create: async ({ data }: any) => {
      const slot = {
        id: `slot_${Date.now()}`,
        ...data,
        bookedCount: 0,
        status: 'OPEN',
        createdAt: new Date(),
      }
      mockSlots.push(slot)
      return slot
    },
    update: async ({ where, data }: any) => {
      const idx = mockSlots.findIndex((s) => s.id === where.id)
      if (idx !== -1) {
        mockSlots[idx] = {
          ...mockSlots[idx],
          bookedCount: data.bookedCount?.increment
            ? mockSlots[idx].bookedCount + data.bookedCount.increment
            : data.bookedCount ?? mockSlots[idx].bookedCount,
          status: data.status ?? mockSlots[idx].status,
        }
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
    findFirst: async ({ where }: any) => {
      return mockBookings.find((b) => b.farmerId === where?.farmerId && b.slotId === where?.slotId) || null
    },
    create: async ({ data, include }: any) => {
      const booking = {
        id: `bk_${Date.now()}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      mockBookings.push(booking)
      if (include) {
        return {
          ...booking,
          centre: mockCentres.find((c) => c.id === booking.centreId) || {},
          slot: mockSlots.find((s) => s.id === booking.slotId) || {},
          farmer: mockUsers.find((u) => u.id === booking.farmerId) || { id: booking.farmerId, name: 'Farmer', phone: '123' },
        }
      }
      return booking
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

// Inject mock into globalThis so lib/prisma.ts uses it
;(globalThis as any).prisma = mockPrisma

// Now dynamically import app
async function runPhase2Tests() {
  console.log('🧪 Starting Phase 2 Express REST API & RBAC Test Suite...\n')
  let passed = 0
  let total = 0

  // Seed default officer
  const officerPassHash = await hashPassword('officer123')
  const officerUser = await mockPrisma.user.create({
    data: {
      name: 'Suresh Patil (Officer)',
      phone: '9988776655',
      passwordHash: officerPassHash,
      role: Role.OFFICER,
      assignedCentreId: 'centre_nashik',
    },
  })

  const { createExpressApp } = await import('../backend/app')
  const app = createExpressApp()
  const server = http.createServer(app)

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  async function request(
    method: string,
    path: string,
    body?: any,
    token?: string
  ): Promise<{ status: number; data: any }> {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Invalid address')

    const url = `http://127.0.0.1:${address.port}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    return { status: res.status, data }
  }

  try {
    // 1. Health Check
    total++
    const health = await request('GET', '/api/health')
    if (health.status === 200 && health.data.status === 'ok') {
      console.log('✅ Test 1: Express /api/health responded with 200 OK')
      passed++
    } else {
      console.error('❌ Test 1 failed:', health)
    }

    // 2. Auth: Registration with Security Privilege Escalation Mitigation
    total++
    const testPhone = '9876543299'
    const regRes = await request('POST', '/api/auth/register', {
      name: 'Ramesh Jadhav',
      phone: testPhone,
      password: 'password123',
      role: 'ADMIN', // Deliberate attempt to escalate to ADMIN
    })

    if (regRes.status === 201 && regRes.data.user && regRes.data.user.role === Role.FARMER) {
      console.log('✅ Test 2: Public registration enforced FARMER role (privilege escalation blocked)')
      passed++
    } else {
      console.error('❌ Test 2 failed:', regRes)
    }

    // 3. Auth: Login
    total++
    const loginRes = await request('POST', '/api/auth/login', {
      phone: testPhone,
      password: 'password123',
    })

    let farmerToken = ''
    if (loginRes.status === 200 && loginRes.data.token && loginRes.data.user) {
      farmerToken = loginRes.data.token
      console.log('✅ Test 3: Farmer login succeeded and returned valid JWT token')
      passed++
    } else {
      console.error('❌ Test 3 failed:', loginRes)
    }

    // 4. Auth: Profile check
    total++
    const meRes = await request('GET', '/api/auth/me', undefined, farmerToken)
    if (meRes.status === 200 && meRes.data.user && meRes.data.user.phone === testPhone) {
      console.log('✅ Test 4: Authenticated /api/auth/me verified token identity')
      passed++
    } else {
      console.error('❌ Test 4 failed:', meRes)
    }

    // 5. Auth: Invalid token rejected
    total++
    const invalidTokenRes = await request('GET', '/api/auth/me', undefined, 'bad-token-xyz')
    if (invalidTokenRes.status === 401) {
      console.log('✅ Test 5: Invalid bearer token correctly rejected with 401 Unauthorized')
      passed++
    } else {
      console.error('❌ Test 5 failed:', invalidTokenRes)
    }

    // 6. Centres: List Centres
    total++
    const centresRes = await request('GET', '/api/centres')
    let testCentreId = 'centre_nashik'
    let otherCentreId = 'centre_lasalgaon'
    if (centresRes.status === 200 && Array.isArray(centresRes.data.centres) && centresRes.data.centres.length > 0) {
      console.log(`✅ Test 6: /api/centres returned ${centresRes.data.centres.length} centres with load metrics`)
      passed++
    } else {
      console.error('❌ Test 6 failed:', centresRes)
    }

    // 7. RBAC: Farmer cannot update centre
    total++
    const farmerUpdateCentre = await request(
      'PATCH',
      `/api/centres/${testCentreId}`,
      { processingRate: 7.0 },
      farmerToken
    )
    if (farmerUpdateCentre.status === 403) {
      console.log('✅ Test 7: RBAC blocked Farmer from modifying centre parameters (403 Forbidden)')
      passed++
    } else {
      console.error('❌ Test 7 failed:', farmerUpdateCentre)
    }

    // Officer Token
    const officerToken = signToken({
      userId: officerUser.id,
      phone: officerUser.phone,
      role: Role.OFFICER,
      assignedCentreId: officerUser.assignedCentreId,
    })

    // 8. RBAC: Officer allowed to update assigned centre
    total++
    const officerUpdate = await request(
      'PATCH',
      `/api/centres/${officerUser.assignedCentreId}`,
      { processingRate: 6.0 },
      officerToken
    )
    if (officerUpdate.status === 200 && officerUpdate.data.centre) {
      console.log('✅ Test 8: RBAC allowed Officer to update their assigned centre (200 OK)')
      passed++
    } else {
      console.error('❌ Test 8 failed:', officerUpdate)
    }

    // 9. RBAC: Officer blocked from updating a DIFFERENT centre
    total++
    const officerBlocked = await request(
      'PATCH',
      `/api/centres/${otherCentreId}`,
      { processingRate: 9.0 },
      officerToken
    )
    if (officerBlocked.status === 403) {
      console.log('✅ Test 9: RBAC blocked Officer from modifying an unassigned centre (403 Forbidden)')
      passed++
    } else {
      console.error('❌ Test 9 failed:', officerBlocked)
    }

    // 10. Slots: Get slots for centre (Authenticated)
    total++
    const slotsUnauth = await request('GET', `/api/centres/${testCentreId}/slots`)
    const slotsRes = await request('GET', `/api/centres/${testCentreId}/slots`, undefined, farmerToken)
    let testSlotId = 'slot_1'
    if (slotsUnauth.status === 401 && slotsRes.status === 200 && Array.isArray(slotsRes.data.slots)) {
      console.log(`✅ Test 10: /api/centres/:id/slots protected with auth (401 unauth rejected, returned ${slotsRes.data.slots.length} slots with token)`)
      passed++
    } else {
      console.error('❌ Test 10 failed:', { slotsUnauth: slotsUnauth.status, slotsRes: slotsRes.status })
    }

    // 11. Bookings: Farmer create booking
    total++
    let bookingId = ''
    const bookRes = await request(
      'POST',
      '/api/bookings',
      { centreId: testCentreId, slotId: testSlotId },
      farmerToken
    )
    if (bookRes.status === 201 && bookRes.data.booking && bookRes.data.booking.tokenNumber) {
      bookingId = bookRes.data.booking.id
      console.log(`✅ Test 11: Farmer booking created with token: ${bookRes.data.booking.tokenNumber}`)
      passed++
    } else {
      console.error('❌ Test 11 failed:', bookRes)
    }

    // 12. Bookings: Officer forbidden from creating farmer booking
    total++
    const officerBook = await request(
      'POST',
      '/api/bookings',
      { centreId: testCentreId, slotId: testSlotId },
      officerToken
    )
    if (officerBook.status === 403) {
      console.log('✅ Test 12: RBAC prevented Officer from creating a farmer booking (403 Forbidden)')
      passed++
    } else {
      console.error('❌ Test 12 failed:', officerBook)
    }

    // 13. Bookings: Farmer can look up own booking
    total++
    if (bookingId && farmerToken) {
      const getBooking = await request('GET', `/api/bookings/${bookingId}`, undefined, farmerToken)
      if (getBooking.status === 200 && getBooking.data.booking && getBooking.data.booking.id === bookingId) {
        console.log('✅ Test 13: Farmer successfully retrieved their own booking details')
        passed++
      } else {
        console.error('❌ Test 13 failed:', getBooking)
      }
    } else {
      console.error('❌ Test 13 failed: No booking ID')
    }

    // 14. Queue: Retrieve live centre queue (Requires Authentication)
    total++
    const queueUnauth = await request('GET', `/api/queue/${testCentreId}`)
    const queueRes = await request('GET', `/api/queue/${testCentreId}`, undefined, farmerToken)
    if (queueUnauth.status === 401 && queueRes.status === 200 && queueRes.data.centre && Array.isArray(queueRes.data.queue)) {
      console.log(`✅ Test 14: /api/queue/:centreId protected (401 unauth, returned queue depth of ${queueRes.data.queue.length} with token)`)
      passed++
    } else {
      console.error('❌ Test 14 failed:', { queueUnauth: queueUnauth.status, queueRes: queueRes.status })
    }

    // 15. Queue ETA: Retrieve dynamic ETA (Requires Authentication)
    total++
    const etaUnauth = await request('GET', `/api/queue/${testCentreId}/eta?bookingId=${bookingId}`)
    const etaRes = await request('GET', `/api/queue/${testCentreId}/eta?bookingId=${bookingId}`, undefined, farmerToken)
    if (etaUnauth.status === 401 && etaRes.status === 200 && typeof etaRes.data.etaMinutes === 'number' && etaRes.data.liveArrivalWindow) {
      console.log(`✅ Test 15: /api/queue/:centreId/eta protected (401 unauth, computed ETA of ${etaRes.data.etaMinutes} min and window: ${etaRes.data.liveArrivalWindow})`)
      passed++
    } else {
      console.error('❌ Test 15 failed:', { etaUnauth: etaUnauth.status, etaRes: etaRes.status })
    }

    console.log(`\n🎉 Phase 2 Express REST API & RBAC Test Suite: ${passed}/${total} Passed!`)
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }
}

runPhase2Tests().catch((err) => {
  console.error('❌ Phase 2 test suite failed:', err)
  process.exit(1)
})
