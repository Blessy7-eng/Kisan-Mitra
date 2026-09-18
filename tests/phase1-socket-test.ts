import http from 'http'
import express from 'express'
import { io as ClientIO } from 'socket.io-client'
import { signToken } from '../lib/auth'
import { Role } from '@prisma/client'

// Mock prisma for isolated test execution
const mockAdminUser = {
  id: 'usr_admin_test_p1',
  name: 'Test Admin',
  phone: '9999999999',
  role: Role.ADMIN,
  language: 'en',
  assignedCentreId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

;(globalThis as any).prisma = {
  user: {
    findUnique: async ({ where }: any) => {
      if (where?.id === mockAdminUser.id) return mockAdminUser
      return null
    },
  },
}

async function runSocketFoundationTest() {
  const { initSocketServer, getCentreRoomName } = await import('../backend/socket')
  console.log('🧪 Starting Phase 1 Socket.IO Foundation & Centre Room Test...\n')

  const expressApp = express()
  const server = http.createServer(expressApp)
  const ioServer = initSocketServer(server, { forceNew: true })

  if (!ioServer) {
    throw new Error('Socket.IO failed to initialize')
  }

  // Start on an ephemeral port for testing
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Invalid server address')
  }
  const testPort = address.port
  console.log(`✅ Test server running on port ${testPort}`)

  const adminToken = signToken({
    userId: mockAdminUser.id,
    phone: mockAdminUser.phone,
    role: mockAdminUser.role,
    assignedCentreId: null,
  })

  // Connect authenticated test client
  const client = ClientIO(`http://127.0.0.1:${testPort}`, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: {
      token: adminToken,
    },
  })

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timed out')), 5000)

    client.on('connect', () => {
      clearTimeout(timeout)
      console.log(`✅ Test client connected with ID: ${client.id}`)
      resolve()
    })

    client.on('connect_error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })

  // Test join:centre
  const centreId = 'centre_nashik'
  const expectedRoom = getCentreRoomName(centreId)

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('join:centre timed out')), 5000)

    client.emit('join:centre', { centreId })

    client.on('joined:centre', (data: any) => {
      clearTimeout(timeout)
      console.log('✅ Received joined:centre confirmation:', data)
      if (data.centreId === centreId && data.room === expectedRoom) {
        resolve()
      } else {
        reject(new Error(`Unexpected joined:centre payload: ${JSON.stringify(data)}`))
      }
    })
  })

  // Test leave:centre
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('leave:centre timed out')), 5000)

    client.emit('leave:centre', { centreId })

    client.on('left:centre', (data: any) => {
      clearTimeout(timeout)
      console.log('✅ Received left:centre confirmation:', data)
      if (data.centreId === centreId && data.room === expectedRoom) {
        resolve()
      } else {
        reject(new Error(`Unexpected left:centre payload: ${JSON.stringify(data)}`))
      }
    })
  })

  // Clean up
  client.disconnect()
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
  })

  console.log('\n🎉 Phase 1 Socket.IO Foundation & Centre Room Tests PASSED!')
}

runSocketFoundationTest().catch((err) => {
  console.error('❌ Phase 1 test failed:', err)
  process.exit(1)
})
