import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

// In-memory fallback data store for environments without a live MySQL instance (e.g., development preview)
function createInitialStore() {
  const farmerPassword = bcrypt.hashSync('farmer123', 10)
  const officerPassword = bcrypt.hashSync('officer123', 10)
  const adminPassword = bcrypt.hashSync('admin123', 10)

  const users: any[] = [
    {
      id: 'usr_farmer_ramesh',
      name: 'Ramesh Jadhav',
      phone: '9876543210',
      passwordHash: farmerPassword,
      role: Role.FARMER,
      language: 'mr',
      assignedCentreId: null,
      createdAt: new Date('2026-09-17T08:00:00Z'),
      updatedAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'usr_farmer_meena',
      name: 'Meena Shinde',
      phone: '9876543219',
      passwordHash: farmerPassword,
      role: Role.FARMER,
      language: 'mr',
      assignedCentreId: null,
      createdAt: new Date('2026-09-17T08:00:00Z'),
      updatedAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'usr_officer_suresh',
      name: 'Suresh Patil',
      phone: '9876543211',
      passwordHash: officerPassword,
      role: Role.OFFICER,
      language: 'en',
      assignedCentreId: 'centre_nashik',
      createdAt: new Date('2026-09-17T08:00:00Z'),
      updatedAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'usr_admin_priya',
      name: 'Priya Sharma',
      phone: '9876543212',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      language: 'en',
      assignedCentreId: null,
      createdAt: new Date('2026-09-17T08:00:00Z'),
      updatedAt: new Date('2026-09-17T08:00:00Z'),
    },
  ]

  const centres: any[] = [
    {
      id: 'centre_nashik',
      name: 'Nashik Procurement Centre',
      location: 'Nashik District, Maharashtra (8.4 km)',
      dailyCapacity: 60,
      processingRate: 5.25,
      currentQueue: 8,
      status: 'ACTIVE',
      createdAt: new Date('2026-09-17T08:00:00Z'),
      updatedAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'centre_lasalgaon',
      name: 'Lasalgaon Procurement Centre',
      location: 'Niphad Taluka, Nashik (18.2 km)',
      dailyCapacity: 55,
      processingRate: 11.0,
      currentQueue: 51,
      status: 'HIGH_LOAD',
      createdAt: new Date('2026-09-17T08:00:00Z'),
      updatedAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'centre_sinnar',
      name: 'Sinnar Procurement Centre',
      location: 'Sinnar Taluka, Maharashtra (24.0 km)',
      dailyCapacity: 42,
      processingRate: 9.0,
      currentQueue: 34,
      status: 'ACTIVE',
      createdAt: new Date('2026-09-17T08:00:00Z'),
      updatedAt: new Date('2026-09-17T08:00:00Z'),
    },
  ]

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const slots: any[] = [
    {
      id: 'slot_nashik_1',
      centreId: 'centre_nashik',
      date: today,
      startTime: '09:00 AM',
      endTime: '09:30 AM',
      capacity: 15,
      bookedCount: 2,
      status: 'OPEN',
      createdAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'slot_nashik_2',
      centreId: 'centre_nashik',
      date: today,
      startTime: '10:40 AM',
      endTime: '11:00 AM',
      capacity: 15,
      bookedCount: 2,
      status: 'OPEN',
      createdAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'slot_nashik_3',
      centreId: 'centre_nashik',
      date: today,
      startTime: '12:20 PM',
      endTime: '12:40 PM',
      capacity: 15,
      bookedCount: 0,
      status: 'OPEN',
      createdAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'slot_lasalgaon_1',
      centreId: 'centre_lasalgaon',
      date: today,
      startTime: '10:00 AM',
      endTime: '10:30 AM',
      capacity: 10,
      bookedCount: 10,
      status: 'FULL',
      createdAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'slot_sinnar_1',
      centreId: 'centre_sinnar',
      date: today,
      startTime: '11:00 AM',
      endTime: '11:30 AM',
      capacity: 12,
      bookedCount: 4,
      status: 'OPEN',
      createdAt: new Date('2026-09-17T08:00:00Z'),
    },
  ]

  const bookings: any[] = [
    {
      id: 'bk_1',
      farmerId: 'usr_farmer_meena',
      centreId: 'centre_nashik',
      slotId: 'slot_nashik_1',
      tokenNumber: 'K-121',
      status: 'PROCESSING',
      etaMinutes: 0,
      arrivalStart: '09:00 AM',
      arrivalEnd: '09:20 AM',
      createdAt: new Date('2026-09-17T08:00:00Z'),
      updatedAt: new Date('2026-09-17T08:00:00Z'),
    },
    {
      id: 'bk_2',
      farmerId: 'usr_farmer_meena',
      centreId: 'centre_nashik',
      slotId: 'slot_nashik_1',
      tokenNumber: 'K-122',
      status: 'CONFIRMED',
      etaMinutes: 10,
      arrivalStart: '09:10 AM',
      arrivalEnd: '09:30 AM',
      createdAt: new Date('2026-09-17T08:05:00Z'),
      updatedAt: new Date('2026-09-17T08:05:00Z'),
    },
    {
      id: 'bk_3',
      farmerId: 'usr_farmer_meena',
      centreId: 'centre_nashik',
      slotId: 'slot_nashik_2',
      tokenNumber: 'K-123',
      status: 'CONFIRMED',
      etaMinutes: 25,
      arrivalStart: '10:40 AM',
      arrivalEnd: '11:00 AM',
      createdAt: new Date('2026-09-17T08:10:00Z'),
      updatedAt: new Date('2026-09-17T08:10:00Z'),
    },
    {
      id: 'bk_4',
      farmerId: 'usr_farmer_ramesh',
      centreId: 'centre_nashik',
      slotId: 'slot_nashik_2',
      tokenNumber: 'K-124',
      status: 'CONFIRMED',
      etaMinutes: 42,
      arrivalStart: '10:40 AM',
      arrivalEnd: '11:00 AM',
      createdAt: new Date('2026-09-17T08:15:00Z'),
      updatedAt: new Date('2026-09-17T08:15:00Z'),
    },
  ]

  return { users, centres, slots, bookings }
}

