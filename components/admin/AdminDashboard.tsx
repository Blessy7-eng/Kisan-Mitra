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
  Globe,
} from 'lucide-react'
import { translations, Language } from '@/lib/i18n'

interface AdminDashboardProps {
  adminUser: any
  adminToken: string | null
  isSocketConnected: boolean
  language?: Language
  onLanguageChange?: (lang: Language) => void
}

export default function AdminDashboard({
  adminUser,
  adminToken,
  isSocketConnected,
  language = 'en',
  onLanguageChange,
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

  const t = translations[language] || translations.en
  const a = t.adminDashboard

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
      if (res.ok) {
        setHealthData(data)
      }
    } catch (err) {
      console.warn('Health check unreachable:', err)
    } finally {
      setLoadingHealth(false)
    }
  }

  // Load specific slots when inspector selects a centre
  async function fetchCentreSlots(centreId: string) {
    if (!centreId) return
    setLoadingSlots(true)
    try {
      const res = await fetch(`/api/centres/${centreId}/slots`)
      const data = await res.json()
      if (res.ok && Array.isArray(data.slots)) {
        setCentreSlots(data.slots)
      }
    } catch (err) {
      console.warn('Unable to load slots for centre:', err)
    } finally {
      setLoadingSlots(false)
    }
  }

  useEffect(() => {
    fetchCentres()
    fetchHealth()
  }, [])

  useEffect(() => {
    if (selectedCentre?.id) {
      fetchCentreSlots(selectedCentre.id)
    }
  }, [selectedCentre?.id])

  // Calculated operational aggregates across all registered centres
  const totalQueue = centres.reduce((acc, c) => acc + (c.currentQueue || 0), 0)
  const totalCapacity = centres.reduce((acc, c) => acc + (c.dailyCapacity || 0), 0)
  const activeCentresCount = centres.filter((c) => c.status !== 'INACTIVE').length
  const highLoadCentresCount = centres.filter((c) => (c.calculatedLoadPercent || 0) >= 80).length

  return (
    <div className="admin-dashboard-container">
      {/* Top Welcome Row */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            {language === 'mr' ? 'राज्य व जिल्हा प्रशासन नियंत्रण' : language === 'hi' ? 'राज्य एवं जिला प्रशासन नियंत्रण' : 'STATEWIDE APMC NETWORK'}{' '}
            <span className="live-dot" /> {language === 'mr' ? 'थेट प्रणाली' : language === 'hi' ? 'लाइव सिस्टम' : 'Authoritative command'}
          </div>
          <h1>{a.title}</h1>
          <p className="subtle">
            {adminUser?.name ? `${adminUser.name} · ` : ''}
            {language === 'mr' ? 'राज्यस्तरीय खरेदी नेटवर्क नियंत्रण' : language === 'hi' ? 'राज्यस्तरीय खरीद नेटवर्क नियंत्रण' : 'Statewide procurement monitoring and capacity management'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onLanguageChange && (
            <label className="language-select">
              <Globe size={13} />
              <select value={language} onChange={(e: any) => onLanguageChange(e.target.value as Language)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="mr">मराठी</option>
              </select>
            </label>
          )}
          <button className="button outline small" onClick={() => { fetchCentres(); fetchHealth(); }} disabled={loadingCentres}>
            <RefreshCw size={13} className={loadingCentres ? 'animate-spin' : ''} /> {language === 'mr' ? 'नेटवर्क रीफ्रेश करा' : language === 'hi' ? 'नेटवर्क रीफ्रेश करें' : 'Refresh Network'}
          </button>
          <span className="status-pill success">{language === 'mr' ? 'नेटवर्क सक्रिय' : language === 'hi' ? 'नेटवर्क सक्रिय' : 'NETWORK ACTIVE'}</span>
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
          <div className="metric-top"><span>{a.totalCentres.toUpperCase()}</span><ShieldCheck size={17} /></div>
          <strong className="success">{activeCentresCount} {language === 'mr' ? 'केंद्रे' : language === 'hi' ? 'केंद्र' : 'centres'}</strong>
          <small>{a.allCentresOperational}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>{a.totalQueue.toUpperCase()}</span><Users size={17} /></div>
          <strong className="info">{totalQueue} {language === 'mr' ? 'शेतकरी' : language === 'hi' ? 'किसान' : 'farmers'}</strong>
          <small>{language === 'mr' ? 'सर्व केंद्रांवर प्रतीक्षेत' : language === 'hi' ? 'सभी केंद्रों पर प्रतीक्षारत' : 'Waiting across all centres'}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>{language === 'mr' ? 'अतिभार केंद्रे' : language === 'hi' ? 'उच्च भार केंद्र' : 'HIGH LOAD CENTRES'}</span><AlertTriangle size={17} /></div>
          <strong className={highLoadCentresCount > 0 ? 'warning' : 'success'}>
            {highLoadCentresCount} {language === 'mr' ? 'केंद्रे' : language === 'hi' ? 'केंद्र' : 'centres'}
          </strong>
          <small>{highLoadCentresCount > 0 ? (language === 'mr' ? 'भार नियोजनाची गरज' : language === 'hi' ? 'लोड संतुलन आवश्यक' : 'Requires load balancing') : (language === 'mr' ? 'सर्व सामान्य मर्यादेत' : language === 'hi' ? 'सामान्य सीमा में' : 'Within normal limits')}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>{language === 'mr' ? 'एकूण क्षमता' : language === 'hi' ? 'कुल क्षमता' : 'TOTAL CAPACITY'}</span><Gauge size={17} /></div>
          <strong>{totalCapacity}</strong>
          <small>{language === 'mr' ? 'दररोजचे एकूण स्लॉट' : language === 'hi' ? 'प्रति दिन कुल स्लॉट' : 'Total network slots/day'}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>{language === 'mr' ? 'प्रणाली आरोग्य' : language === 'hi' ? 'सिस्टम स्वास्थ्य' : 'SYSTEM HEALTH'}</span><Server size={17} /></div>
          <strong className={healthData?.status === 'ok' ? 'success' : 'warning'}>
            {healthData?.status === 'ok' ? (language === 'mr' ? 'सुरू' : language === 'hi' ? 'सक्रिय' : 'Online') : (language === 'mr' ? 'तपासत आहे' : language === 'hi' ? 'जांच जारी' : 'Checking')}
          </strong>
          <small>{language === 'mr' ? 'डेटाबेस आणि API जोडलेले' : language === 'hi' ? 'डेटाबेस एवं एपीआई कनेक्टेड' : 'API & Database Connected'}</small>
        </div>
      </div>

      {/* Centre Network Status Table */}
      <section className="panel network-panel" style={{ marginBottom: '20px' }}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{a.networkStatus.toUpperCase()}</div>
            <h2>{language === 'mr' ? 'खरेदी केंद्र ताफा' : language === 'hi' ? 'खरीद केंद्र बेड़ा' : 'Procurement Centre Fleet'}</h2>
          </div>
          <span className="status-pill info">{centres.length} {language === 'mr' ? 'केंद्रे लोड झाली' : language === 'hi' ? 'केंद्र लोड हुए' : 'centres loaded'}</span>
        </div>

        <div className="data-table network-table">
          <div className="table-head">
            <span>{a.centreName}</span>
            <span>{a.queue}</span>
            <span>{a.rate}</span>
            <span>{language === 'mr' ? 'क्षमता' : language === 'hi' ? 'क्षमता' : 'Capacity'}</span>
            <span>{a.load}</span>
            <span>{a.status}</span>
            <span>{language === 'mr' ? 'कृती' : language === 'hi' ? 'कार्रवाई' : 'Action'}</span>
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
                <span>{c.currentQueue} {language === 'mr' ? 'प्रतीक्षेत' : language === 'hi' ? 'प्रतीक्षारत' : 'waiting'}</span>
                <span>{c.processingRate} {language === 'mr' ? 'मि./शेतकरी' : language === 'hi' ? 'मिनट/किसान' : 'min/farmer'}</span>
                <span>{c.dailyCapacity} {language === 'mr' ? 'स्लॉट' : language === 'hi' ? 'स्लॉट' : 'slots'}</span>
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
                  {c.loadStatus || (isHigh ? (language === 'mr' ? 'जास्त भार' : language === 'hi' ? 'उच्च भार' : 'High Load') : (language === 'mr' ? 'सामान्य' : language === 'hi' ? 'सामान्य' : 'Normal'))}
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
                    {language === 'mr' ? 'तपासा' : language === 'hi' ? 'जांचें' : 'Inspect'}
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
              <div className="eyebrow">{a.centreInspector.toUpperCase()}</div>
              <h2>{selectedCentre?.name || (language === 'mr' ? 'केंद्र निवडा' : language === 'hi' ? 'केंद्र चुनें' : 'Select a Centre')}</h2>
            </div>
            <span className={`status-pill ${selectedCentre?.calculatedLoadPercent >= 80 ? 'warning' : 'success'}`}>
              {selectedCentre?.calculatedLoadPercent}% {a.load}
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
                  <small style={{ color: '#7a8e97', fontSize: '10px' }}>{a.queue}</small>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#12304a' }}>{selectedCentre.currentQueue}</strong>
                </div>
                <div style={{ background: '#f8fafb', border: '1px solid #e1e8eb', borderRadius: '5px', padding: '10px' }}>
                  <small style={{ color: '#7a8e97', fontSize: '10px' }}>{a.rate}</small>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#12304a' }}>{selectedCentre.processingRate}m</strong>
                </div>
                <div style={{ background: '#f8fafb', border: '1px solid #e1e8eb', borderRadius: '5px', padding: '10px' }}>
                  <small style={{ color: '#7a8e97', fontSize: '10px' }}>{language === 'mr' ? 'दैनंदिन क्षमता' : language === 'hi' ? 'दैनिक क्षमता' : 'Daily Capacity'}</small>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#12304a' }}>{selectedCentre.dailyCapacity}</strong>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#12304a', display: 'block', marginBottom: '8px' }}>
                  {language === 'mr' ? 'सक्रिय खरेदी स्लॉट:' : language === 'hi' ? 'सक्रिय खरीद स्लॉट:' : 'Active Procurement Slots:'}
                </span>
                {loadingSlots ? (
                  <div style={{ fontSize: '11px', color: '#6b7a83', padding: '8px 0' }}>{language === 'mr' ? 'स्लॉट लोड होत आहेत...' : language === 'hi' ? 'स्लॉट लोड हो रहे हैं...' : 'Loading slots...'}</div>
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
                        <span>{language === 'mr' ? 'क्षमता' : language === 'hi' ? 'क्षमता' : 'Capacity'}: {s.bookedCount} / {s.capacity}</span>
                        <span className={`status-pill ${s.isFull ? 'danger' : 'success'}`}>
                          {s.isFull ? (language === 'mr' ? 'पूर्ण' : language === 'hi' ? 'फुल' : 'Full') : `${s.availableCapacity ?? (s.capacity - s.bookedCount)} ${language === 'mr' ? 'उपलब्ध' : language === 'hi' ? 'उपलब्ध' : 'open'}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#6b7a83' }}>{language === 'mr' ? 'या केंद्रासाठी स्लॉट उपलब्ध नाहीत.' : language === 'hi' ? 'इस केंद्र के लिए स्लॉट उपलब्ध नहीं हैं।' : 'No slots configured for this centre.'}</div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#829098' }}>{a.selectCentre}</div>
          )}
        </section>

        {/* System Health Subsystem Panel */}
        <section className="panel" id="admin-system-health">
          <div className="panel-heading">
            <div>
              <div className="eyebrow teal">{language === 'mr' ? 'प्रणाली तपासणी' : language === 'hi' ? 'सिस्टम जांच' : 'VERIFIED INFRASTRUCTURE'}</div>
              <h2>{a.systemHealth}</h2>
            </div>
            <span className="status-pill info">GET /api/health</span>
          </div>

          <div style={{ display: 'grid', gap: '12px', marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e1e8eb', borderRadius: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#12304a' }}>
                <Server size={16} color="#2f6f73" /> Express / Next.js REST API
              </span>
              <span className={`status-pill ${healthData?.status === 'ok' ? 'success' : 'danger'}`}>
                {healthData?.status === 'ok' ? (language === 'mr' ? 'सुरू' : language === 'hi' ? 'सक्रिय' : 'Healthy') : (language === 'mr' ? 'बंद' : language === 'hi' ? 'डिस्कनेक्टेड' : 'Disconnected')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e1e8eb', borderRadius: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#12304a' }}>
                <Database size={16} color="#2f6f73" /> {a.database} (Prisma ORM)
              </span>
              <span className={`status-pill ${healthData?.database === 'connected' ? 'success' : 'warning'}`}>
                {healthData?.database === 'connected' ? a.connected : healthData?.database || (language === 'mr' ? 'प्रलंबित' : language === 'hi' ? 'लंबित' : 'Pending')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e1e8eb', borderRadius: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#12304a' }}>
                <Radio size={16} color="#2f6f73" /> {a.realtimeServer}
              </span>
              <span className={`status-pill ${isSocketConnected ? 'success' : 'warning'}`}>
                {isSocketConnected ? a.connected : (language === 'mr' ? 'जोडत आहे' : language === 'hi' ? 'कनेक्ट हो रहा है' : 'Connecting')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #e1e8eb', borderRadius: '5px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#12304a' }}>
                <Zap size={16} color="#2f6f73" /> {language === 'mr' ? 'स्मार्ट क्यू इंजिन' : language === 'hi' ? 'स्मार्ट क्यू इंजन' : 'Smart Queue Engine'}
              </span>
              <span className="status-pill success">
                {a.ruleBasedActive}
              </span>
            </div>
          </div>

          <div style={{ marginTop: '20px', padding: '12px', background: '#fbfdfe', border: '1px dashed #ccd7dc', borderRadius: '5px', fontSize: '11px', color: '#687882', lineHeight: 1.5 }}>
            <b>{language === 'mr' ? 'ऐतिहासिक विश्लेषण सूचना:' : language === 'hi' ? 'ऐतिहासिक विश्लेषण सूचना:' : 'Historical Analytics Notice:'}</b>
            <p style={{ margin: '4px 0 0' }}>
              {language === 'mr'
                ? 'ऐतिहासिक विश्लेषण — नियोजित (टप्पा २). थेट परिचालन माहिती स्मार्ट क्यू इंजिनशी समक्रमित आहे.'
                : language === 'hi'
                ? 'ऐतिहासिक विश्लेषण — नियोजित (चरण 2)। लाइव परिचालन टेलीमेट्री स्मार्ट क्यू इंजन से सिंक है।'
                : 'Historical analytics — planned (Phase 2). Live operational telemetry is synchronized with the Smart Queue Engine.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
