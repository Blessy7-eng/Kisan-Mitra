'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  Clock3,
  Gauge,
  LayoutDashboard,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sprout,
  TrendingUp,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react'
import RoleSelectionScreen, { SelectedRole } from '@/components/role-selection/RoleSelectionScreen'
import RoleLoginScreen from '@/components/auth/RoleLoginScreen'
import FarmerDashboard from '@/components/farmer/FarmerDashboard'
import OfficerDashboard from '@/components/officer/OfficerDashboard'
import AdminDashboard from '@/components/admin/AdminDashboard'
import BookingFlow from '@/components/booking/BookingFlow'
import { calculateCentreLoad, handleMissedSlot } from '@/lib/smartQueueEngine'

export type AuthStatus = 'ROLE_SELECTION' | 'LOGIN' | 'AUTHENTICATED'
export type Role = 'farmer' | 'officer' | 'admin'
export type Stage = 'Queue processing' | 'Produce verification' | 'Procurement completed'
export type Notice = { id: number; text: string; audience: Role | 'all'; time: string }

export type DemoState = {
  token: string
  ahead: number
  currentToken: string
  processingMinutes: number
  capacity: number
  delayMinutes: number
  stage: Stage
  payment: 'Pending' | 'Processing' | 'Completed'
  centre: string
  centreId: string
  slot: string
  slotId?: string
  bookingId?: string
  booked: boolean
  bookings: number
  processingCount: number
  notices: Notice[]
  missed: boolean
  etaMinutes: number
}

const NASHIK_CENTRE_ID = 'cmu5e1cag0000s6k48rlx1elq'

const initialDemoState: DemoState = {
  token: 'K-124',
  ahead: 8,
  currentToken: 'K-116',
  processingMinutes: 5.25,
  capacity: 61,
  delayMinutes: 0,
  stage: 'Queue processing',
  payment: 'Pending',
  centre: 'Nashik Procurement Centre',
  centreId: NASHIK_CENTRE_ID,
  slot: '10:40 – 11:00 AM',
  booked: true,
  bookings: 84,
  processingCount: 3,
  missed: false,
  etaMinutes: 42,
  notices: [{ id: 1, text: 'Your slot has been confirmed.', audience: 'farmer', time: 'Just now' }],
}

const navItems: Record<Role, string[]> = {
  farmer: ['Dashboard', 'Book a slot', 'My token & queue', 'Procurement status', 'Notifications', 'Profile'],
  officer: ['Control Room', 'Live Queue', 'Centre Conditions', 'Smart Queue Engine', 'Notifications', 'Profile'],
  admin: ['Network Overview', 'Centre Load & Fleet', 'Centre Inspector', 'System Health', 'Notifications', 'Profile'],
}

