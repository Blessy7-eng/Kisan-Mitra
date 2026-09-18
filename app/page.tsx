'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Activity, AlertTriangle, ArrowRight, Bell, Check, Clock3, Gauge, LayoutDashboard, MapPin, RefreshCw, ShieldCheck, Sprout, TrendingUp, UserRound, Users, X, Zap } from 'lucide-react'
import { allocateBestSlot, calculateArrivalWindow, calculateCentreLoad, calculateETA, getAlternativeCentre, getCentreStatus, handleMissedSlot } from '@/lib/smartQueueEngine'

type Role = 'farmer' | 'officer' | 'admin'
type Stage = 'Queue processing' | 'Produce verification' | 'Procurement completed'
type Notice = { id: number; text: string; audience: Role | 'all'; time: string }
type DemoState = {
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

const initial: DemoState = {
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
  notices: [{ id: 1, text: 'Your slot has been confirmed.', audience: 'farmer', time: 'Just now' }]
}

const nav: Record<Role, string[]> = {
  farmer: ['Dashboard', 'Book a slot', 'My token / queue', 'Procurement status', 'Notifications', 'Profile'],
  officer: ['Operations overview', 'Live queue', 'Centre conditions', 'Procurement status', 'Notifications', 'Profile'],
  admin: ['Network overview', 'Centre load', 'Recommendations', 'Analytics', 'Notifications', 'Profile']
}

const centreModel = (state: DemoState) => ({
  queue: (Number(state.ahead) || 0) + 14,
  capacity: Number(state.capacity) || 61,
  processingMinutes: Number(state.processingMinutes) || 5.25,
  delayMinutes: Number(state.delayMinutes) || 0,
  bookings: Number(state.bookings) || 84,
  counters: 4
})

const addNotice = (state: DemoState, text: string, audience: Role | 'all' = 'all'): DemoState => ({
  ...state,
  notices: [{ id: Date.now(), text, audience, time: 'Just now' }, ...state.notices].slice(0, 8)
})

function Metric({ label, value, detail, icon: Icon, tone = '' }: any) {
  return (
    <div className="metric-card">
      <div className="metric-top"><span>{label}</span><Icon size={17} /></div>
      <strong className={tone}>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function Pill({ children, tone = 'neutral' }: any) {
  return <span className={`status-pill ${tone}`}>{children}</span>
}

function QueueRail({ state, eta }: { state: DemoState; eta: number }) {
  const progress = Math.min(88, 44 + state.ahead * 3)
  return (
    <div className="queue-rail-wrap">
      <div className="queue-rail-labels"><span>Completed</span><span>Processing</span><span>Your token</span></div>
      <div className="queue-rail">
        <div className="queue-done" style={{ width: `${progress}%` }} />
        <div className="queue-marker processing" style={{ left: `${progress}%` }} />
        <div className="queue-marker yours" style={{ left: `${Math.min(90, progress + 22)}%` }}>
          <span>{state.token}</span>
        </div>
      </div>
      <div className="queue-foot">
        <span>{state.currentToken} <Check size={13} /></span>
        <span className="processing-text">K-117 processing</span>
        <span className="your-text">{state.token} you · {eta} min</span>
      </div>
    </div>
  )
}

function EnginePanel({ state, onDelay }: { state: DemoState; onDelay: () => void }) {
  return (
    <section className="engine-panel">
      <div className="engine-copy">
        <div className="eyebrow teal"><Zap size={14} /> SMART QUEUE ENGINE</div>
        <h2>Queue-aware slot orchestration</h2>
        <p>Rule-based queue intelligence recalculates ETA and arrival windows from live centre conditions.</p>
        <button className="button dark" onClick={onDelay}>
          <RefreshCw size={15} /> {state.delayMinutes ? 'Clear centre delay' : 'Simulate centre delay'}
        </button>
      </div>
      <div className="engine-diagram">
        <div className="engine-inputs">
          <span>Centre capacity</span><span>Current queue</span><span>Processing speed</span><span>Existing bookings</span><span>Expected arrivals</span><span>Live delays</span>
        </div>
        <div className="engine-core">
          <div className="core-ring"><Zap size={21} /></div>
          <b>SMART<br />QUEUE<br />ENGINE</b>
        </div>
        <div className="engine-outputs">
          <span>Best available slot</span><span>Digital token</span><span>ETA + arrival window</span><span>Alternative centre</span>
        </div>
      </div>
    </section>
  )
}

function FarmerQuickActions({ onBook, state }: any) {
  const items = [
    ['Book My Slot', 'Find best arrival time', Clock3, onBook],
    ['My Token', `${state.token} · Confirmed`, ShieldCheck],
    ['My Queue', `${state.ahead} farmers ahead`, Users],
    ['My Centre', `${state.centre.split(' ')[0]} · 8.4 km`, MapPin],
    ['Procurement Status', state.stage, Activity],
    ['Payment Status', state.payment, TrendingUp]
  ]
  return (
    <section className="farmer-quick-actions">
      <div className="quick-actions-head">
        <div>
          <div className="eyebrow">WHAT DO YOU WANT TO DO?</div>
          <h2>Quick actions</h2>
        </div>
        <label className="language-select">
          Language
          <select defaultValue="English">
            <option>English</option>
            <option>हिन्दी</option>
            <option>मराठी</option>
          </select>
        </label>
      </div>
      <div className="quick-action-grid">
        {items.map(([label, detail, Icon, action]: any) => (
          <button key={label} className={`quick-action ${label === 'Book My Slot' ? 'primary' : ''}`} onClick={action}>
            <span className="quick-icon"><Icon size={20} /></span>
            <span><b>{label}</b><small>{detail}</small></span>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
    </section>
  )
}

function Timeline({ state }: { state: DemoState }) {
  const done = state.stage === 'Procurement completed'
  const verify = state.stage !== 'Queue processing'
  const steps = [
    ['Booking confirmed', '12 Sep · 08:42 AM', true],
    ['Farmer arrived', 'Centre check-in recorded', true],
    ['Queue processing', state.stage === 'Queue processing' ? 'Current stage' : 'Completed', true],
    ['Produce verification', verify ? 'Current stage' : 'Next step', verify],
    ['Procurement completed', done ? 'Completed' : 'Pending', done],
    ['Payment status', state.payment, state.payment === 'Completed']
  ] as const
  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <div><div className="eyebrow">PROCUREMENT STATUS</div><h2>Track your procurement journey</h2></div>
        <Pill tone={state.payment === 'Completed' ? 'success' : 'warning'}>{state.payment}</Pill>
      </div>
      <div className="timeline">
        {steps.map(([title, detail, complete], i) => (
          <div className={`timeline-item ${complete ? 'complete' : ''}`} key={title}>
            <div className="timeline-dot">{complete ? <Check size={13} /> : i === 3 ? <Activity size={13} /> : null}</div>
            <div><b>{title}</b><span>{detail}</span></div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Farmer({ state, onBook, onDelay, onRecover }: any) {
  const centre = centreModel(state)
  const eta = state.etaMinutes ?? calculateETA(state.ahead, centre)
  const window = state.slot
  const recovery = handleMissedSlot(calculateCentreLoad(centre))

  return (
    <>
      {state.missed && (
        <div className="inline-alert warning">
          <AlertTriangle size={17} />
          <div>
            <b>Missed your procurement slot?</b>
            <span>We found a recovery window at {recovery.centre} for {recovery.slot}. Estimated wait: {recovery.wait} minutes.</span>
          </div>
          <button className="button primary" onClick={onRecover}>Confirm recovery slot</button>
        </div>
      )}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">FARMER DASHBOARD <span className="live-dot" /> Live updates</div>
          <h1>Good morning, Ramesh.</h1>
          <p className="subtle">Procurement made predictable.</p>
        </div>
        <button className="button primary" onClick={onBook}>
          Book a procurement slot <ArrowRight size={16} />
        </button>
      </div>
      <FarmerQuickActions onBook={onBook} state={state} />
      <div className="metrics-grid farmer-metrics">
        <Metric label="Next appointment" value={`12 Sep · ${window.split(' – ')[0]}`} detail={`${state.centre} · ${state.token}`} icon={Clock3} />
        <Metric label="Queue position" value={`#${state.ahead + 1} in queue`} detail={`${state.ahead} farmers ahead`} tone="info" icon={Users} />
        <Metric label="Estimated wait" value={`${eta} min`} detail={state.delayMinutes ? 'Updated just now' : 'Based on live conditions'} tone={state.delayMinutes ? 'warning' : ''} icon={Gauge} />
        <Metric label="Procurement status" value={state.stage === 'Queue processing' ? 'Verification' : state.stage.replace('Procurement ', '')} detail="Vehicle / produce verification" tone="success" icon={ShieldCheck} />
      </div>
      <div className="content-grid farmer-main">
        <section className="panel queue-panel">
          <div className="panel-heading">
            <div><div className="eyebrow">LIVE QUEUE STATUS <span className="live-dot" /> Updating live</div><h2>Your queue at a glance</h2></div>
          </div>
          <QueueRail state={state} eta={eta} />
          <div className="eta-row">
            <div className="eta-card">
              <span>How long will I wait?</span>
              <strong>{eta} <small>min</small></strong>
              <span className={state.delayMinutes ? 'warning-text' : 'success-text'}>
                {state.delayMinutes ? 'Updated from live conditions' : 'On track for your window'}
              </span>
            </div>
            <div className="appointment-card">
              <span>Arrival window</span>
              <strong>{window}</strong>
              <span>Token <b>{state.token}</b> · 12 Sep 2026</span>
            </div>
          </div>
          {state.delayMinutes > 0 && (
            <div className="inline-alert warning">
              <AlertTriangle size={17} />
              <div>
                <b>Centre processing has slowed down.</b>
                <span>Your arrival window changed because processing speed and live delay changed. Current ETA: {eta} min.</span>
              </div>
            </div>
          )}
          {state.missed && (
            <div className="inline-alert info">
              <Clock3 size={17} />
              <div>
                <b>Your assigned slot has been missed.</b>
                <span>Next suitable slot found: {recovery.slot} at {recovery.centre} · estimated wait {recovery.wait} min.</span>
              </div>
              <button className="button outline small" onClick={() => onBook(recovery.slot)}>Accept new slot</button>
            </div>
          )}
        </section>
        <section className="panel engine-side">
          <div className="eyebrow teal">YOUR TOKEN</div>
          <h2>{state.token}</h2>
          <p>{state.centre}<br />{window}</p>
          <Pill tone={state.delayMinutes ? 'warning' : 'success'}>
            {state.delayMinutes ? 'Window updated' : 'Booking confirmed'}
          </Pill>
          <div className="input-list">
            <span><Check size={14} /> {state.ahead} farmers ahead</span>
            <span><Check size={14} /> ETA recalculates live</span>
            <span><Check size={14} /> Notifications enabled</span>
          </div>
        </section>
      </div>
      <EnginePanel state={state} onDelay={onDelay} />
      <Timeline state={state} />
    </>
  )
}

function Booking({
  onConfirm,
  authToken
}: {
  onConfirm: (booking: any, centreName: string) => void
  authToken: string | null
}) {
  const [step, setStep] = useState(1)
  const [produce, setProduce] = useState('Wheat')
  const [centres, setCentres] = useState<any[]>([])
  const [loadingCentres, setLoadingCentres] = useState(false)
  const [centresError, setCentresError] = useState<string | null>(null)
  const [selectedCentre, setSelectedCentre] = useState<any | null>(null)

  const [slots, setSlots] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null)

  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)

  // Fetch real centres from backend API
  useEffect(() => {
    let active = true
    async function loadCentres() {
      setLoadingCentres(true)
      setCentresError(null)
      try {
        const res = await fetch('/api/centres')
        const data = await res.json()
        if (active && res.ok && Array.isArray(data.centres)) {
          setCentres(data.centres)
          if (data.centres.length > 0) {
            setSelectedCentre(data.centres[0])
          }
        } else if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch procurement centres')
        }
      } catch (err: any) {
        if (active) setCentresError(err.message || 'Unable to connect to centres service')
      } finally {
        if (active) setLoadingCentres(false)
      }
    }
    loadCentres()
    return () => { active = false }
  }, [])

  // Fetch real slots for selected centre when moving to step 3 or centre change
  useEffect(() => {
    if (!selectedCentre?.id || step !== 3) return
    let active = true
    async function loadSlots() {
      setLoadingSlots(true)
      setSlotsError(null)
      try {
        const res = await fetch(`/api/centres/${selectedCentre.id}/slots`)
        const data = await res.json()
        if (active && res.ok && Array.isArray(data.slots)) {
          setSlots(data.slots)
          const firstOpen = data.slots.find((s: any) => !s.isFull && s.status === 'OPEN')
          if (firstOpen) {
            setSelectedSlot(firstOpen)
          } else if (data.slots.length > 0) {
            setSelectedSlot(data.slots[0])
          }
        } else if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch slots for centre')
        }
      } catch (err: any) {
        if (active) setSlotsError(err.message || 'Unable to load slots from database')
      } finally {
        if (active) setLoadingSlots(false)
      }
    }
    loadSlots()
    return () => { active = false }
  }, [selectedCentre?.id, step])

  const handleBookingSubmit = async () => {
    if (!selectedCentre?.id || !selectedSlot?.id) {
      setBookingError('Please select an available procurement slot')
      return
    }
    setBookingSubmitting(true)
    setBookingError(null)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          centreId: selectedCentre.id,
          slotId: selectedSlot.id
        })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create procurement booking')
      }
      onConfirm(data.booking, selectedCentre.name)
    } catch (err: any) {
      setBookingError(err.message || 'Booking submission failed')
    } finally {
      setBookingSubmitting(false)
    }
  }

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">SMART SLOT ALLOCATION</div>
          <h1>Book a procurement slot</h1>
          <p className="subtle">The engine finds the best arrival window for your produce.</p>
        </div>
      </div>
      <div className="steps">
        <span className={step >= 1 ? 'active' : ''}>1 <b>Centre</b></span>
        <i />
        <span className={step >= 2 ? 'active' : ''}>2 <b>Produce</b></span>
        <i />
        <span className={step >= 3 ? 'active' : ''}>3 <b>Recommended slot</b></span>
      </div>
      <section className="booking-layout">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">STEP {step} OF 3</div>
              <h2>
                {step === 1 ? 'Select procurement centre' : step === 2 ? 'What are you bringing?' : 'Smart slot recommendations'}
              </h2>
            </div>
          </div>

          {step === 1 && (
            <>
              {loadingCentres && <div className="p-4 text-center">Loading centres from Aiven MySQL...</div>}
              {centresError && <div className="inline-alert warning">{centresError}</div>}
              {!loadingCentres && centres.map((c) => {
                const isSelected = selectedCentre?.id === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`centre-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedCentre(c)
                      setStep(2)
                    }}
                  >
                    <div className={isSelected ? 'option-check' : 'option-check hollow'}>
                      {isSelected && <Check size={14} />}
                    </div>
                    <div className="option-body">
                      <div className="option-title">
                        <b>{c.name}</b>
                        <Pill tone={c.loadStatus === 'High Load' ? 'warning' : 'success'}>
                          {c.loadStatus || 'Normal load'}
                        </Pill>
                      </div>
                      <span>{c.location} · Processing rate: {c.processingRate} min/farmer</span>
                      <div className="option-stats">
                        <span>Load <b>{c.calculatedLoadPercent}%</b></span>
                        <span>Queue <b>{c.currentQueue} waiting</b></span>
                        <span>Capacity <b>{c.dailyCapacity}</b></span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {step === 2 && (
            <div className="booking-form">
              <label className="booking-field">
                Produce type
                <select value={produce} onChange={e => setProduce(e.target.value)}>
                  <option>Wheat</option>
                  <option>Onion</option>
                  <option>Soybean</option>
                </select>
              </label>
              <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>
                  Selected Centre: <b>{selectedCentre?.name}</b> ({selectedCentre?.location})
                </span>
              </div>
              <button className="button primary full" onClick={() => setStep(3)}>
                Continue to recommendations <ArrowRight size={15} />
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="booking-form">
              <div className="inline-alert info">
                <Zap size={17} />
                <div>
                  <b>Recommended by Smart Queue Engine</b>
                  <span>Live availability from {selectedCentre?.name} based on queue conditions and capacity.</span>
                </div>
              </div>

              {loadingSlots && <div className="p-4 text-center">Fetching live slot capacities...</div>}
              {slotsError && <div className="inline-alert warning">{slotsError}</div>}
              {bookingError && (
                <div className="inline-alert warning">
                  <AlertTriangle size={17} />
                  <div><b>Booking failed:</b> <span>{bookingError}</span></div>
                </div>
              )}

              {!loadingSlots && slots.length === 0 && !slotsError && (
                <div className="p-4 text-gray-500">No available slots for this centre.</div>
              )}

              {!loadingSlots && slots.map((s) => {
                const isSelected = selectedSlot?.id === s.id
                const isFull = s.isFull || s.status !== 'OPEN' || (s.availableCapacity !== undefined && s.availableCapacity <= 0)
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isFull}
                    className={`centre-option ${isSelected ? 'selected' : ''}`}
                    style={isFull ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    onClick={() => !isFull && setSelectedSlot(s)}
                  >
                    <div className={isSelected ? 'option-check' : 'option-check hollow'}>
                      {isSelected && <Check size={14} />}
                    </div>
                    <div className="option-body">
                      <div className="option-title">
                        <b>{s.startTime} – {s.endTime}</b>
                        <Pill tone={isFull ? 'danger' : isSelected ? 'success' : 'neutral'}>
                          {isFull ? 'Full' : `${s.availableCapacity ?? (s.capacity - s.bookedCount)} spots left`}
                        </Pill>
                      </div>
                      <span>Date: {new Date(s.date).toLocaleDateString()} · Centre: {selectedCentre?.name}</span>
                    </div>
                  </button>
                )
              })}

              <button
                className="button primary full"
                disabled={!selectedSlot || bookingSubmitting}
                onClick={handleBookingSubmit}
              >
                {bookingSubmitting ? 'Generating authoritative token...' : 'Generate digital token'} <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

        <section className="panel engine-side">
          <div className="eyebrow teal">SMART QUEUE ENGINE</div>
          <h3>Why this slot?</h3>
          <p>We use centre capacity, current queue, processing speed, existing bookings, expected arrivals and live delays to coordinate your visit.</p>
          <div className="input-list">
            <span><Check size={14} /> Connected to Aiven MySQL backend</span>
            <span><Check size={14} /> Real-time Smart Queue Engine</span>
            <span><Check size={14} /> Authoritative digital token</span>
          </div>
        </section>
      </section>
    </>
  )
}

function Officer({
  state,
  update,
  officerToken,
  officerUser
}: {
  state: DemoState
  update: (next: DemoState) => void
  officerToken: string | null
  officerUser: any
}) {
  const [centreData, setCentreData] = useState<any | null>(null)
  const [queueData, setQueueData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Use officer's assigned centre ID from backend authentication
  const assignedCentreId = officerUser?.assignedCentreId || state.centreId || NASHIK_CENTRE_ID

  const fetchCentreAndQueue = useCallback(async () => {
    if (!assignedCentreId) return
    try {
      const [cRes, qRes] = await Promise.all([
        fetch(`/api/centres/${assignedCentreId}`),
        fetch(`/api/queue/${assignedCentreId}`)
      ])
      if (cRes.ok) {
        const cJson = await cRes.json()
        setCentreData(cJson.centre)
      }
      if (qRes.ok) {
        const qJson = await qRes.json()
        setQueueData(qJson)
      }
    } catch (err) {
      console.warn('Could not refresh officer centre data:', err)
    }
  }, [assignedCentreId])

  useEffect(() => {
    fetchCentreAndQueue()
  }, [fetchCentreAndQueue])

  const eta = centreData?.processingRate
    ? Math.round(state.ahead * centreData.processingRate)
    : calculateETA(state.ahead, centreModel(state))

  const activeBookings = queueData?.queue || []

  const rows = activeBookings.length > 0
    ? activeBookings.map((b: any) => [
        b.tokenNumber,
        b.farmerName,
        b.slotTime,
        b.status === 'PROCESSING' ? 'Processing' : b.status === 'COMPLETED' ? 'Completed' : 'Waiting',
        `${b.etaMinutes} min`,
        b.id
      ])
    : [
        ['K-121', 'Farmer A', '10:20', 'Processing', '—', null],
        ['K-122', 'Farmer B', '10:30', 'Waiting', `${Math.max(0, eta - 15)} min`, null],
        ['K-123', 'Meena Shinde', '10:30', 'Waiting', `${Math.max(0, eta - 5)} min`, null],
        [state.token, 'Ramesh Jadhav', '10:40', state.stage === 'Procurement completed' ? 'Completed' : state.stage === 'Produce verification' ? 'Verification' : 'Waiting', `${eta} min`, state.bookingId || null]
      ]

  const changeSpeed = async (minutes: number) => {
    setActionError(null)
    update({
      ...state,
      processingMinutes: minutes,
      notices: [
        { id: Date.now(), text: `Processing speed updated to ${minutes} min. Smart Queue Engine broadcasting...`, audience: 'all', time: 'Just now' },
        ...state.notices
      ]
    })

    if (officerToken && assignedCentreId) {
      try {
        const res = await fetch(`/api/centres/${assignedCentreId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${officerToken}`
          },
          body: JSON.stringify({ processingRate: minutes })
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to update processing speed')
        }
        await fetchCentreAndQueue()
      } catch (err: any) {
        setActionError(err.message || 'API request failed')
      }
    }
  }

  const markDelay = async () => {
    setActionError(null)
    const isNowDelayed = !state.delayMinutes
    const newDelay = isNowDelayed ? 15 : 0
    const newStatus = isNowDelayed ? 'DELAYED' : 'ACTIVE'

    update(addNotice(
      { ...state, delayMinutes: newDelay },
      isNowDelayed
        ? `Delay marked at ${centreData?.name || state.centre}. Arrival windows recalculated.`
        : 'Centre delay cleared. Arrival windows recalculated.'
    ))

    if (officerToken && assignedCentreId) {
      try {
        const res = await fetch(`/api/centres/${assignedCentreId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${officerToken}`
          },
          body: JSON.stringify({ status: newStatus })
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to update centre status')
        }
        await fetchCentreAndQueue()
      } catch (err: any) {
        setActionError(err.message || 'API request failed')
      }
    }
  }

  // PATCH /api/bookings/:id with real booking ID
  const updateBookingStatus = async (bookingId: string, status: string, successNotice: string) => {
    setActionError(null)
    if (!officerToken) {
      setActionError('Officer authentication required')
      return
    }
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${officerToken}`
        },
        body: JSON.stringify({ status })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Failed to update booking status to ${status}`)
      }
      update(addNotice(state, successNotice, 'all'))
      await fetchCentreAndQueue()
    } catch (err: any) {
      setActionError(err.message || 'Booking update failed')
    }
  }

  // Call next farmer in queue
  const handleCallNextFarmer = async () => {
    const nextWaiting = activeBookings.find((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING')
    if (nextWaiting?.id) {
      await updateBookingStatus(nextWaiting.id, 'PROCESSING', `Next farmer called: ${nextWaiting.tokenNumber}. Queue updated.`)
    } else {
      update(addNotice({
        ...state,
        ahead: Math.max(0, state.ahead - 1),
        currentToken: state.token,
        processingCount: Math.min(4, state.processingCount + 1),
        stage: 'Queue processing'
      }, 'Next farmer called. Queue and ETAs recalculated.'))
    }
  }

  // Complete procurement
  const handleCompleteProcurement = async () => {
    const processing = activeBookings.find((b: any) => b.status === 'PROCESSING') || activeBookings[0]
    if (processing?.id) {
      await updateBookingStatus(processing.id, 'COMPLETED', `Procurement completed for ${processing.tokenNumber}.`)
    } else {
      update(addNotice({
        ...state,
        stage: 'Procurement completed',
        payment: 'Processing',
        processingCount: Math.max(0, state.processingCount - 1)
      }, 'Procurement completed. Payment status is processing.'))
    }
  }

  // Mark farmer missed
  const handleMarkMissed = async () => {
    const target = activeBookings.find((b: any) => b.tokenNumber === state.token || b.farmerName?.includes('Ramesh')) || activeBookings[0]
    if (target?.id) {
      await updateBookingStatus(target.id, 'MISSED', `Token ${target.tokenNumber} marked missed. Farmer recovery is available.`)
      update({ ...state, missed: true, booked: false })
    } else {
      update(addNotice({ ...state, missed: true, booked: false }, `Token ${state.token} marked missed. Farmer recovery is available.`, 'farmer'))
    }
  }

  return (
    <>
      {actionError && (
        <div className="inline-alert warning">
          <AlertTriangle size={17} />
          <div><b>Action Error:</b> <span>{actionError}</span></div>
        </div>
      )}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">CENTRE OPERATIONS <span className="live-dot" /> Live control room</div>
          <h1>Procurement Centre Operations</h1>
          <p className="subtle">
            <MapPin size={14} /> {centreData?.name || state.centre} · Assigned Centre ID: {assignedCentreId.slice(0, 12)}...
          </p>
        </div>
        <Pill tone={state.delayMinutes ? 'warning' : 'success'}>
          {state.delayMinutes ? 'Delayed (+15m)' : 'Centre online'}
        </Pill>
      </div>

      <div className="metrics-grid">
        <Metric
          label="Current queue"
          value={`${queueData?.totalWaiting ?? (state.ahead + 14)}`}
          detail="Farmers waiting"
          icon={Users}
        />
        <Metric
          label="Processing now"
          value={`${queueData?.activeProcessing ?? state.processingCount} / 4`}
          detail="Active counters"
          tone="success"
          icon={Activity}
        />
        <Metric
          label="Centre capacity"
          value={`${centreData?.calculatedLoadPercent ?? state.capacity}%`}
          detail="Available capacity"
          tone="warning"
          icon={Gauge}
        />
        <Metric
          label="Avg. processing"
          value={`${centreData?.processingRate ?? state.processingMinutes} min`}
          detail="Per farmer"
          icon={Clock3}
        />
      </div>

      <div className="officer-grid">
        <section className="panel queue-table-panel">
          <div className="panel-heading">
            <button className="button secondary" onClick={handleMarkMissed}>
              Mark Ramesh missed
            </button>
            <div>
              <div className="eyebrow">LIVE QUEUE</div>
              <h2>Queue management</h2>
            </div>
            <button className="button dark small" onClick={handleCallNextFarmer}>
              <ArrowRight size={14} /> Call next farmer
            </button>
          </div>
          <div className="data-table">
            <div className="table-head">
              <span>Token</span><span>Farmer</span><span>Slot</span><span>Status</span><span>ETA</span>
            </div>
            {rows.map((r: any) => (
              <div className="table-row" key={r[0]}>
                <b>{r[0]}</b><span>{r[1]}</span><span>{r[2]}</span>
                <Pill tone={r[3] === 'Processing' ? 'info' : r[3] === 'Completed' ? 'success' : 'neutral'}>
                  {r[3]}
                </Pill>
                <span>{r[4]}</span>
              </div>
            ))}
          </div>
          <div className="condition-actions">
            <button onClick={() => update(addNotice({ ...state, stage: 'Produce verification' }, `Produce verification started for ${state.token}.`))}>
              Start verification
            </button>
            <button onClick={handleCompleteProcurement}>
              Complete procurement
            </button>
          </div>
        </section>

        <section className="panel conditions">
          <div className="eyebrow">CENTRE CONDITIONS · SMART QUEUE ENGINE INPUTS</div>
          <h2>Live controls</h2>
          <div className="condition">
            <span>Processing speed</span>
            <b>{centreData?.processingRate ?? state.processingMinutes} min / farmer</b>
            <em><i style={{ width: `${Math.min(100, (centreData?.processingRate ?? state.processingMinutes) * 7)}%` }} /></em>
          </div>
          <div className="condition">
            <span>Current capacity load</span>
            <b>{centreData?.calculatedLoadPercent ?? state.capacity}%</b>
            <em><i style={{ width: `${centreData?.calculatedLoadPercent ?? state.capacity}%` }} /></em>
          </div>
          <div className="condition-actions">
            <button onClick={() => changeSpeed(8)}>Update processing speed to 8 min</button>
            <button onClick={() => changeSpeed(12)}>Update processing speed to 12 min</button>
            <button onClick={() => update(addNotice({ ...state, capacity: Math.max(40, state.capacity - 10) }, 'Centre capacity updated.'))}>
              Reduce capacity
            </button>
            <button onClick={markDelay}>
              {state.delayMinutes ? 'Clear delay' : 'Mark delay (+15m)'}
            </button>
          </div>
          {state.delayMinutes > 0 && (
            <div className="recalculating">
              <RefreshCw size={13} /> Smart Queue Engine recalculated farmer ETA and arrival window via Socket.IO.
            </div>
          )}
        </section>
      </div>
    </>
  )
}

function Admin({ state }: any) {
  const [centres, setCentres] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function fetchCentres() {
      setLoading(true)
      try {
        const res = await fetch('/api/centres')
        const data = await res.json()
        if (active && res.ok && Array.isArray(data.centres)) {
          setCentres(data.centres)
        }
      } catch (err: any) {
        if (active) setError(err.message)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchCentres()
    return () => { active = false }
  }, [])

  const load = calculateCentreLoad(centreModel(state))
  const status = getCentreStatus(load)
  const alternative = getAlternativeCentre(load)

  const activeCentresCount = centres.length > 0 ? centres.filter(c => c.status === 'ACTIVE').length : 18
  const totalBookingsToday = centres.length > 0
    ? centres.reduce((sum, c) => sum + (c._count?.bookings || 0), 0) + 1200
    : 1284 + state.bookings - 84
  const activeQueuesCount = centres.length > 0 ? centres.filter(c => c.currentQueue > 0).length : (load >= 85 ? 13 : 12)
  const nearCapacityCount = centres.length > 0 ? centres.filter(c => c.calculatedLoadPercent >= 80).length : (load >= 85 ? 5 : 4)

  const displayCentres = centres.length > 0
    ? centres.map(c => [
        c.name.replace(' Procurement Centre', ''),
        `${c.currentQueue} / ${c.dailyCapacity}`,
        `${c.calculatedLoadPercent}%`,
        `${c.processingRate} min`,
        c.loadStatus || 'Normal'
      ])
    : [
        ['Nashik', `${state.ahead + 14} / 40`, `${load}%`, `${state.processingMinutes} min`, status],
        ['Lasalgaon', '51 / 55', '93%', '11 min', 'High Load'],
        ['Yeola', '18 / 40', '45%', '7 min', 'Normal'],
        ['Sinnar', '34 / 42', '81%', '9 min', 'Watch']
      ]

  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">ADMINISTRATION <span className="live-dot" /> Network monitor</div>
          <h1>Procurement Network Overview</h1>
          <p className="subtle">Live database-backed monitoring across procurement centres.</p>
        </div>
      </div>
      <div className="metrics-grid">
        <Metric label="Active centres" value={`${activeCentresCount}`} detail="Live in network" tone="success" icon={ShieldCheck} />
        <Metric label="Farmers today" value={`${totalBookingsToday}`} detail="Bookings + arrivals" icon={Users} />
        <Metric label="Active queues" value={`${activeQueuesCount}`} detail="Centres processing" tone="info" icon={Activity} />
        <Metric label="Near capacity" value={`${nearCapacityCount}`} detail="Requires load balancing" tone="warning" icon={AlertTriangle} />
      </div>

      <section className="panel network-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">CENTRE LOAD OVERVIEW</div>
            <h2>Network health</h2>
          </div>
          <Pill tone={status === 'High Load' ? 'danger' : 'warning'}>{status}</Pill>
        </div>
        <div className="data-table network-table">
          <div className="table-head">
            <span>Centre</span><span>Queue</span><span>Load</span><span>Avg. processing</span><span>Status</span>
          </div>
          {displayCentres.map((r: any) => (
            <div className="table-row" key={r[0]}>
              <b>{r[0]}</b>
              <span>{r[1]}</span>
              <strong className={r[4] === 'High Load' ? 'warning-text' : ''}>{r[2]}</strong>
              <span>{r[3]}</span>
              <Pill tone={r[4] === 'High Load' ? 'danger' : r[4] === 'Watch' ? 'warning' : 'success'}>
                {r[4]}
              </Pill>
            </div>
          ))}
        </div>
      </section>

      <section className="panel recommendation-panel">
        <div className="eyebrow teal"><Zap size={14} /> LOAD BALANCING RECOMMENDATION</div>
        <h2>{load >= 85 ? 'Redirect new bookings to a lower-load centre' : 'Centres accepting new bookings'}</h2>
        <p>
          {load >= 85
            ? `Procurement network is experiencing high volume. Nearby alternative centres recommended.`
            : `${state.centre} is operating within normal parameters (${load}% load). ${alternative}.`}
        </p>
        <button className="button primary">View recommendation <ArrowRight size={15} /></button>
      </section>
    </>
  )
}

function Notifications({ state, onClose, role }: any) {
  const notices = state.notices.filter((n: Notice) => n.audience === 'all' || n.audience === role)
  return (
    <div className="notification-panel">
      <div className="panel-heading">
        <h2>Notifications</h2>
        <button className="icon-button" onClick={onClose}><X size={17} /></button>
      </div>
      {notices.map((n: Notice) => (
        <div className="notification-item" key={n.id}>
          <Check size={16} />
          <div>
            <b>{n.text}</b>
            <span>{n.time} · Kisan-Mitra live updates</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Page() {
  const [role, setRole] = useState<Role>('farmer')
  const [page, setPage] = useState('Dashboard')
  const [state, setState] = useState<DemoState>(initial)
  const [showNotices, setShowNotices] = useState(false)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<any | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Demo user credentials mapped to existing database seed
  const credentials: Record<Role, { phone: string; pass: string }> = {
    farmer: { phone: '9876543210', pass: 'farmer123' },
    officer: { phone: '9876543211', pass: 'officer123' },
    admin: { phone: '9876543212', pass: 'admin123' }
  }

  // Authenticate user and initialize Socket.IO connection
  useEffect(() => {
    let active = true

    async function loginAndConnect() {
      try {
        const creds = credentials[role]
        let token: string | null = null
        let user: any = null

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: creds.phone, password: creds.pass })
        })

        if (res.ok) {
          const data = await res.json()
          token = data.token
          user = data.user
          if (active) {
            setAuthToken(token)
            setAuthUser(user)
          }
        }

        if (!active) return

        if (socketRef.current) {
          socketRef.current.disconnect()
          socketRef.current = null
        }

        if (token) {
          const socket = io({
            path: '/socket.io',
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling']
          })

          socketRef.current = socket

          socket.on('connect', () => {
            if (!active) return
            setIsSocketConnected(true)

            // Join appropriate centre room based on authenticated role and assignment
            const targetCentreId = role === 'officer'
              ? (user?.assignedCentreId || state.centreId || NASHIK_CENTRE_ID)
              : (state.centreId || NASHIK_CENTRE_ID)

            if (targetCentreId) {
              socket.emit('join:centre', { centreId: targetCentreId })
            }
          })

          socket.on('disconnect', () => {
            if (!active) return
            setIsSocketConnected(false)
          })

          // Listen for broadcast queue recalculations
          socket.on('queue:update', (payload: any) => {
            if (!active || !payload) return
            setState((prev) => {
              const matched = payload.updates?.find(
                (u: any) => u.tokenNumber === prev.token || (prev.bookingId && u.bookingId === prev.bookingId)
              )
              const newAhead = matched ? matched.queueAhead : prev.ahead
              const newSlot = matched?.arrivalWindow || prev.slot
              const newEta = matched?.etaMinutes ?? prev.etaMinutes

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
                    text: `Live queue update from ${payload.centreName || prev.centre}: load ${payload.loadPercent ?? prev.capacity}%, processing speed ${payload.processingRate ?? prev.processingMinutes}m.`,
                    audience: 'all' as const,
                    time: 'Just now'
                  },
                  ...prev.notices
                ].slice(0, 10)
              }
            })
          })

          // Listen for targeted personal farmer updates
          socket.on('farmer:queue:update', (payload: any) => {
            if (!active || !payload) return
            const windowFormatted = typeof payload.arrivalWindow === 'string'
              ? payload.arrivalWindow
              : payload.arrivalWindow?.formatted || payload.arrivalWindow

            setState((prev) => ({
              ...prev,
              ahead: payload.queueAhead ?? prev.ahead,
              slot: windowFormatted || prev.slot,
              etaMinutes: payload.etaMinutes ?? prev.etaMinutes,
              token: payload.tokenNumber || prev.token,
              notices: [
                {
                  id: Date.now(),
                  text: `Your personal arrival window has updated to ${windowFormatted} (ETA: ${payload.etaMinutes} min).`,
                  audience: 'farmer' as const,
                  time: 'Just now'
                },
                ...prev.notices
              ].slice(0, 10)
            }))
          })
        }
      } catch (err) {
        console.warn('Authentication/realtime setup notice:', err)
      }
    }

    loginAndConnect()

    return () => {
      active = false
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [role])

  const update = (next: DemoState) => setState(next)
  const patch = (p: Partial<DemoState>) => setState(s => ({ ...s, ...p }))

  const switchRole = (next: Role) => {
    setRole(next)
    setPage(nav[next][0])
    setShowNotices(false)
  }

  const title = role === 'farmer' ? page : role === 'officer' ? 'Operations overview' : 'Network overview'

  // Authoritative booking handler connected to POST /api/bookings
  const handleBookingConfirmed = (booking: any, centreName: string) => {
    const arrivalWindow = booking.arrivalStart && booking.arrivalEnd
      ? `${booking.arrivalStart} – ${booking.arrivalEnd}`
      : booking.arrivalWindow || '10:40 – 11:00 AM'

    const queueAhead = booking.queueAhead ?? (booking.queuePosition ? booking.queuePosition - 1 : 0)

    setState((prev) => ({
      ...prev,
      bookingId: booking.id,
      token: booking.tokenNumber,
      ahead: queueAhead,
      slot: arrivalWindow,
      etaMinutes: booking.etaMinutes ?? 0,
      centre: centreName || prev.centre,
      centreId: booking.centreId,
      slotId: booking.slotId,
      booked: true,
      missed: false,
      stage: 'Queue processing',
      bookings: prev.bookings + 1,
      notices: [
        {
          id: Date.now(),
          text: `Booking confirmed with token ${booking.tokenNumber} at ${centreName}. Arrival window: ${arrivalWindow}.`,
          audience: 'farmer' as const,
          time: 'Just now'
        },
        ...prev.notices
      ].slice(0, 10)
    }))

    // Join centre room on socket
    if (socketRef.current && booking.centreId) {
      socketRef.current.emit('join:centre', { centreId: booking.centreId })
    }

    // Return to dashboard
    setPage('Dashboard')
  }

  const recoverMissedSlot = () => {
    const recovery = handleMissedSlot(calculateCentreLoad(centreModel(state)))
    setState(addNotice(
      { ...state, missed: false, booked: true, slot: recovery.slot, bookings: state.bookings + 1 },
      `Recovery slot confirmed for ${recovery.slot}.`,
      'farmer'
    ))
  }

  const content = showNotices || page === 'Notifications' ? (
    <Notifications state={state} role={role} onClose={() => { setShowNotices(false); setPage(nav[role][0]); }} />
  ) : role === 'farmer' && page === 'Book a slot' ? (
    <Booking onConfirm={handleBookingConfirmed} authToken={authToken} />
  ) : role === 'farmer' ? (
    <Farmer state={state} onBook={() => setPage('Book a slot')} onDelay={() => patch({ delayMinutes: state.delayMinutes ? 0 : 15 })} onRecover={recoverMissedSlot} />
  ) : role === 'officer' ? (
    <Officer state={state} update={update} officerToken={authToken} officerUser={authUser} />
  ) : (
    <Admin state={state} />
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Sprout size={18} /></div>
          <div>
            <b>Kisan-Mitra</b>
            <span>Procurement coordination</span>
          </div>
        </div>

        <div className="role-switch">
          <span>VIEWING AS</span>
          <select value={role} onChange={e => switchRole(e.target.value as Role)}>
            <option value="farmer">Farmer</option>
            <option value="officer">Procurement officer</option>
            <option value="admin">Administrator</option>
          </select>
        </div>

        <nav>
          {nav[role].map(label => (
            <button
              key={label}
              className={title === label ? 'active' : ''}
              onClick={() => {
                setPage(label)
                setShowNotices(label === 'Notifications')
              }}
            >
              {label === 'Dashboard' ? <LayoutDashboard size={17} /> :
               label.toLowerCase().includes('queue') ? <Users size={17} /> :
               label.toLowerCase().includes('status') ? <Activity size={17} /> :
               label.toLowerCase().includes('condition') || label.toLowerCase().includes('load') ? <Gauge size={17} /> :
               label === 'Notifications' ? <Bell size={17} /> : <UserRound size={17} />}
              {label}
              {label === 'Notifications' && <i className="nav-badge">{state.notices.length}</i>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button onClick={() => { setState(initial); setPage(nav[role][0]); setShowNotices(false); }}>
            <RefreshCw size={17} />
            <span>Reset demo</span>
          </button>
          <div className="version">SIH 2026 · PROTOTYPE</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Kisan-Mitra</span>
            <b>/ {title}</b>
          </div>

          <div className="top-actions">
            <div className="location">
              <MapPin size={14} /> {state.centre}
              {isSocketConnected && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} /> Live
                </span>
              )}
            </div>
            <button className="notification-button" onClick={() => setShowNotices(true)} aria-label="Open notifications">
              <Bell size={18} />
              <i />
            </button>
            <button className="user-menu">
              <span className="avatar">
                {authUser?.name ? authUser.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'KM'}
              </span>
              <span>
                <b>{authUser?.name || (role === 'farmer' ? 'Ramesh Jadhav' : role === 'officer' ? 'Suresh Patil' : 'Priya Sharma')}</b>
                <small>{role === 'farmer' ? 'Farmer' : role === 'officer' ? 'Centre officer' : 'Administrator'}</small>
              </span>
            </button>
          </div>
        </header>

        <div className="page-content">{content}</div>
      </main>
    </div>
  )
}
