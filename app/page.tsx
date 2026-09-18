'use client'

import React, { useEffect, useState, useRef } from 'react'
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
  Globe,
  Menu,
} from 'lucide-react'
import RoleSelectionScreen, { SelectedRole } from '@/components/role-selection/RoleSelectionScreen'
import RoleLoginScreen from '@/components/auth/RoleLoginScreen'
import FarmerDashboard from '@/components/farmer/FarmerDashboard'
import OfficerDashboard from '@/components/officer/OfficerDashboard'
import AdminDashboard from '@/components/admin/AdminDashboard'
import BookingFlow from '@/components/booking/BookingFlow'
import { calculateCentreLoad, handleMissedSlot } from '@/lib/smartQueueEngine'
import { Language, maskPhoneNumber, translations } from '@/lib/i18n'

export type AuthStatus = 'ROLE_SELECTION' | 'LOGIN' | 'AUTHENTICATED'
export type Role = 'farmer' | 'officer' | 'admin'
export type Stage = 'Queue processing' | 'Produce verification' | 'Procurement completed'
export type Notice = { id: number; text: string; audience: Role | 'all'; time: string }
export type SocketStatus = 'Live' | 'Connecting…' | 'Reconnecting…' | 'Offline'

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
  bookingLoading?: boolean
}

const NASHIK_CENTRE_ID = 'cmu5e1cag0000s6k48rlx1elq'

const initialDemoState: DemoState = {
  token: '',
  ahead: 0,
  currentToken: 'K-101',
  processingMinutes: 5.25,
  capacity: 60,
  delayMinutes: 0,
  stage: 'Queue processing',
  payment: 'Pending',
  centre: 'Nashik Procurement Centre',
  centreId: NASHIK_CENTRE_ID,
  slot: '',
  booked: false,
  bookings: 0,
  processingCount: 0,
  missed: false,
  etaMinutes: 0,
  notices: [],
  bookingLoading: false,
}

const navItems: Record<Role, string[]> = {
  farmer: ['Dashboard', 'Book a slot', 'My token & queue', 'Procurement status', 'Notifications', 'Profile'],
  officer: ['Control Room', 'Live Queue', 'Centre Conditions', 'Smart Queue Engine', 'Notifications', 'Profile'],
  admin: ['Network Overview', 'Centre Load & Fleet', 'Centre Inspector', 'System Health', 'Notifications', 'Profile'],
}

