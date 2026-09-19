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
  Home,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(true)
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

  const handleHomeNavigation = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setAuthToken(null)
    setAuthUser(null)
    setAuthStatus('ROLE_SELECTION')
    setPage('Dashboard')
    setShowNotices(false)
    setMobileMenuOpen(true)
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

  const handleCancelBooking = async () => {
    if (state.bookingId) {
      try {
        await fetch(`/api/bookings/${state.bookingId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ status: 'CANCELLED' }),
        })
      } catch (err) {
        console.warn('Failed to send cancel request to server:', err)
      }
    }

    setState((prev) => ({
      ...prev,
      booked: false,
      token: '',
      slot: '',
      etaMinutes: 0,
      ahead: 0,
      bookingId: undefined,
      notices: [
        {
          id: Date.now(),
          text:
            currentLanguage === 'mr'
              ? 'स्लॉट बुकिंग यशस्वीरीत्या रद्द केले गेले.'
              : currentLanguage === 'hi'
              ? 'स्लॉट बुकिंग सफलतापूर्वक रद्द कर दी गई।'
              : 'Slot booking has been successfully cancelled.',
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
  <div className="eyebrow">{t.shell.systemNotices}</div>
  <h2>{t.shell.notificationsTitle}</h2>
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

    if (page === 'Profile') {
      return (
        <section className="panel" aria-labelledby="profile-heading">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">ACCOUNT</div>
              <h2 id="profile-heading">Profile</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '12px', marginTop: '18px', maxWidth: '520px' }}>
            <div><small>Name</small><strong style={{ display: 'block', color: '#12304a' }}>{authUser?.name || 'Authenticated User'}</strong></div>
            <div><small>Mobile</small><strong style={{ display: 'block', color: '#12304a' }}>{authUser?.phone || 'Not available'}</strong></div>
            <div><small>Role</small><strong style={{ display: 'block', color: '#12304a' }}>{activeRole === 'farmer' ? 'Farmer' : activeRole === 'officer' ? 'Procurement Officer' : 'Administrator'}</strong></div>
          </div>
        </section>
      )
    }

    if (activeRole === 'farmer') {
      if (page === 'Book a slot') {
        return (
          <BookingFlow
            farmerToken={authToken}
            onBack={() => setPage('Dashboard')}
            onBookingSuccess={handleBookingConfirmed}
            language={currentLanguage}
            onLanguageChange={setCurrentLanguage}
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
          onCancelBooking={handleCancelBooking}
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
            setLastEtaChangeNotice(
              currentLanguage === 'mr'
                ? 'अधिकाऱ्यांनी केंद्राचे मापदंड अद्ययावत केले. रांगेतील सर्व आगमन वेळांची फेरगणना झाली.'
                : currentLanguage === 'hi'
                ? 'अधिकारी ने केंद्र के पैरामीटर अपडेट किए। कतार में आगमन समय की पुनर्गणना हुई।'
                : 'Officer updated centre processing parameters. Recalculated ETAs across the queue.'
            )
          }}
          language={currentLanguage}
          onLanguageChange={setCurrentLanguage}
        />
      )
    }

    // Administrator
    return (
      <AdminDashboard
        adminUser={authUser}
        adminToken={authToken}
        isSocketConnected={socketStatus === 'Live'}
        language={currentLanguage}
        onLanguageChange={setCurrentLanguage}
      />
    )
  }

  // Helper for Socket.IO Status Badge
  const getSocketBadge = () => {
    const statusLabels = {
      Live: t.shell.live,
      'Reconnecting…': t.shell.reconnecting,
      'Connecting…': t.shell.connecting,
      Offline: t.shell.offline,
    }
    const label = statusLabels[socketStatus] || t.shell.offline
    const statusClass = socketStatus === 'Live' ? 'live' : socketStatus === 'Offline' ? 'offline' : socketStatus === 'Connecting…' ? 'connecting' : 'reconnecting'

    return (
      <span className={`socket-badge ${statusClass}`}>
        <span className={`socket-indicator-dot ${statusClass}`} /> {label}
      </span>
    )
  }

  return (
    <div className="app-shell">
      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
  <div
  className="mobile-backdrop"
  aria-hidden="true"
  />
      )}

      {/* Primary Navigation Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open mobile-open' : 'sidebar-closed'}`}>
        <div className="brand">
          <div className="brand-mark"><Sprout size={18} /></div>
          <div>
            <b>Kisan-Mitra</b>
            <span>{t.shell.portalTitle}</span>
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
            {activeRole === 'farmer'
              ? (currentLanguage === 'mr' ? 'शेतकरी' : currentLanguage === 'hi' ? 'किसान' : 'FARMER')
              : activeRole === 'officer'
              ? (currentLanguage === 'mr' ? 'खरेदी अधिकारी' : currentLanguage === 'hi' ? 'खरीद अधिकारी' : 'PROCUREMENT OFFICER')
              : (currentLanguage === 'mr' ? 'प्रशासक' : currentLanguage === 'hi' ? 'प्रशासक' : 'ADMINISTRATOR')}
          </span>
          <b className="sidebar-user-name">{authUser?.name || 'Authenticated User'}</b>
          <span className="sidebar-user-detail">
            {activeRole === 'officer'
              ? (currentLanguage === 'mr' ? 'नाशिक खरेदी केंद्र' : currentLanguage === 'hi' ? 'नासिक खरीद केंद्र' : 'Nashik Procurement Centre')
              : maskPhoneNumber(authUser?.phone || '9876543210')}
          </span>

        </div>

        <nav>
          {navItems[activeRole].map((label) => {
            let translatedLabel = label
            if (activeRole === 'farmer') {
              if (label === 'Dashboard') translatedLabel = t.nav.farmer.dashboard
              else if (label === 'Book a slot') translatedLabel = t.nav.farmer.bookSlot
              else if (label === 'My token & queue') translatedLabel = t.nav.farmer.myToken
              else if (label === 'Procurement status') translatedLabel = t.nav.farmer.procStatus
              else if (label === 'Notifications') translatedLabel = t.nav.farmer.notifications
              else if (label === 'Profile') translatedLabel = t.nav.farmer.profile
            } else if (activeRole === 'officer') {
              if (label === 'Control Room') translatedLabel = t.nav.officer.controlRoom
              else if (label === 'Live Queue') translatedLabel = t.nav.officer.liveQueue
              else if (label === 'Centre Conditions') translatedLabel = t.nav.officer.centreConditions
              else if (label === 'Smart Queue Engine') translatedLabel = t.nav.officer.smartQueueEngine
              else if (label === 'Notifications') translatedLabel = t.nav.officer.notifications
              else if (label === 'Profile') translatedLabel = t.nav.officer.profile
            } else {
              if (label === 'Network Overview') translatedLabel = t.nav.admin.networkOverview
              else if (label === 'Centre Load & Fleet') translatedLabel = t.nav.admin.centreLoadFleet
              else if (label === 'Centre Inspector') translatedLabel = t.nav.admin.centreInspector
              else if (label === 'System Health') translatedLabel = t.nav.admin.systemHealth
              else if (label === 'Notifications') translatedLabel = t.nav.admin.notifications
              else if (label === 'Profile') translatedLabel = t.nav.admin.profile
            }

            return (
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
                {translatedLabel}
                {label === 'Notifications' && <i className="nav-badge">{relevantNotices.length}</i>}
              </button>
            )
          })}
          </nav>

          <button type="button" className="sidebar-logout" onClick={handlePromptLogout}>
            <LogOut size={17} />
            <span>{t.shell.logoutBtn}</span>
          </button>

          <div className="sidebar-bottom">
          <button onClick={() => { setPage('Dashboard'); setShowNotices(false); }}>
            <RefreshCw size={17} />
            <span>{currentLanguage === 'mr' ? 'रांग समक्रमित करा' : currentLanguage === 'hi' ? 'कतार सिंक करें' : 'Sync Queue State'}</span>
          </button>
          <div className="version">Kisan-Mitra Portal v2.1</div>
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

            <button
              type="button"
              className="notification-button"
  onClick={handleHomeNavigation}
  aria-label="Home"
              title="Home"
            >
              <Home size={18} />
            </button>

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
              title="Log out"
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
                <h3 id="logout-dialog-title">{t.logout.confirmTitle}</h3>
                <p>{t.logout.confirmMessage}</p>
              </div>
            </div>
            <p className="modal-body-text">
              {currentLanguage === 'mr'
                ? 'तुमचे सक्रिय सत्र आणि थेट रांग सूचना समाप्त होतील. तुम्हाला भूमिका निवड पोर्टलवर पुनर्निर्देशित केले जाईल.'
                : currentLanguage === 'hi'
                ? 'आपका सक्रिय सत्र और लाइव कतार सूचनाएं समाप्त हो जाएंगी। आपको भूमिका चयन पोर्टल पर पुनर्निर्देशित किया जाएगा।'
                : 'Your active session and realtime queue notifications will be ended. You will be redirected to the role selection portal.'}
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="button outline"
                onClick={() => setShowLogoutModal(false)}
              >
                {t.logout.cancelBtn}
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleConfirmLogout}
                id="confirm-logout-btn"
              >
                {t.logout.logoutBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
