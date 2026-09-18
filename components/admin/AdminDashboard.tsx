'use client'

import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Activity,
  Gauge,
  Clock3,
  RefreshCw,
  Server,
  Database,
  Radio,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronRight,
  MapPin,
} from 'lucide-react'

interface AdminDashboardProps {
  adminUser: any
  adminToken: string | null
  isSocketConnected: boolean
}

export default function AdminDashboard({
  adminUser,
  adminToken,
  isSocketConnected,
}: AdminDashboardProps) {
  const [centres, setCentres] = useState<any[]>([])
  const [loadingCentres, setLoadingCentres] = useState(false)
  const [centresError, setCentresError] = useState<string | null>(null)

  // Health system verification
  const [healthData, setHealthData] = useState<any | null>(null)
  const [loadingHealth, setLoadingHealth] = useState(false)

  // Inspector state
  const [selectedCentre, setSelectedCentre] = useState<any | null>(null)
  const [centreSlots, setCentreSlots] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Fetch real centres from GET /api/centres
  async function fetchCentres() {
    setLoadingCentres(true)
    setCentresError(null)
    try {
      const res = await fetch('/api/centres')
      const data = await res.json()
      if (res.ok && Array.isArray(data.centres)) {
        setCentres(data.centres)
        if (!selectedCentre && data.centres.length > 0) {
          setSelectedCentre(data.centres[0])
        }
      } else {
        throw new Error(data.error || 'Failed to fetch centre network')
      }
    } catch (err: any) {
      setCentresError(err.message || 'Unable to connect to centres service')
    } finally {
      setLoadingCentres(false)
    }
  }

  // Fetch real health state from GET /api/health
  async function fetchHealth() {
    setLoadingHealth(true)
    try {
      const res = await fetch('/api/health')
      const data = await res.json()
      setHealthData(data)
    } catch (err) {
      setHealthData({ status: 'unhealthy', database: 'disconnected' })
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => {
    fetchCentres()
    fetchHealth()
  }, [])

  // Fetch slots when selectedCentre changes
  useEffect(() => {
    if (!selectedCentre?.id) return
    let active = true
    async function fetchSlots() {
      setLoadingSlots(true)
      try {
        const res = await fetch(`/api/centres/${selectedCentre.id}/slots`)
        const data = await res.json()
        if (active && res.ok && Array.isArray(data.slots)) {
          setCentreSlots(data.slots)
        }
      } catch (err) {
        console.warn('Error loading slots for centre inspector:', err)
      } finally {
        if (active) setLoadingSlots(false)
      }
    }
    fetchSlots()
    return () => { active = false }
  }, [selectedCentre?.id])

  // Derive real network metrics from API data
  const activeCentresCount = centres.filter((c) => c.status === 'ACTIVE' || c.status === 'HIGH_LOAD').length
  const totalQueue = centres.reduce((sum, c) => sum + (c.currentQueue || 0), 0)
  const highLoadCentresCount = centres.filter((c) => (c.calculatedLoadPercent || 0) >= 80).length
  const totalCapacity = centres.reduce((sum, c) => sum + (c.dailyCapacity || 0), 0)

  return (
    <div className="admin-dashboard-container">
      {/* Admin Header */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            ADMIN CONTROL CENTRE <span className="live-dot" /> Procurement Network Monitor
          </div>
          <h1 style={{ color: '#12304a', fontSize: '26px' }}>
            Procurement Network Overview
          </h1>
          <p className="subtle">
            Administrator: <strong>{adminUser?.name || 'Priya Sharma'}</strong> · Real-time network telemetry across Aiven MySQL
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="button outline small" onClick={() => { fetchCentres(); fetchHealth(); }} disabled={loadingCentres}>
            <RefreshCw size={13} className={loadingCentres ? 'animate-spin' : ''} /> Refresh Network
          </button>
          <span className="status-pill success">NETWORK ACTIVE</span>
        </div>
      </div>

      {centresError && (
        <div className="inline-alert warning" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={17} />
          <div><b>Network API Notice:</b> <span>{centresError}</span></div>
        </div>
      )}

      {/* Admin KPIs (Derived from real backend data) */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top"><span>ACTIVE CENTRES</span><ShieldCheck size={17} /></div>
          <strong className="success">{activeCentresCount} centres</strong>
          <small>Operational in network</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>TOTAL CURRENT QUEUE</span><Users size={17} /></div>
          <strong className="info">{totalQueue} farmers</strong>
          <small>Waiting across all centres</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>HIGH LOAD CENTRES</span><AlertTriangle size={17} /></div>
          <strong className={highLoadCentresCount > 0 ? 'warning' : 'success'}>
            {highLoadCentresCount} centres
          </strong>
          <small>{highLoadCentresCount > 0 ? 'Requires load balancing' : 'Within normal limits'}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>TOTAL CAPACITY</span><Gauge size={17} /></div>
          <strong>{totalCapacity}</strong>
          <small>Total network slots/day</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>SYSTEM HEALTH</span><Server size={17} /></div>
          <strong className={healthData?.status === 'ok' ? 'success' : 'warning'}>
            {healthData?.status === 'ok' ? 'Online' : 'Checking'}
          </strong>
          <small>API &amp; MySQL Connected</small>
        </div>
      </div>

      {/* Centre Network Status Table */}
      <section className="panel network-panel" style={{ marginBottom: '20px' }}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">CENTRE NETWORK STATUS</div>
            <h2>Procurement Centre Fleet</h2>
          </div>
          <span className="status-pill info">{centres.length} centres loaded</span>
        </div>

        <div className="data-table network-table">
          <div className="table-head">
            <span>Centre</span>
            <span>Queue</span>
            <span>Processing Rate</span>
            <span>Capacity</span>
            <span>Load</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {centres.map((c) => {
            const loadPercent = c.calculatedLoadPercent || 0
            const isHigh = loadPercent >= 80
            const isSelected = selectedCentre?.id === c.id

            return (
              <div
                className={`table-row ${isSelected ? 'bg-teal-50/40' : ''}`}
                key={c.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedCentre(c)}
              >
                <b>{c.name}</b>
                <span>{c.currentQueue} waiting</span>
                <span>{c.processingRate} min/farmer</span>
                <span>{c.dailyCapacity} slots</span>
                <div>
                  <strong className={isHigh ? 'warning-text' : ''}>{loadPercent}%</strong>
                  <div className="load-bar">
                    <i
                      style={{
                        width: `${loadPercent}%`,
                        background: isHigh ? '#a46e2f' : '#5b9184',
                      }}
                    />
                  </div>
                </div>
                <span className={`status-pill ${isHigh ? 'warning' : 'success'}`}>
                  {c.loadStatus || (isHigh ? 'High Load' : 'Normal')}
                </span>
                <span>
                  <button
                    type="button"
                    className="button small outline"
                    style={{ height: '24px', fontSize: '10px', padding: '0 6px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedCentre(c)
                    }}
                  >
                    Inspect
                  </button>
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Two Column Layout: Selected Centre Inspector & System Health */}
      <div className="content-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        {/* Selected Centre Details Inspector */}
        <section className="panel" id="admin-centre-inspector">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">CENTRE INSPECTOR</div>
              <h2>{selectedCentre?.name || 'Select a Centre'}</h2>
            </div>
            <span className={`status-pill ${selectedCentre?.calculatedLoadPercent >= 80 ? 'warning' : 'success'}`}>
              {selectedCentre?.calculatedLoadPercent}% Load
            </span>
          </div>

          {selectedCentre ? (
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '12px', color: '#687882', margin: '0 0 14px' }}>
                <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />
                {selectedCentre.location} · ID: <code>{selectedCentre.id}</code>
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
                <div style={{ background: '#f8fafb', border: '1px solid #e1e8eb', borderRadius: '5px', padding: '10px' }}>
                  <small style={{ color: '#7a8e97', fontSize: '10px' }}>Current Queue</small>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#12304a' }}>{selectedCentre.currentQueue}</strong>
                </div>
                <div style={{ background: '#f8fafb', border: '1px solid #e1e8eb', borderRadius: '5px', padding: '10px' }}>
                  <small style={{ color: '#7a8e97', fontSize: '10px' }}>Processing Rate</small>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#12304a' }}>{selectedCentre.processingRate}m</strong>
                </div>
                <div style={{ background: '#f8fafb', border: '1px solid #e1e8eb', borderRadius: '5px', padding: '10px' }}>
                  <small style={{ color: '#7a8e97', fontSize: '10px' }}>Daily Capacity</small>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#12304a' }}>{selectedCentre.dailyCapacity}</strong>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#12304a', display: 'block', marginBottom: '8px' }}>
                  Active Procurement Slots:
                </span>
                {loadingSlots ? (
                  <div style={{ fontSize: '11px', color: '#6b7a83', padding: '8px 0' }}>Loading slots...</div>
                ) : centreSlots.length > 0 ? (
                  <div style={{ display: 'grid', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {centreSlots.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '7px 10px',
                          border: '1px solid #e7edf0',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        <b>{s.startTime} – {s.endTime}</b>
                        <span>Capacity: {s.bookedCount} / {s.capacity} booked</span>
                        <span className={`status-pill ${s.isFull ? 'danger' : 'success'}`}>
                          {s.isFull ? 'Full' : `${s.availableCapacity ?? (s.capacity - s.bookedCount)} open`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#6b7a83' }}>No slots configured for this centre.</div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#829098' }}>Select a centre above to inspect details.</div>
          )}
        </section>

        {/* System Health Subsystem Panel */}
        <section className="panel" id="admin-system-health">
          <div className="panel-heading">
            <div>
              <div className="eyebrow teal">VERIFIED INFRASTRUCTURE</div>
              <h2>System Health</h2>
            </div>
            <span className="status-pill info">GET /api/health</span>
          </div>

          <div style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e1e8eb', borderRadius: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#12304a' }}>
                <Server size={16} color="#2f6f73" /> Express / Next.js REST API
              </span>
              <span className={`status-pill ${healthData?.status === 'ok' ? 'success' : 'danger'}`}>
                {healthData?.status === 'ok' ? 'Healthy' : 'Disconnected'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e1e8eb', borderRadius: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#12304a' }}>
                <Database size={16} color="#2f6f73" /> Aiven MySQL (Prisma ORM)
              </span>
              <span className={`status-pill ${healthData?.database === 'connected' ? 'success' : 'warning'}`}>
                {healthData?.database === 'connected' ? 'Connected' : healthData?.database || 'Pending'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e1e8eb', borderRadius: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#12304a' }}>
                <Radio size={16} color="#2f6f73" /> Socket.IO Realtime Gateway
              </span>
              <span className={`status-pill ${isSocketConnected ? 'success' : 'warning'}`}>
                {isSocketConnected ? 'Connected' : 'Connecting'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e1e8eb', borderRadius: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#12304a' }}>
                <Zap size={16} color="#2f6f73" /> Smart Queue Engine
              </span>
              <span className="status-pill success">
                Rule-based active
              </span>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '12px', background: '#fbfdfe', border: '1px dashed #ccd7dc', borderRadius: '5px', fontSize: '11px', color: '#687882', lineHeight: 1.5 }}>
            <b>Historical Analytics Notice:</b>
            <p style={{ margin: '4px 0 0' }}>
              Historical analytics — planned (SIH Phase 2). Live operational telemetry is backed by Aiven MySQL and the rule-based Smart Queue Engine.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
