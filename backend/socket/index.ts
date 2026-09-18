import { Server as SocketIOServer, Socket } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import { verifyToken, sanitizeUser, AuthenticatedUser } from '../../lib/auth'
import { prisma } from '../../lib/prisma'
import { Role } from '@prisma/client'

let io: SocketIOServer | null = null

export function getCentreRoomName(centreId: string): string {
  return `centre:${centreId}`
}

export function getUserRoomName(userId: string): string {
  return `user:${userId}`
}

export function initSocketServer(httpServer: HTTPServer, options?: { forceNew?: boolean }): SocketIOServer {
  if (io && !options?.forceNew) {
    return io
  }

  if (io && options?.forceNew) {
    try {
      io.close()
    } catch {
      // ignore
    }
    io = null
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
    path: '/socket.io',
  })

  // STEP 1: Secure Socket.IO Authentication Middleware via JWT
  io.use(async (socket: Socket, next) => {
    try {
      // Check auth object, Authorization header, or query parameter
      const authHeader = socket.handshake.headers?.authorization
      let token: string | undefined = undefined

      if (socket.handshake.auth && typeof socket.handshake.auth.token === 'string') {
        token = socket.handshake.auth.token
      } else if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim()
      } else if (typeof socket.handshake.query?.token === 'string') {
        token = socket.handshake.query.token
      }

      if (!token) {
        return next(new Error('Unauthorized: Authentication token required'))
      }

      const payload = verifyToken(token)
      if (!payload || !payload.userId) {
        return next(new Error('Unauthorized: Invalid or expired token'))
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      })

      if (!user) {
        return next(new Error('Unauthorized: User account not found'))
      }

      // Attach sanitized authenticated user context to socket
      socket.data.user = sanitizeUser(user) as AuthenticatedUser
      next()
    } catch (err: any) {
      return next(new Error(`Unauthorized: Authentication failed (${err.message})`))
    }
  })

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as AuthenticatedUser
    console.log(`🔌 [Socket.IO] Authenticated client connected: ${socket.id} (${user.role} - ${user.name || user.id})`)

    // Automatically join private user channel for targeted notifications/ETAs
    socket.join(getUserRoomName(user.id))

    // STEP 2: Secure Centre Room Access
    socket.on('join:centre', async (data: { centreId: string } | string) => {
      const centreId = typeof data === 'string' ? data : data?.centreId
      if (!centreId) {
        socket.emit('error', { message: 'centreId is required to join centre room' })
        return
      }

      // Authorization checks based on user role
      if (user.role === Role.OFFICER) {
        if (user.assignedCentreId && user.assignedCentreId !== centreId) {
          socket.emit('error', {
            message: 'Forbidden: Officers can only subscribe to their assigned centre room',
            centreId,
          })
          return
        }
      } else if (user.role === Role.FARMER) {
        // Farmer may subscribe ONLY to centres relevant to their active booking(s)
        const activeBooking = await prisma.booking.findFirst({
          where: {
            farmerId: user.id,
            centreId,
            status: { in: ['CONFIRMED', 'PROCESSING', 'PENDING'] },
          },
        })

        if (!activeBooking) {
          socket.emit('error', {
            message: 'Forbidden: You do not have an active booking at this procurement centre',
            centreId,
          })
          return
        }
      }

      const roomName = getCentreRoomName(centreId)
      socket.join(roomName)
      console.log(`🏠 [Socket.IO] Client ${socket.id} (${user.role}) authorized and joined room ${roomName}`)

      socket.emit('joined:centre', {
        centreId,
        room: roomName,
        timestamp: new Date().toISOString(),
      })
    })

    // Handle leaving a centre-specific room
    socket.on('leave:centre', (data: { centreId: string } | string) => {
      const centreId = typeof data === 'string' ? data : data?.centreId
      if (!centreId) return

      const roomName = getCentreRoomName(centreId)
      socket.leave(roomName)
      console.log(`🚪 [Socket.IO] Client ${socket.id} left room ${roomName}`)

      socket.emit('left:centre', {
        centreId,
        room: roomName,
      })
    })

    socket.on('disconnect', (reason: string) => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id} (reason: ${reason})`)
    })
  })

  console.log('✅ [Socket.IO] Initialized authenticated Socket.IO server with RBAC-protected centre rooms')
  return io
}

export function resetSocketServer(): void {
  if (io) {
    try {
      io.close()
    } catch {
      // ignore
    }
    io = null
  }
}

export function getSocketIO(): SocketIOServer | null {
  return io
}
