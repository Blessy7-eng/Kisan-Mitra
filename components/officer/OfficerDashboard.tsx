'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  Gauge,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
  Radio,
} from 'lucide-react'
import { calculateCentreLoad, calculateETA, getAlternativeCentre, getCentreStatus } from '@/lib/smartQueueEngine'

interface OfficerDashboardProps {
  officerUser: any
  officerToken: string | null
  state: any
  onUpdateState: (next: any) => void
  onConditionUpdated?: () => void
}

export default function OfficerDashboard({
  officerUser,
  officerToken,
  state,
  onUpdateState,
  onConditionUpdated,
}: OfficerDashboardProps) {
  const [centreData, setCentreData] = useState<any | null>(null)
  const [queueData, setQueueData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [updatingCondition, setUpdatingCondition] = useState(false)
  const [conditionSuccessMessage, setConditionSuccessMessage] = useState<string | null>(null)

  // Local state for interactive condition editing
  const [selectedRate, setSelectedRate] = useState<number>(5.25)
  const [isDelayed, setIsDelayed] = useState<boolean>(false)

  // Officer's assigned centre ID (from backend authentication context)
  const assignedCentreId = officerUser?.assignedCentreId || state.centreId || 'cmu5e1cag0000s6k48rlx1elq'

  // Fetch live centre and queue records from real backend API
  const fetchLiveCentreAndQueue = useCallback(async () => {
    if (!assignedCentreId) return
    setLoading(true)
    const authHeaders: Record<string, string> = officerToken ? { Authorization: `Bearer ${officerToken}` } : {}
    try {
      const [cRes, qRes] = await Promise.all([
        fetch(`/api/centres/${assignedCentreId}`, { headers: authHeaders }),
        fetch(`/api/queue/${assignedCentreId}`, { headers: authHeaders }),
      ])

      if (cRes.ok) {
        const cJson = await cRes.json()
        setCentreData(cJson.centre)
        if (cJson.centre.processingRate) {
          setSelectedRate(cJson.centre.processingRate)
        }
        setIsDelayed(cJson.centre.status === 'DELAYED')
      }

      if (qRes.ok) {
        const qJson = await qRes.json()
        setQueueData(qJson)
      }
    } catch (err: any) {
      console.warn('Unable to refresh centre data:', err)
    } finally {
      setLoading(false)
    }
  }, [assignedCentreId])

  useEffect(() => {
    fetchLiveCentreAndQueue()
  }, [fetchLiveCentreAndQueue])

  // Real KPI calculations from backend data
  const currentRate = centreData?.processingRate ?? state.processingMinutes ?? 5.25
  const currentQueue = queueData?.totalWaiting ?? centreData?.currentQueue ?? (state.ahead + 14)
  const dailyCapacity = centreData?.dailyCapacity ?? 60
  const calculatedLoad = centreData?.calculatedLoadPercent ?? Math.min(100, Math.round((currentQueue / 40) * 100))
  const expectedWaitMinutes = Math.round(currentQueue * currentRate)
  const centreLoadStatus = centreData?.loadStatus || getCentreStatus(calculatedLoad)
  const alternative = getAlternativeCentre(calculatedLoad)

  // Live queue table rows from backend
  const activeBookings = queueData?.queue || []

  // Update operational conditions (PRIMARY SIH DEMO INTERACTION)
  const handleUpdateConditions = async (newRate: number, delayState: boolean) => {
    setActionError(null)
    setConditionSuccessMessage(null)
    setUpdatingCondition(true)

    try {
      const newStatus = delayState ? 'DELAYED' : (calculatedLoad >= 85 ? 'HIGH_LOAD' : 'ACTIVE')
      const delayMinutes = delayState ? 15 : 0

      // Call authoritative backend API: PATCH /api/centres/[id]
      const res = await fetch(`/api/centres/${assignedCentreId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(officerToken ? { Authorization: `Bearer ${officerToken}` } : {}),
        },
        body: JSON.stringify({
          processingRate: newRate,
          status: newStatus,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update centre operational parameters')
      }

      // Update local state presentation
      setSelectedRate(newRate)
      setIsDelayed(delayState)
      setConditionSuccessMessage(
        `Conditions updated: Rate set to ${newRate} min/farmer. Smart Queue Engine recalculated and broadcasted to farmers via Socket.IO.`
      )

      onUpdateState({
        ...state,
        processingMinutes: newRate,
        delayMinutes,
        capacity: data.centre?.calculatedLoadPercent ?? calculatedLoad,
        notices: [
          {
            id: Date.now(),
            text: `Officer updated processing conditions at ${centreData?.name || 'Nashik Centre'} (Rate: ${newRate}m).`,
            audience: 'all' as const,
            time: 'Just now',
          },
          ...state.notices,
        ].slice(0, 10),
      })

      await fetchLiveCentreAndQueue()
      if (onConditionUpdated) onConditionUpdated()
    } catch (err: any) {
      setActionError(err.message || 'Failed to persist conditions to backend.')
    } finally {
      setUpdatingCondition(false)
    }
  }

  // Update Booking Status via PATCH /api/bookings/[id]
  const updateBookingStatus = async (bookingId: string, status: string, noticeText: string) => {
    setActionError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(officerToken ? { Authorization: `Bearer ${officerToken}` } : {}),
        },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || `Failed to set status to ${status}`)
      }

      onUpdateState({
        ...state,
        notices: [
          { id: Date.now(), text: noticeText, audience: 'all' as const, time: 'Just now' },
          ...state.notices,
        ].slice(0, 10),
      })

      await fetchLiveCentreAndQueue()
    } catch (err: any) {
      setActionError(err.message || 'Failed to update booking status')
    }
  }

  const handleCallNextFarmer = async () => {
    const nextWaiting = activeBookings.find((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING')
    if (nextWaiting?.id) {
      await updateBookingStatus(
        nextWaiting.id,
        'PROCESSING',
        `Next farmer called: Token ${nextWaiting.tokenNumber}. Queue updated.`
      )
    } else {
      // Fallback update
      onUpdateState({
        ...state,
        ahead: Math.max(0, state.ahead - 1),
        stage: 'Queue processing',
        notices: [
          { id: Date.now(), text: 'Next farmer called. Queue and ETAs recalculated.', audience: 'all' as const, time: 'Just now' },
          ...state.notices,
        ].slice(0, 10),
      })
    }
  }

  const handleCompleteProcurement = async () => {
    const currentProcessing = activeBookings.find((b: any) => b.status === 'PROCESSING') || activeBookings[0]
    if (currentProcessing?.id) {
      await updateBookingStatus(
        currentProcessing.id,
        'COMPLETED',
        `Procurement completed for Token ${currentProcessing.tokenNumber}.`
      )
    } else {
      onUpdateState({
        ...state,
        stage: 'Procurement completed',
        notices: [
          { id: Date.now(), text: 'Procurement completed. Next farmer invited.', audience: 'all' as const, time: 'Just now' },
          ...state.notices,
        ].slice(0, 10),
      })
    }
  }

  const handleMarkMissed = async () => {
    const target = activeBookings.find((b: any) => b.tokenNumber === state.token) || activeBookings[0]
    if (target?.id) {
      await updateBookingStatus(
        target.id,
        'MISSED',
        `Token ${target.tokenNumber} marked missed. Slot recovery offered to farmer.`
      )
      onUpdateState({ ...state, missed: true, booked: false })
    }
  }

  return (
    <div className="officer-dashboard-container">
      {/* Action error banner */}
      {actionError && (
        <div className="inline-alert warning" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={17} />
          <div><b>Error:</b> <span>{actionError}</span></div>
        </div>
      )}

      {/* Condition update success banner */}
      {conditionSuccessMessage && (
        <div className="inline-alert info" style={{ marginBottom: '16px', background: '#eef7f7', borderColor: '#b2dedc' }}>
          <Radio size={17} className="text-teal-600 animate-pulse" />
          <div>
            <b>Operational Broadcast Active:</b>
            <span>{conditionSuccessMessage}</span>
          </div>
        </div>
      )}

      {/* Congestion warning if high load */}
      {calculatedLoad >= 80 && (
        <div className="inline-alert warning" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={17} />
          <div>
            <b>⚠ QUEUE CONGESTION ALERT:</b>
            <span>
              Centre workload is currently high ({calculatedLoad}% capacity load). Recommended alternative: {alternative}.
            </span>
          </div>
        </div>
      )}

      {/* Officer Header */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            PROCUREMENT CENTRE CONTROL <span className="live-dot" /> Real-time operations
          </div>
          <h1 style={{ color: '#12304a', fontSize: '26px' }}>
            {centreData?.name || state.centre}
          </h1>
          <p className="subtle">
            <MapPin size={14} /> Officer: <strong>{officerUser?.name || 'Suresh Patil'}</strong> · Location: {centreData?.location || 'Nashik District'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="button outline small" onClick={fetchLiveCentreAndQueue} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Queue
          </button>
          <span className="status-pill success">LIVE / OPERATIONAL</span>
        </div>
      </div>

      {/* Officer KPI Row (Real Backend Data) */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top"><span>CURRENT QUEUE</span><Users size={17} /></div>
          <strong>{currentQueue} farmers</strong>
          <small>Waiting at centre</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>PROCESSING RATE</span><Clock3 size={17} /></div>
          <strong className="info">{currentRate} min/farmer</strong>
          <small>~{Math.round(60 / (currentRate || 1))} farmers/hour</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>DAILY CAPACITY</span><Gauge size={17} /></div>
          <strong>{dailyCapacity}</strong>
          <small>Total slots per day</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>CENTRE LOAD</span><Activity size={17} /></div>
          <strong className={calculatedLoad >= 80 ? 'warning' : 'success'}>
            {calculatedLoad}%
          </strong>
          <small>{centreLoadStatus}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>EXPECTED WAIT</span><Clock3 size={17} /></div>
          <strong>{expectedWaitMinutes} min</strong>
          <small>Last queue position</small>
        </div>
      </div>

      {/* Main Control Grid */}
      <div className="officer-grid">
        {/* Live Queue Management Table */}
        <section className="panel queue-table-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">LIVE PROCUREMENT QUEUE</div>
              <h2>Active Farmer Flow</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button outline small"
                onClick={handleMarkMissed}
                title="Mark current token as missed"
              >
                Mark Missed
              </button>
              <button
                id="officer-call-next-btn"
                className="button dark small"
                onClick={handleCallNextFarmer}
              >
                <ArrowRight size={14} /> Call Next Farmer
              </button>
            </div>
          </div>

          <div className="data-table">
            <div className="table-head">
              <span>Token</span>
              <span>Farmer</span>
              <span>Slot</span>
              <span>Status</span>
              <span>ETA</span>
              <span>Action</span>
            </div>

            {activeBookings.length > 0 ? (
              activeBookings.map((b: any) => {
                const isProcessing = b.status === 'PROCESSING'
                const isDone = b.status === 'COMPLETED'
                return (
                  <div className="table-row" key={b.id || b.tokenNumber}>
                    <b>{b.tokenNumber}</b>
                    <span>{b.farmerName || 'Farmer'}</span>
                    <span>{b.slotTime || '10:40 AM'}</span>
                    <span className={`status-pill ${isProcessing ? 'info' : isDone ? 'success' : 'neutral'}`}>
                      {b.status}
                    </span>
                    <span>{b.etaMinutes !== undefined ? `${b.etaMinutes} min` : '—'}</span>
                    <span>
                      {isProcessing ? (
                        <button
                          className="button primary small"
                          style={{ height: '24px', fontSize: '10px', padding: '0 6px' }}
                          onClick={handleCompleteProcurement}
                        >
                          Complete
                        </button>
                      ) : (
                        <button
                          className="button outline small"
                          style={{ height: '24px', fontSize: '10px', padding: '0 6px' }}
                          onClick={() => updateBookingStatus(b.id, 'PROCESSING', `Called ${b.tokenNumber}`)}
                        >
                          Call
                        </button>
                      )}
                    </span>
                  </div>
                )
              })
            ) : (
              // Default representative queue rows if no active bookings in database yet
              [
                ['K-116', 'Kishan Rao', '10:20 AM', 'Completed', '0 min'],
                ['K-121', 'Raju Kadam', '10:30 AM', 'Processing', '5 min'],
                ['K-123', 'Meena Shinde', '10:30 AM', 'Waiting', '15 min'],
                [state.token, 'Ramesh Jadhav', state.slot?.split(' – ')[0] || '10:40 AM', 'Waiting', `${state.etaMinutes || 32} min`],
              ].map((r: any, idx) => (
                <div className="table-row" key={idx}>
                  <b>{r[0]}</b>
                  <span>{r[1]}</span>
                  <span>{r[2]}</span>
                  <span className={`status-pill ${r[3] === 'Processing' ? 'info' : r[3] === 'Completed' ? 'success' : 'neutral'}`}>
                    {r[3]}
                  </span>
                  <span>{r[4]}</span>
                  <span>
                    <button
                      className="button outline small"
                      style={{ height: '24px', fontSize: '10px', padding: '0 6px' }}
                      onClick={handleCallNextFarmer}
                    >
                      Process
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="condition-actions" style={{ marginTop: '16px' }}>
            <button onClick={() => onUpdateState({ ...state, stage: 'Produce verification' })}>
              Start Produce Verification
            </button>
            <button onClick={handleCompleteProcurement}>
              Complete Current Procurement
            </button>
          </div>
        </section>

        {/* Centre Conditions Control (THE PRIMARY SIH DEMO INTERACTION) */}
        <section className="panel conditions" id="officer-centre-conditions-panel">
          <div className="eyebrow teal">
            <Zap size={14} /> CENTRE CONDITIONS · SMART QUEUE ENGINE
          </div>
          <h2>Live Control Room</h2>
          <p style={{ fontSize: '11px', color: '#687882', margin: '0 0 16px', lineHeight: 1.5 }}>
            Adjusting these conditions calls <code>PATCH /api/centres/{assignedCentreId.slice(0, 8)}</code>.
            The Smart Queue Engine recalculates all farmer arrival windows and broadcasts via Socket.IO.
          </p>

          <div className="condition">
            <span>Current Processing Speed:</span>
            <b>{selectedRate} min / farmer</b>
            <em><i style={{ width: `${Math.min(100, selectedRate * 8)}%` }} /></em>
          </div>

          <div className="condition">
            <span>Current Delay Status:</span>
            <b className={isDelayed ? 'warning-text' : ''}>
              {isDelayed ? 'Delayed (+15 minutes)' : 'On Schedule (0 min)'}
            </b>
          </div>

          <div style={{ margin: '18px 0 12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#12304a', display: 'block', marginBottom: '8px' }}>
              Select Processing Speed Preset:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                { rate: 5.25, label: '5.25m (Fast / 11/hr)' },
                { rate: 7.0, label: '7.0m (Moderate / 8/hr)' },
                { rate: 11.0, label: '11.0m (Slow / 5/hr)' },
                { rate: 15.0, label: '15.0m (Heavy Check)' },
              ].map((preset) => (
                <button
                  key={preset.rate}
                  type="button"
                  id={`rate-preset-${preset.rate}`}
                  className={`button small ${selectedRate === preset.rate ? 'primary' : 'outline'}`}
                  style={{ fontSize: '10px', height: '32px' }}
                  onClick={() => setSelectedRate(preset.rate)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', color: '#253d4c', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={isDelayed}
                onChange={(e) => setIsDelayed(e.target.checked)}
                style={{ width: '15px', height: '15px' }}
              />
              Record Centre Delay (+15 min due to intake congestion)
            </label>
          </div>

          {/* Master Update Conditions Button */}
          <button
            id="officer-update-conditions-btn"
            className="button dark full"
            disabled={updatingCondition}
            onClick={() => handleUpdateConditions(selectedRate, isDelayed)}
          >
            {updatingCondition ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Recalculating Queue...
              </>
            ) : (
              <>
                <Zap size={14} /> Update Conditions &amp; Broadcast
              </>
            )}
          </button>

          {/* Smart Queue Engine Panel */}
          <div style={{ marginTop: '20px', padding: '12px', background: '#f5fbfb', border: '1px solid #d5e5e4', borderRadius: '5px' }}>
            <div className="eyebrow teal" style={{ fontSize: '9px', marginBottom: '4px' }}>
              SMART QUEUE ENGINE
            </div>
            <div style={{ fontSize: '11px', color: '#385563', lineHeight: 1.5 }}>
              <div>• Centre Load: <strong>{calculatedLoad}%</strong></div>
              <div>• Queue Ahead: <strong>{currentQueue} farmers</strong></div>
              <div>• Processing Rate: <strong>{currentRate} min</strong></div>
              <div>• Delay: <strong>{isDelayed ? '15 min' : '0 min'}</strong></div>
              <div>• Status: <strong>{centreLoadStatus}</strong></div>
            </div>
            <small style={{ display: 'block', marginTop: '6px', color: '#7a8e97', fontSize: '10px' }}>
              Rule-based Queue Intelligence · Authoritative server calculation
            </small>
          </div>
        </section>
      </div>
    </div>
  )
}