export default function Page() {
  // Authentication & Navigation Flow States
  const [authStatus, setAuthStatus] = useState<AuthStatus>('ROLE_SELECTION')
  const [selectedRoleContext, setSelectedRoleContext] = useState<SelectedRole>('farmer')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<any | null>(null)

  // In-App Navigation State
  const [page, setPage] = useState<string>('Dashboard')
  const [showNotices, setShowNotices] = useState<boolean>(false)

  // Real-time Queue State
  const [state, setState] = useState<DemoState>(initialDemoState)
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false)
  const [lastEtaChangeNotice, setLastEtaChangeNotice] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)

  // Authoritative role mapped strictly from verified backend JWT user object
  const activeRole: Role = authUser
    ? authUser.role === 'OFFICER'
      ? 'officer'
      : authUser.role === 'ADMIN'
      ? 'admin'
      : 'farmer'
    : selectedRoleContext

  // Initialize Socket.IO connection once authenticated
  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED' || !authToken) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setIsSocketConnected(false)
      }
      return
    }

    let active = true

    const socket = io({
      path: '/socket.io',
      auth: { token: authToken },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      if (!active) return
      setIsSocketConnected(true)

      // Join assigned centre room based on authenticated role and assignment
      const targetCentreId =
        activeRole === 'officer'
          ? authUser?.assignedCentreId || state.centreId || NASHIK_CENTRE_ID
          : state.centreId || NASHIK_CENTRE_ID

      if (targetCentreId) {
        socket.emit('join:centre', { centreId: targetCentreId })
      }
    })

    socket.on('disconnect', () => {
      if (!active) return
      setIsSocketConnected(false)
    })

    // Authoritative broadcast from Smart Queue Engine when officer updates conditions
    socket.on('queue:update', (payload: any) => {
      if (!active || !payload) return

      setState((prev) => {
        const matched = payload.updates?.find(
          (u: any) => u.tokenNumber === prev.token || (prev.bookingId && u.bookingId === prev.bookingId)
        )

        const newAhead = matched ? matched.queueAhead : prev.ahead
        const newSlot = matched?.arrivalWindow || prev.slot
        const newEta = matched?.etaMinutes ?? prev.etaMinutes
        const oldEta = prev.etaMinutes

        if (oldEta !== newEta) {
          const diffMsg = `Your ETA changed from ${oldEta} min to ${newEta} min because centre processing speed / delay changed.`
          setLastEtaChangeNotice(diffMsg)
        }

        return {
          ...prev,
          ahead: newAhead,
          slot: newSlot,
          etaMinutes: newEta,
          processingMinutes: payload.processingRate ?? prev.processingMinutes,
          capacity: payload.loadPercent ?? prev.capacity,
          notices: [
            {
              id: Date.now(),
              text: `Live queue recalculation: processing rate ${payload.processingRate ?? prev.processingMinutes}m, centre load ${payload.loadPercent ?? prev.capacity}%.`,
              audience: 'all' as const,
              time: 'Just now',
            },
            ...prev.notices,
          ].slice(0, 10),
        }
      })
    })

    // Private targeted notifications for the farmer
    socket.on('farmer:queue:update', (payload: any) => {
      if (!active || !payload) return
      const windowFormatted =
        typeof payload.arrivalWindow === 'string'
          ? payload.arrivalWindow
          : payload.arrivalWindow?.formatted || payload.arrivalWindow

      setState((prev) => {
        const oldEta = prev.etaMinutes
        const newEta = payload.etaMinutes ?? prev.etaMinutes
        if (oldEta !== newEta) {
          setLastEtaChangeNotice(`Your ETA changed from ${oldEta} min to ${newEta} min. New arrival window: ${windowFormatted}.`)
        }

        return {
          ...prev,
          ahead: payload.queueAhead ?? prev.ahead,
          slot: windowFormatted || prev.slot,
          etaMinutes: newEta,
          token: payload.tokenNumber || prev.token,
          notices: [
            {
              id: Date.now(),
              text: `Your personal arrival window updated to ${windowFormatted} (ETA: ${payload.etaMinutes} min).`,
              audience: 'farmer' as const,
              time: 'Just now',
            },
            ...prev.notices,
          ].slice(0, 10),
        }
      })
    })

    return () => {
      active = false
      socket.disconnect()
      socketRef.current = null
      setIsSocketConnected(false)
    }
  }, [authStatus, authToken, activeRole, authUser, state.centreId])

  // Step 1: Handle User Selecting a Role Context from "Who are you?"
  const handleSelectRole = (role: SelectedRole) => {
    setSelectedRoleContext(role)
    setAuthStatus('LOGIN')
  }

  // Step 2: Handle Successful Authentication with Backend JWT Role Validation
  const handleLoginSuccess = (token: string, user: any) => {
    setAuthToken(token)
    setAuthUser(user)
    setAuthStatus('AUTHENTICATED')
    setPage('Dashboard')
    setShowNotices(false)
  }

  // Step 3: Handle Logout / Switch Account
  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setAuthToken(null)
    setAuthUser(null)
    setIsSocketConnected(false)
    setShowNotices(false)
    setLastEtaChangeNotice(null)
    setAuthStatus('ROLE_SELECTION')
  }

  // Handle Confirmed Booking in Farmer Flow
  const handleBookingConfirmed = (booking: any) => {
    const arrivalWindow =
      booking.arrivalStart && booking.arrivalEnd
        ? `${booking.arrivalStart} – ${booking.arrivalEnd}`
        : booking.arrivalWindow || '10:40 – 11:00 AM'

    const queueAhead = booking.queueAhead ?? (booking.queuePosition ? booking.queuePosition - 1 : 0)

    setState((prev) => ({
      ...prev,
      bookingId: booking.id,
      token: booking.tokenNumber,
      ahead: queueAhead,
      slot: arrivalWindow,
      etaMinutes: booking.etaMinutes ?? 20,
      centre: booking.centre?.name || prev.centre,
      centreId: booking.centreId,
      slotId: booking.slotId,
      booked: true,
      missed: false,
      stage: 'Queue processing',
      bookings: prev.bookings + 1,
      notices: [
        {
          id: Date.now(),
          text: `Booking confirmed with token ${booking.tokenNumber}. Arrival window: ${arrivalWindow}.`,
          audience: 'farmer' as const,
          time: 'Just now',
        },
        ...prev.notices,
      ].slice(0, 10),
    }))

    if (socketRef.current && booking.centreId) {
      socketRef.current.emit('join:centre', { centreId: booking.centreId })
    }

    setPage('Dashboard')
  }

  const handleRecoverMissedSlot = () => {
    const recovery = handleMissedSlot(calculateCentreLoad({
      queue: state.ahead + 14,
      capacity: state.capacity,
      processingMinutes: state.processingMinutes,
      delayMinutes: state.delayMinutes,
      bookings: state.bookings,
      counters: 4,
    }))

    setState((prev) => ({
      ...prev,
      missed: false,
      booked: true,
      slot: recovery.slot,
      bookings: prev.bookings + 1,
      notices: [
        {
          id: Date.now(),
          text: `Recovery slot confirmed for ${recovery.slot} at ${recovery.centre}.`,
          audience: 'farmer' as const,
          time: 'Just now',
        },
        ...prev.notices,
      ].slice(0, 10),
    }))
  }

  // SCREEN 1: ROLE SELECTION ("Who are you?")
  if (authStatus === 'ROLE_SELECTION') {
    return <RoleSelectionScreen onSelectRole={handleSelectRole} />
  }

  // SCREEN 2: ROLE-SPECIFIC LOGIN (with authoritative backend RBAC verification)
  if (authStatus === 'LOGIN') {
    return (
      <RoleLoginScreen
        selectedRole={selectedRoleContext}
        onBackToRoles={() => setAuthStatus('ROLE_SELECTION')}
        onLoginSuccess={handleLoginSuccess}
      />
    )
  }

  // SCREEN 3: AUTHENTICATED APPLICATION SHELL
  const title = page

  // Filter notices for current role
  const relevantNotices = state.notices.filter(
    (n) => n.audience === 'all' || n.audience === activeRole
  )

  const renderMainContent = () => {
    if (showNotices || page === 'Notifications') {
      return (
        <div className="notification-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">SYSTEM NOTIFICATIONS</div>
              <h2>Real-time Activity Stream</h2>
            </div>
            <button className="icon-button" onClick={() => { setShowNotices(false); setPage('Dashboard'); }}>
              <X size={17} />
            </button>
          </div>
          {relevantNotices.map((n) => (
            <div className="notification-item" key={n.id}>
              <Check size={16} />
              <div>
                <b>{n.text}</b>
                <span>{n.time} · Kisan-Mitra live queue engine</span>
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (activeRole === 'farmer') {
      if (page === 'Book a slot') {
        return (
          <BookingFlow
            farmerToken={authToken}
            onBack={() => setPage('Dashboard')}
            onBookingSuccess={handleBookingConfirmed}
          />
        )
      }

      return (
        <FarmerDashboard
          farmerName={authUser?.name || 'Ramesh Jadhav'}
          farmerPhone={authUser?.phone || '9876543210'}
          state={state}
          onBookSlot={() => setPage('Book a slot')}
          onDelayToggle={() => setState((prev) => ({ ...prev, delayMinutes: prev.delayMinutes ? 0 : 15 }))}
          onRecoverSlot={handleRecoverMissedSlot}
          lastEtaChangeNotice={lastEtaChangeNotice}
        />
      )
    }

    if (activeRole === 'officer') {
      return (
        <OfficerDashboard
          officerUser={authUser}
          officerToken={authToken}
          state={state}
          onUpdateState={setState}
          onConditionUpdated={() => {
            setLastEtaChangeNotice('Officer updated centre processing parameters. Recalculated ETAs across the queue.')
          }}
        />
      )
    }

    // Administrator
    return (
      <AdminDashboard
        adminUser={authUser}
        adminToken={authToken}
        isSocketConnected={isSocketConnected}
      />
    )
  }

  return (
    <div className="app-shell">
      {/* Primary Navigation Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sprout size={18} /></div>
          <div>
            <b>Kisan-Mitra</b>
            <span>Intelligent Queue</span>
          </div>
        </div>

        {/* Authenticated User & Role Indicator Badge */}
        <div className="sidebar-user-section">
          <span className={`sidebar-user-role-badge ${activeRole}`}>
            {activeRole === 'farmer' ? 'FARMER' : activeRole === 'officer' ? 'PROCUREMENT OFFICER' : 'ADMINISTRATOR'}
          </span>
          <b className="sidebar-user-name">{authUser?.name || 'Authenticated User'}</b>
          <span className="sidebar-user-detail">
            {activeRole === 'officer'
              ? 'Nashik Procurement Centre'
              : authUser?.phone || 'Verified Account'}
          </span>

          {/* Secure Logout / Switch Account Button */}
          <button
            type="button"
            id="sidebar-logout-btn"
            className="sidebar-logout-btn"
            onClick={handleLogout}
          >
            <LogOut size={12} /> Switch Account / Log Out
          </button>
        </div>

        <nav>
          {navItems[activeRole].map((label) => (
            <button
              key={label}
              className={title === label ? 'active' : ''}
              onClick={() => {
                setPage(label)
                setShowNotices(label === 'Notifications')
              }}
            >
              {label === 'Dashboard' || label === 'Control Room' || label === 'Network Overview' ? (
                <LayoutDashboard size={17} />
              ) : label.toLowerCase().includes('queue') ? (
                <Users size={17} />
              ) : label.toLowerCase().includes('status') || label.toLowerCase().includes('fleet') ? (
                <Activity size={17} />
              ) : label.toLowerCase().includes('condition') || label.toLowerCase().includes('inspector') || label.toLowerCase().includes('engine') ? (
                <Gauge size={17} />
              ) : label === 'Notifications' ? (
                <Bell size={17} />
              ) : (
                <UserRound size={17} />
              )}
              {label}
              {label === 'Notifications' && <i className="nav-badge">{relevantNotices.length}</i>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button onClick={() => { setPage('Dashboard'); setShowNotices(false); }}>
            <RefreshCw size={17} />
            <span>Sync Queue State</span>
          </button>
          <div className="version">SIH26032 · Nexora</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Kisan-Mitra</span>
            <b>/ {title}</b>
          </div>

          <div className="top-actions">
            <div className="location">
              <MapPin size={14} /> {state.centre}
              {isSocketConnected ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px', fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} /> Socket.IO Live
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px', fontSize: '11px', color: '#d97706', fontWeight: 600 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} /> Connecting
                </span>
              )}
            </div>

            <button
              className="notification-button"
              onClick={() => setShowNotices(!showNotices)}
              aria-label="Open notifications"
            >
              <Bell size={18} />
              {relevantNotices.length > 0 && <i />}
            </button>

            <button className="user-menu" onClick={handleLogout} title="Click to log out / switch role">
              <span className="avatar">
                {authUser?.name ? authUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'KM'}
              </span>
              <span>
                <b>{authUser?.name || 'User'}</b>
                <small>{activeRole === 'farmer' ? 'Farmer' : activeRole === 'officer' ? 'Centre Officer' : 'Administrator'}</small>
              </span>
            </button>
          </div>
        </header>

        <div className="page-content">{renderMainContent()}</div>
      </main>
    </div>
  )
}