export default function Page() {
  // Localization state
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en')

  // Authentication & Navigation Flow States
  const [authStatus, setAuthStatus] = useState<AuthStatus>('ROLE_SELECTION')
  const [selectedRoleContext, setSelectedRoleContext] = useState<SelectedRole>('farmer')
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<any | null>(null)

  // In-App Navigation State
  const [page, setPage] = useState<string>('Dashboard')
  const [showNotices, setShowNotices] = useState<boolean>(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false)

  // Real-time Queue State
  const [state, setState] = useState<DemoState>(initialDemoState)
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('Connecting…')
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
      }
      setSocketStatus('Offline')
      return
    }

    let active = true
    setSocketStatus('Connecting…')

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
      setSocketStatus('Live')

      // Join assigned centre room based on authenticated role and assignment
      const targetCentreId =
        activeRole === 'officer'
          ? authUser?.assignedCentreId || state.centreId || NASHIK_CENTRE_ID
          : state.centreId || NASHIK_CENTRE_ID

      if (targetCentreId) {
        socket.emit('join:centre', { centreId: targetCentreId })
      }
    })

    socket.on('reconnect_attempt', () => {
      if (!active) return
      setSocketStatus('Reconnecting…')
    })

    socket.on('disconnect', () => {
      if (!active) return
      setSocketStatus('Offline')
    })

    socket.on('connect_error', () => {
      if (!active) return
      setSocketStatus('Offline')
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
      setSocketStatus('Offline')
    }
  }, [authStatus, authToken, activeRole, authUser, state.centreId])

  // Step 1b: When a Farmer is Authenticated, load their authoritative booking state from backend
  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED' || activeRole !== 'farmer' || !authUser?.id || !authToken) {
      return
    }

    let isMounted = true
    setState((prev) => ({ ...prev, bookingLoading: true }))

    fetch(`/api/farmers/${authUser.id}/bookings`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to fetch farmer bookings'))))
      .then(async (data) => {
        if (!isMounted) return
        const bookings = data.bookings || []
        const active = bookings.find(
          (b: any) => b.status === 'CONFIRMED' || b.status === 'PROCESSING' || b.status === 'PENDING'
        )

        if (!active) {
          setState((prev) => ({
            ...prev,
            booked: false,
            token: '',
            bookingId: undefined,
            bookingLoading: false,
          }))
          return
        }

        // Active booking detected: fetch dynamic queue ETA
        let etaMinutes = 20
        let farmersAhead = 0
        let arrivalWindow = `${active.arrivalStart} – ${active.arrivalEnd}`

        try {
          const etaRes = await fetch(`/api/queue/${active.centreId}/eta?bookingId=${active.id}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          })
          if (etaRes.ok) {
            const etaData = await etaRes.json()
            etaMinutes = etaData.etaMinutes ?? 20
            farmersAhead = etaData.farmersAhead ?? 0
            if (etaData.liveArrivalWindow) {
              arrivalWindow = etaData.liveArrivalWindow
            }
          }
        } catch (err) {
          console.error('Failed to load queue ETA for active booking:', err)
        }

        if (!isMounted) return
        setState((prev) => ({
          ...prev,
          booked: true,
          bookingId: active.id,
          token: active.tokenNumber,
          ahead: farmersAhead,
          slot: arrivalWindow,
          etaMinutes,
          centre: active.centre?.name || prev.centre,
          centreId: active.centreId,
          slotId: active.slotId,
          stage:
            active.status === 'PROCESSING'
              ? 'Produce verification'
              : active.status === 'COMPLETED'
              ? 'Procurement completed'
              : 'Queue processing',
          bookingLoading: false,
        }))

        // Join the socket room for this centre
        if (socketRef.current && active.centreId) {
          socketRef.current.emit('join:centre', { centreId: active.centreId })
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('Error fetching farmer booking:', err)
        setState((prev) => ({ ...prev, bookingLoading: false, booked: false }))
      })

    return () => {
      isMounted = false
    }
  }, [authStatus, activeRole, authUser?.id, authToken])

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

  // Step 3: Trigger Logout Confirmation
  const handlePromptLogout = () => {
    setShowLogoutModal(true)
  }

  // Step 4: Execute Complete Secure Invalidation & Reset
  const handleConfirmLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setAuthToken(null)
    setAuthUser(null)
    setSocketStatus('Offline')
    setShowNotices(false)
    setLastEtaChangeNotice(null)
    setState(initialDemoState)
    setShowLogoutModal(false)

    // Clear client-side stored session tokens and profiles
    try {
      localStorage.removeItem('km_token')
      localStorage.removeItem('km_user')
      localStorage.removeItem('km_auth_token')
      localStorage.removeItem('km_user_role')
      localStorage.removeItem('km_user_profile')
      sessionStorage.clear()
    } catch {
      // safe fallback
    }

    // Replace browser history state to prevent back-button re-entry into protected dashboard
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/')
    }

    setAuthStatus('ROLE_SELECTION')
  }

  // Prevent back-button re-entry to protected routes when logged out
  useEffect(() => {
    const handlePopState = () => {
      if (!authToken) {
        setAuthStatus('ROLE_SELECTION')
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [authToken])

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
    return (
      <RoleSelectionScreen
        onSelectRole={handleSelectRole}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
      />
    )
  }

  // SCREEN 2: ROLE-SPECIFIC LOGIN (with authoritative backend RBAC verification)
  if (authStatus === 'LOGIN') {
    return (
      <RoleLoginScreen
        selectedRole={selectedRoleContext}
        onBackToRoles={() => setAuthStatus('ROLE_SELECTION')}
        onLoginSuccess={handleLoginSuccess}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
      />
    )
  }

  // SCREEN 3: AUTHENTICATED APPLICATION SHELL
  const title = page
  const t = translations[currentLanguage]

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
          language={currentLanguage}
          onLanguageChange={setCurrentLanguage}
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
        isSocketConnected={socketStatus === 'Live'}
      />
    )
  }

  // Helper for Socket.IO Status Badge
  const getSocketBadge = () => {
    switch (socketStatus) {
      case 'Live':
        return (
          <span className="socket-badge live">
            <span className="socket-indicator-dot live" /> Live
          </span>
        )
      case 'Reconnecting…':
        return (
          <span className="socket-badge reconnecting">
            <span className="socket-indicator-dot reconnecting" /> Reconnecting…
          </span>
        )
      case 'Connecting…':
        return (
          <span className="socket-badge connecting">
            <span className="socket-indicator-dot connecting" /> Connecting…
          </span>
        )
      case 'Offline':
      default:
        return (
          <span className="socket-badge offline">
            <span className="socket-indicator-dot offline" /> Offline
          </span>
        )
    }
  }

  return (
    <div className="app-shell">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Primary Navigation Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Sprout size={18} /></div>
          <div>
            <b>Kisan-Mitra</b>
            <span>Intelligent Queue</span>
          </div>
          <button
            type="button"
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
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
              : maskPhoneNumber(authUser?.phone || '9876543210')}
          </span>

          {/* Secure Logout / Switch Account Button */}
          <button
            type="button"
            id="sidebar-logout-btn"
            className="sidebar-logout-btn"
            onClick={handlePromptLogout}
          >
            <LogOut size={12} /> Log out / Change account
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
                setMobileMenuOpen(false)
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb">
              <span>Kisan-Mitra</span>
              <b>/ {title}</b>
            </div>
          </div>

          <div className="top-actions">
            <div className="location">
              <MapPin size={14} /> {state.centre}
              {getSocketBadge()}
            </div>

            {/* Language Selector in Topbar */}
            <label className="language-select-label-mini" aria-label="Language selector">
              <Globe size={13} />
              <select
                value={currentLanguage}
                onChange={(e) => setCurrentLanguage(e.target.value as Language)}
                className="lang-dropdown-mini"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी</option>
                <option value="mr">मराठी</option>
              </select>
            </label>

            <button
              className="notification-button"
              onClick={() => setShowNotices(!showNotices)}
              aria-label="Open notifications"
            >
              <Bell size={18} />
              {relevantNotices.length > 0 && <i />}
            </button>

            <button
              className="user-menu"
              onClick={handlePromptLogout}
              title="Click to log out / change account"
            >
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

        {/* Offline / Reconnecting Visual Banner */}
        {socketStatus !== 'Live' && (
          <div
            className={`connection-banner ${socketStatus === 'Reconnecting…' ? 'reconnecting' : 'offline'}`}
            style={{
              background: socketStatus === 'Reconnecting…' ? '#fffbeb' : '#fef2f2',
              color: socketStatus === 'Reconnecting…' ? '#92400e' : '#991b1b',
              borderBottom: '1px solid',
              borderColor: socketStatus === 'Reconnecting…' ? '#fde68a' : '#fecaca',
              padding: '10px 20px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 500,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`socket-indicator-dot ${socketStatus === 'Reconnecting…' ? 'reconnecting' : 'offline'}`} />
              {socketStatus === 'Reconnecting…'
                ? 'Reconnecting to live queue feed… Updates may be delayed.'
                : 'Real-time connection offline. Displaying cached authoritative queue data.'}
            </span>
            {socketStatus === 'Offline' && (
              <button
                className="button secondary small"
                onClick={() => {
                  if (socketRef.current) {
                    socketRef.current.connect()
                  }
                }}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Retry connection
              </button>
            )}
          </div>
        )}

        <div className="page-content">{renderMainContent()}</div>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-icon-wrap warning">
                <LogOut size={20} />
              </div>
              <div>
                <h3 id="logout-dialog-title">Confirm Logout</h3>
                <p>Are you sure you want to log out?</p>
              </div>
            </div>
            <p className="modal-body-text">
              Your active session and realtime queue notifications will be ended. You will be redirected to the role selection portal.
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="button outline"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleConfirmLogout}
                id="confirm-logout-btn"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