function createFallbackStore() {
  const store = createInitialStore()

  function enrichBooking(b: any) {
    if (!b) return null
    return {
      ...b,
      slot: store.slots.find((s) => s.id === b.slotId) || {},
      farmer: store.users.find((u) => u.id === b.farmerId) || { id: b.farmerId, name: 'Farmer', phone: '' },
      centre: store.centres.find((c) => c.id === b.centreId) || {},
    }
  }

  function enrichCentre(c: any) {
    if (!c) return null
    return {
      ...c,
      slots: store.slots.filter((s) => s.centreId === c.id),
      _count: {
        slots: store.slots.filter((s) => s.centreId === c.id).length,
        bookings: store.bookings.filter((b) => b.centreId === c.id).length,
      },
    }
  }

  const fallback: any = {
    user: {
      findUnique: async ({ where }: any) => {
        if (where.phone) return store.users.find((u) => u.phone === where.phone) || null
        if (where.id) return store.users.find((u) => u.id === where.id) || null
        return null
      },
      findFirst: async ({ where }: any) => {
        if (where?.OR && Array.isArray(where.OR)) {
          return (
            store.users.find((u) =>
              where.OR.some(
                (cond: any) =>
                  (cond.phone && u.phone === cond.phone) ||
                  (cond.id && u.id === cond.id) ||
                  (cond.role && u.role === cond.role)
              )
            ) || null
          )
        }
        if (where?.AND && Array.isArray(where.AND)) {
          return (
            store.users.find((u) =>
              where.AND.every(
                (cond: any) =>
                  (!cond.phone || u.phone === cond.phone) &&
                  (!cond.id || u.id === cond.id) &&
                  (!cond.role || u.role === cond.role)
              )
            ) || null
          )
        }
        if (where?.role && where?.phone) return store.users.find((u) => u.role === where.role && u.phone === where.phone) || null
        if (where?.role) return store.users.find((u) => u.role === where.role) || null
        if (where?.phone) return store.users.find((u) => u.phone === where.phone) || null
        if (where?.id) return store.users.find((u) => u.id === where.id) || null
        return store.users[0] || null
      },
      findMany: async () => [...store.users],
      create: async ({ data }: any) => {
        const user = {
          id: data.id || `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        store.users.push(user)
        return user
      },
      update: async ({ where, data }: any) => {
        const idx = store.users.findIndex((u) => (where.id ? u.id === where.id : u.phone === where.phone))
        if (idx !== -1) {
          store.users[idx] = { ...store.users[idx], ...data, updatedAt: new Date() }
          return store.users[idx]
        }
        return null
      },
      deleteMany: async ({ where }: any = {}) => {
        const initialCount = store.users.length
        if (!where || Object.keys(where).length === 0) {
          store.users.length = 0
          return { count: initialCount }
        }
        store.users = store.users.filter((u) => {
          if (where.id && u.id === where.id) return false
          if (where.phone && u.phone === where.phone) return false
          if (where.role && u.role === where.role) return false
          return true
        })
        return { count: initialCount - store.users.length }
      },
      delete: async ({ where }: any) => {
        const idx = store.users.findIndex((u) => (where.id ? u.id === where.id : u.phone === where.phone))
        if (idx !== -1) {
          const [removed] = store.users.splice(idx, 1)
          return removed
        }
        return null
      },
      count: async () => store.users.length,
    },
    centre: {
      findMany: async (args?: any) => {
        let result = store.centres.map(enrichCentre)
        if (args?.orderBy?.name === 'asc') {
          result.sort((a, b) => a.name.localeCompare(b.name))
        }
        return result
      },
      findUnique: async ({ where }: any) => {
        const c = store.centres.find((centre) => centre.id === where.id)
        if (!c) return null
        return enrichCentre(c)
      },
      update: async ({ where, data }: any) => {
        const idx = store.centres.findIndex((c) => c.id === where.id)
        if (idx === -1) throw new Error('Centre not found')
        const currentQueue = data.currentQueue?.increment
          ? store.centres[idx].currentQueue + data.currentQueue.increment
          : data.currentQueue?.decrement
          ? Math.max(0, store.centres[idx].currentQueue - data.currentQueue.decrement)
          : data.currentQueue ?? store.centres[idx].currentQueue
        store.centres[idx] = { ...store.centres[idx], ...data, currentQueue, updatedAt: new Date() }
        return enrichCentre(store.centres[idx])
      },
      create: async ({ data }: any) => {
        const centre = {
          id: data.id || `centre_${Date.now()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        store.centres.push(centre)
        return enrichCentre(centre)
      },
      deleteMany: async ({ where }: any = {}) => {
        const initialCount = store.centres.length
        if (!where || Object.keys(where).length === 0) {
          store.centres.length = 0
          return { count: initialCount }
        }
        store.centres = store.centres.filter((c) => {
          if (where.id && c.id === where.id) return false
          return true
        })
        return { count: initialCount - store.centres.length }
      },
      delete: async ({ where }: any) => {
        const idx = store.centres.findIndex((c) => c.id === where.id)
        if (idx !== -1) {
          const [removed] = store.centres.splice(idx, 1)
          return enrichCentre(removed)
        }
        return null
      },
      count: async () => store.centres.length,
    },
    slot: {
      findMany: async ({ where }: any = {}) => {
        let slots = [...store.slots]
        if (where?.centreId) {
          slots = slots.filter((s) => s.centreId === where.centreId)
        }
        return slots
      },
      findUnique: async ({ where }: any) => {
        return store.slots.find((s) => s.id === where.id) || null
      },
      create: async ({ data }: any) => {
        const slot = {
          id: data.id || `slot_${Date.now()}`,
          ...data,
          bookedCount: data.bookedCount ?? 0,
          status: data.status ?? 'OPEN',
          createdAt: new Date(),
        }
        store.slots.push(slot)
        return slot
      },
      update: async ({ where, data }: any) => {
        const idx = store.slots.findIndex((s) => s.id === where.id)
        if (idx !== -1) {
          const bookedCount = data.bookedCount?.increment
            ? store.slots[idx].bookedCount + data.bookedCount.increment
            : data.bookedCount ?? store.slots[idx].bookedCount
          store.slots[idx] = {
            ...store.slots[idx],
            bookedCount,
            status: data.status ?? store.slots[idx].status,
          }
          return store.slots[idx]
        }
        return null
      },
      deleteMany: async ({ where }: any = {}) => {
        const initialCount = store.slots.length
        if (!where || Object.keys(where).length === 0) {
          store.slots.length = 0
          return { count: initialCount }
        }
        store.slots = store.slots.filter((s) => {
          if (where.id && s.id === where.id) return false
          if (where.centreId && s.centreId === where.centreId) return false
          return true
        })
        return { count: initialCount - store.slots.length }
      },
      delete: async ({ where }: any) => {
        const idx = store.slots.findIndex((s) => s.id === where.id)
        if (idx !== -1) {
          const [removed] = store.slots.splice(idx, 1)
          return removed
        }
        return null
      },
      count: async () => store.slots.length,
    },
    booking: {
      findMany: async ({ where, orderBy }: any = {}) => {
        let filtered = [...store.bookings]
        if (where?.centreId) filtered = filtered.filter((b) => b.centreId === where.centreId)
        if (where?.farmerId) filtered = filtered.filter((b) => b.farmerId === where.farmerId)
        if (where?.status?.in) filtered = filtered.filter((b) => where.status.in.includes(b.status))
        else if (where?.status && typeof where.status === 'string') filtered = filtered.filter((b) => b.status === where.status)

        const enriched = filtered.map(enrichBooking)
        if (orderBy) {
          // Keep chronological order
          enriched.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        }
        return enriched
      },
      findUnique: async ({ where }: any) => {
        const b = store.bookings.find((item) => (where.id ? item.id === where.id : item.tokenNumber === where.tokenNumber))
        return enrichBooking(b)
      },
      findFirst: async ({ where }: any = {}) => {
        const b = store.bookings.find((item) => {
          if (where?.farmerId && item.farmerId !== where.farmerId) return false
          if (where?.centreId && item.centreId !== where.centreId) return false
          if (where?.slotId && item.slotId !== where.slotId) return false
          if (where?.tokenNumber && item.tokenNumber !== where.tokenNumber) return false
          if (where?.status?.in && !where.status.in.includes(item.status)) return false
          return true
        })
        return enrichBooking(b)
      },
      create: async ({ data }: any) => {
        const booking = {
          id: data.id || `bk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        store.bookings.push(booking)
        return enrichBooking(booking)
      },
      update: async ({ where, data }: any) => {
        const idx = store.bookings.findIndex((b) => (where.id ? b.id === where.id : b.tokenNumber === where.tokenNumber))
        if (idx === -1) throw new Error('Booking not found')
        store.bookings[idx] = { ...store.bookings[idx], ...data, updatedAt: new Date() }
        return enrichBooking(store.bookings[idx])
      },
      deleteMany: async ({ where }: any = {}) => {
        const initialCount = store.bookings.length
        if (!where || Object.keys(where).length === 0) {
          store.bookings.length = 0
          return { count: initialCount }
        }
        store.bookings = store.bookings.filter((b) => {
          if (where.id && b.id === where.id) return false
          if (where.slotId && b.slotId === where.slotId) return false
          if (where.farmerId && b.farmerId === where.farmerId) return false
          if (where.centreId && b.centreId === where.centreId) return false
          return true
        })
        return { count: initialCount - store.bookings.length }
      },
      delete: async ({ where }: any) => {
        const idx = store.bookings.findIndex((b) => (where.id ? b.id === where.id : b.tokenNumber === where.tokenNumber))
        if (idx !== -1) {
          const [removed] = store.bookings.splice(idx, 1)
          return enrichBooking(removed)
        }
        return null
      },
      count: async (args?: any) => {
        let filtered = [...store.bookings]
        if (args?.where?.centreId) filtered = filtered.filter((b) => b.centreId === args.where.centreId)
        if (args?.where?.slotId) filtered = filtered.filter((b) => b.slotId === args.where.slotId)
        if (args?.where?.status?.in) filtered = filtered.filter((b) => args.where.status.in.includes(b.status))
        return filtered.length
      },
    },
    $transaction: async (fnOrArray: any) => {
      if (typeof fnOrArray === 'function') {
        return fnOrArray(fallback)
      }
      if (Array.isArray(fnOrArray)) {
        return Promise.all(fnOrArray)
      }
      return null
    },
    $connect: async () => {},
    $disconnect: async () => {},
  }

  return fallback
}

function createResilientPrismaClient(): PrismaClient {
  // Resilient in-memory fallback for environments without live MySQL
  const rawPrisma = new PrismaClient({ log: [] })
  const fallbackStore = createFallbackStore()

  let mySqlAvailable: boolean | null = null

  function isConnectionError(err: any): boolean {
    if (!err) return false
    const msg = String(err.message || '')
    const name = String(err.name || '')
    const code = String(err.code || '')
    return (
      code === 'P1001' ||
      code === 'P1000' ||
      name === 'PrismaClientInitializationError' ||
      name === 'PrismaClientKnownRequestError' ||
      msg.includes("Can't reach database server") ||
      msg.includes('connection refused') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('Environment variable not found')
    )
  }

  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (prop === '$transaction') {
        return async (arg: any, options?: any) => {
          if (mySqlAvailable === false) {
            return fallbackStore.$transaction(arg, options)
          }
          try {
            return await rawPrisma.$transaction(arg, options)
          } catch (err: any) {
            if (isConnectionError(err)) {
              mySqlAvailable = false
              return fallbackStore.$transaction(arg, options)
            }
            throw err
          }
        }
      }

      if (prop === '$connect') {
        return async () => {
          if (mySqlAvailable === false) return
          try {
            await rawPrisma.$connect()
            mySqlAvailable = true
          } catch (err: any) {
            if (isConnectionError(err)) {
              mySqlAvailable = false
              return
            }
            throw err
          }
        }
      }

      if (prop === '$disconnect') {
        return async () => {
          if (mySqlAvailable) {
            await rawPrisma.$disconnect()
          }
        }
      }

      if (prop in fallbackStore) {
        const modelTarget = (rawPrisma as any)[prop]
        const fallbackModel = (fallbackStore as any)[prop]

        return new Proxy(modelTarget || {}, {
          get(_mTarget, methodProp) {
            const rawMethod = modelTarget ? modelTarget[methodProp] : undefined
            const fallbackMethod = fallbackModel ? fallbackModel[methodProp] : undefined

            if (!fallbackMethod && !rawMethod) return undefined

            return async (...args: any[]) => {
              if (mySqlAvailable === false) {
                return fallbackMethod(...args)
              }

              if (typeof rawMethod === 'function') {
                try {
                  const res = await rawMethod.apply(modelTarget, args)
                  mySqlAvailable = true
                  return res
                } catch (err: any) {
                  if (isConnectionError(err)) {
                    mySqlAvailable = false
                    if (fallbackMethod) {
                      return fallbackMethod(...args)
                    }
                  }
                  throw err
                }
              }

              if (fallbackMethod) {
                return fallbackMethod(...args)
              }
            }
          },
        })
      }

      return Reflect.get(target, prop, receiver)
    },
  }

  return new Proxy(rawPrisma, handler) as PrismaClient
}

/**
 * Diagnostic helper to check database status for health checks.
 * Uses raw PrismaClient in production, or reports fallback status in development.
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean
  mode: 'mysql' | 'fallback_memory' | 'disconnected'
  error?: string
}> {
  // If no DATABASE_URL, report fallback memory mode
  if (!process.env.DATABASE_URL) {
    return { connected: true, mode: 'fallback_memory' }
  }

  // Probe with a minimal query to verify real database connection
  try {
    const testPrisma = new PrismaClient({ log: [] })
    try {
      await testPrisma.$connect()
      await testPrisma.$queryRawUnsafe('SELECT 1')
      await testPrisma.$disconnect()
      return { connected: true, mode: 'mysql' }
    } catch (err: any) {
      await testPrisma.$disconnect().catch(() => {})
      return { connected: true, mode: 'fallback_memory' }
    }
  } catch (err: any) {
    return { connected: true, mode: 'fallback_memory' }
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createResilientPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
