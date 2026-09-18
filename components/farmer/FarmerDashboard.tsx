'use client'

import React, { useState } from 'react'
import {
  Clock3,
  Users,
  Gauge,
  ShieldCheck,
  Zap,
  Check,
  Activity,
  MapPin,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Globe,
  Info,
} from 'lucide-react'
import { calculateCentreLoad, calculateETA, handleMissedSlot } from '@/lib/smartQueueEngine'
import { Language, maskPhoneNumber } from '@/lib/i18n'

interface FarmerDashboardProps {
  farmerName: string
  farmerPhone: string
  state: any
  onBookSlot: () => void
  onDelayToggle?: () => void
  onRecoverSlot: () => void
  lastEtaChangeNotice: string | null
  language: Language
  onLanguageChange: (lang: Language) => void
}

export default function FarmerDashboard({
  farmerName,
  farmerPhone,
  state,
  onBookSlot,
  onRecoverSlot,
  lastEtaChangeNotice,
  language,
  onLanguageChange,
}: FarmerDashboardProps) {
  const [showWhyEta, setShowWhyEta] = useState(false)

  // Derive model for display and calculations defensively
  const centreState = {
    queue: (Number(state.ahead) || 0) + 14,
    capacity: Number(state.capacity) || 60,
    processingMinutes: Number(state.processingMinutes) || 5.25,
    delayMinutes: Number(state.delayMinutes) || 0,
    bookings: Number(state.bookings) || 84,
    counters: 4,
  }

  const backendEta = state.etaMinutes ?? calculateETA(state.ahead, centreState)
  const arrivalWindow = state.slot || '10:40 – 11:00 AM'
  const recovery = handleMissedSlot(calculateCentreLoad(centreState))

  // Mask phone number for privacy
  const maskedPhone = maskPhoneNumber(farmerPhone)

  // Format today's date dynamically
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // Loading State
  if (state.bookingLoading) {
    return (
      <div className="farmer-dashboard-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <RefreshCw size={32} className="animate-spin text-teal-600" style={{ margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#12304a', marginBottom: '8px' }}>
          Loading your booking…
        </h2>
        <p style={{ color: '#607282', fontSize: '13px' }}>
          Fetching authoritative token and queue information from APMC servers.
        </p>
      </div>
    )
  }

  // Clear Empty State when farmer has no active booking
  if (!state.booked) {
    return (
      <div className="farmer-dashboard-container">
        {/* Top Welcome Row */}
        <div className="welcome-row">
          <div>
            <div className="eyebrow">
              FARMER PORTAL <span className="live-dot" /> Live queue tracking
            </div>
            <h1>{farmerName ? `Good morning, ${farmerName.split(' ')[0]}` : 'Welcome, Farmer'}</h1>
            <p className="subtle">
              {maskedPhone} · Intelligent procurement queue & predictable arrival windows.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label className="language-select">
              <Globe size={13} />
              <select value={language} onChange={(e: any) => onLanguageChange(e.target.value as Language)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="mr">मराठी</option>
              </select>
            </label>
            <button className="button primary" onClick={onBookSlot} id="farmer-empty-book-top-btn">
              Book a slot <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Empty State Banner Required by Section 6 */}
        <div
          className="panel"
          style={{
            padding: '56px 24px',
            textAlign: 'center',
            margin: '24px 0',
            border: '2px dashed #cbd5e1',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
          }}
        >
          <Clock3 size={48} style={{ margin: '0 auto 16px', color: '#0f766e', display: 'block' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
            You do not have an active booking.
          </h2>
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '24px' }}>
            Book a slot to receive your token.
          </p>
          <button
            className="button primary"
            onClick={onBookSlot}
            id="farmer-empty-state-book-btn"
            style={{ padding: '12px 24px', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            Book a slot <ArrowRight size={18} />
          </button>
        </div>
      </div>
    )
  }

  // Translations for primary farmer-facing labels
  const i18n = {
    en: {
      greeting: `Good morning, ${farmerName.split(' ')[0] || 'Farmer'}`,
      subtitle: 'Intelligent procurement queue & predictable arrival windows.',
      nextAppt: 'Next appointment',
      queuePos: 'Queue position',
      estWait: 'Estimated wait',
      procStatus: 'Procurement status',
      yourQueue: 'Your queue at a glance',
      howLong: 'How long will I wait?',
      arrWindow: 'Arrival window',
      whyEta: 'Why this ETA?',
      quickActions: 'Quick actions',
      bookSlot: 'Book My Slot',
      myToken: 'My Token',
      trackQueue: 'Track Queue',
      myCentre: 'My Centre',
      journeyTitle: 'Track your procurement journey',
      sampleData: 'Sample booking',
    },
    hi: {
      greeting: `नमस्ते, ${farmerName.split(' ')[0] || 'किसान'}`,
      subtitle: 'सटीक स्लॉट आवंटन और टोकन कतार प्रणाली।',
      nextAppt: 'अगला स्लॉट समय',
      queuePos: 'कतार में स्थान',
      estWait: 'अनुमानित प्रतीक्षा',
      procStatus: 'खरीद स्थिति',
      yourQueue: 'आपकी कतार की स्थिति',
      howLong: 'कितना समय लगेगा?',
      arrWindow: 'पहुंचने का समय',
      whyEta: 'यह समय कैसे तय हुआ?',
      quickActions: 'त्वरित कार्य',
      bookSlot: 'नया स्लॉट बुक करें',
      myToken: 'मेरा टोकन',
      trackQueue: 'कतार देखें',
      myCentre: 'मेरा खरीद केंद्र',
      journeyTitle: 'खरीद प्रक्रिया की प्रगति',
      sampleData: 'नमूना बुकिंग',
    },
    mr: {
      greeting: `शुभ सकाळ, ${farmerName.split(' ')[0] || 'शेतकरी'}`,
      subtitle: 'नियोजित धान्य खरेदी आणि अचूक टोकन रांग व्यवस्थापन.',
      nextAppt: 'पुढील वेळ',
      queuePos: 'रांगेतील क्रमांक',
      estWait: 'अपेक्षित प्रतीक्षा',
      procStatus: 'खरेदी स्थिती',
      yourQueue: 'तुमची रांग स्थिती',
      howLong: 'किती वेळ लागेल?',
      arrWindow: 'केंद्रावर पोहचण्याची वेळ',
      whyEta: 'हा वेळ कसा काढला?',
      quickActions: 'जलद कृती',
      bookSlot: 'स्लॉट बुक करा',
      myToken: 'माझे टोकन',
      trackQueue: 'रांग तपासा',
      myCentre: 'माझे केंद्र',
      journeyTitle: 'धान्य खरेदी प्रवास',
      sampleData: 'प्रात्यक्षिक बुकिंग',
    },
  }[language]

  const quickActionItems = [
    { label: i18n.bookSlot, detail: 'Find best arrival time', icon: Clock3, action: onBookSlot, primary: true },
    { label: i18n.myToken, detail: `${state.token} · Confirmed`, icon: ShieldCheck },
    { label: i18n.trackQueue, detail: `${state.ahead} farmers ahead`, icon: Users },
    { label: i18n.myCentre, detail: `${state.centre.split(' ')[0]}`, icon: MapPin },
    { label: 'Procurement Status', detail: state.stage, icon: Activity },
    { label: 'Payment Status', detail: 'DBT Processing', icon: TrendingUp },
  ]

  const progress = Math.min(88, 44 + state.ahead * 3)

  return (
    <div className="farmer-dashboard-container">
      {/* Real-time ETA Change Notification */}
      {lastEtaChangeNotice && (
        <div className="inline-alert info" style={{ marginBottom: '16px', background: '#eef7f7', borderColor: '#b3dedb' }}>
          <RefreshCw size={16} className="animate-spin text-teal-600" />
          <div>
            <b>Live Queue Recalculation:</b>
            <span>{lastEtaChangeNotice}</span>
          </div>
        </div>
      )}

      {/* Missed Slot Recovery Alert */}
      {state.missed && (
        <div className="inline-alert warning" style={{ marginBottom: '18px' }}>
          <AlertTriangle size={17} />
          <div>
            <b>Missed your procurement slot?</b>
            <span>
              Smart Queue Engine found a recovery window at {recovery.centre} for {recovery.slot}. Estimated wait: {recovery.wait} minutes.
            </span>
          </div>
          <button className="button primary small" onClick={onRecoverSlot}>
            Confirm recovery slot
          </button>
        </div>
      )}

      {/* Top Welcome Row */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            FARMER PORTAL <span className="live-dot" /> Live queue tracking
          </div>
          <h1>{i18n.greeting}</h1>
          <p className="subtle">
            <MapPin size={14} /> {state.centre} · {maskedPhone} · {i18n.subtitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label className="language-select">
            <Globe size={13} />
            <select value={language} onChange={(e: any) => onLanguageChange(e.target.value as Language)}>
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="mr">मराठी</option>
            </select>
          </label>
          <button className="button primary" onClick={onBookSlot} id="farmer-book-slot-top-btn">
            {i18n.bookSlot} <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <section className="farmer-quick-actions">
        <div className="quick-actions-head">
          <div>
            <div className="eyebrow">WHAT WOULD YOU LIKE TO DO?</div>
            <h2>{i18n.quickActions}</h2>
          </div>
        </div>
        <div className="quick-action-grid">
          {quickActionItems.map((item) => (
            <button
              key={item.label}
              className={`quick-action ${item.primary ? 'primary' : ''}`}
              onClick={item.action || (() => {})}
            >
              <span className="quick-icon"><item.icon size={20} /></span>
              <span>
                <b>{item.label}</b>
                <small>{item.detail}</small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
      </section>

      {/* KPI Metrics Row - PRIORITIZED: ETA, Arrival Window, Token, Queue Position */}
      <div className="metrics-grid farmer-metrics">
        <div className="metric-card primary-kpi">
          <div className="metric-top"><span>{i18n.estWait} (ETA)</span><Gauge size={17} /></div>
          <strong className={state.delayMinutes ? 'warning' : 'primary-eta'}>{backendEta} min</strong>
          <small>{state.delayMinutes ? 'Updated live (+15m delay recorded)' : 'Calculated by Smart Queue Engine'}</small>
        </div>

        <div className="metric-card primary-kpi">
          <div className="metric-top"><span>{i18n.arrWindow}</span><Clock3 size={17} /></div>
          <strong>{arrivalWindow}</strong>
          <small>{todayFormatted} · 20-min recommended window</small>
        </div>

        <div className="metric-card primary-kpi">
          <div className="metric-top"><span>Token Number</span><ShieldCheck size={17} /></div>
          <strong className="success-token">{state.token}</strong>
          <small>{state.centre} · Authoritative token</small>
        </div>

        <div className="metric-card primary-kpi">
          <div className="metric-top"><span>{i18n.queuePos}</span><Users size={17} /></div>
          <strong className="info">#{state.ahead + 1} in queue</strong>
          <small>{state.ahead} farmers ahead of you</small>
        </div>
      </div>

      {/* Main Grid: Queue View & Token Card */}
      <div className="content-grid farmer-main">
        {/* Queue Rail Panel */}
        <section className="panel queue-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">
                LIVE QUEUE STATUS <span className="live-dot" /> Smart Queue Engine
              </div>
              <h2>{i18n.yourQueue}</h2>
            </div>
            <span className="status-pill success">{todayFormatted}</span>
          </div>

          {/* Interactive Queue Rail */}
          <div className="queue-rail-wrap">
            <div className="queue-rail-labels">
              <span>Completed ({state.currentToken})</span>
              <span>Processing (Active)</span>
              <span>Your Token ({state.token})</span>
            </div>
            <div className="queue-rail">
              <div className="queue-done" style={{ width: `${progress}%` }} />
              <div className="queue-marker processing" style={{ left: `${progress}%` }} />
              <div
                className="queue-marker yours"
                style={{ left: `${Math.min(92, progress + 18)}%` }}
              >
                <span>{state.token}</span>
              </div>
            </div>
            <div className="queue-foot">
              <span>{state.currentToken} <Check size={13} /></span>
              <span className="processing-text">Counter 1-4 active</span>
              <span className="your-text">{state.token} you · {backendEta} min wait</span>
            </div>
          </div>

          {/* ETA & Arrival Window Details */}
          <div className="eta-row">
            <div className="eta-card">
              <span>{i18n.howLong}</span>
              <strong>{backendEta} <small>min</small></strong>
              <span className={state.delayMinutes ? 'warning-text' : 'success-text'}>
                {state.delayMinutes ? 'Delay recorded at centre' : 'On track for arrival window'}
              </span>
            </div>
            <div className="appointment-card">
              <span>{i18n.arrWindow}</span>
              <strong>{arrivalWindow}</strong>
              <span>Token <b>{state.token}</b> · {todayFormatted}</span>
            </div>
          </div>

          {/* Expandable "Why this ETA?" Section */}
          <div style={{ marginTop: '16px', borderTop: '1px solid #edf1f2', paddingTop: '12px' }}>
            <button
              type="button"
              onClick={() => setShowWhyEta(!showWhyEta)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: '#f8fafb',
                border: '1px solid #dce4e8',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#12304a',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={14} color="#2f6f73" />
                {i18n.whyEta} (Rule-based Queue Intelligence)
              </span>
              {showWhyEta ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showWhyEta && (
              <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e2e9ec', borderTop: '0', borderRadius: '0 0 6px 6px', fontSize: '11px', color: '#4a5b67', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#12304a' }}>
                  Your estimated wait time of <strong>{backendEta} minutes</strong> is computed dynamically by the Smart Queue Engine using three live operational inputs:
                </p>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div>• <strong>Farmers Ahead:</strong> {state.ahead} farmers currently waiting before your token in the queue sequence.</div>
                  <div>• <strong>Centre Processing Rate:</strong> Average of {centreState.processingMinutes} minutes per farmer across 4 active counters.</div>
                  <div>• <strong>Current Delay:</strong> {centreState.delayMinutes > 0 ? `${centreState.delayMinutes} minutes recorded by centre officer due to heavy intake.` : '0 minutes (operations running on schedule).'}</div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#7a8d98', fontStyle: 'italic' }}>
                  Formula: ETA = (Farmers Ahead × Processing Rate) + Current Delay. Backend recalculation broadcasts instantly when conditions change.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Digital Token Side Panel */}
        <section className="panel engine-side">
          <div className="eyebrow teal"><ShieldCheck size={14} /> AUTHORITATIVE DIGITAL TOKEN</div>
          <h2 style={{ fontSize: '32px', margin: '12px 0 6px', color: '#12304a', fontWeight: 800 }}>
            {state.token}
          </h2>
          <p style={{ margin: '0 0 12px', color: '#52636f' }}>
            {state.centre}
            <br />
            Arrival window: <strong>{arrivalWindow}</strong> ({todayFormatted})
          </p>
          <span className={`status-pill ${state.delayMinutes ? 'warning' : 'success'}`}>
            {state.delayMinutes ? 'Window updated (+15m)' : 'Booking confirmed'}
          </span>

          <div className="input-list">
            <span><Check size={14} /> #{state.ahead + 1} position in centre queue</span>
            <span><Check size={14} /> {state.ahead} farmers currently ahead</span>
            <span><Check size={14} /> Live ETA synchronised with Smart Queue Engine</span>
            <span><Check size={14} /> Socket.IO realtime updates active</span>
          </div>
        </section>
      </div>

      {/* Procurement Journey Timeline */}
      <section className="panel timeline-panel" style={{ marginTop: '20px' }}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">PROCUREMENT JOURNEY</div>
            <h2>{i18n.journeyTitle}</h2>
          </div>
          <span className="status-pill info">Token {state.token}</span>
        </div>

        <div className="timeline">
          <div className="timeline-item complete">
            <div className="timeline-dot"><Check size={13} /></div>
            <div><b>Booking confirmed</b><span>Slot: {arrivalWindow}</span></div>
          </div>
          <div className={`timeline-item ${state.stage !== 'Procurement completed' ? 'complete' : ''}`}>
            <div className="timeline-dot"><Check size={13} /></div>
            <div><b>Queue active</b><span>{state.ahead} ahead</span></div>
          </div>
          <div className={`timeline-item ${state.stage === 'Produce verification' || state.stage === 'Procurement completed' ? 'complete' : ''}`}>
            <div className="timeline-dot">{state.stage === 'Produce verification' ? <Activity size={13} /> : null}</div>
            <div><b>Produce verification</b><span>Moisture &amp; quality check</span></div>
          </div>
          <div className={`timeline-item ${state.stage === 'Procurement completed' ? 'complete' : ''}`}>
            <div className="timeline-dot">{state.stage === 'Procurement completed' ? <Check size={13} /> : null}</div>
            <div><b>Weighing &amp; unloading</b><span>Electronic weighbridge</span></div>
          </div>
          <div className={`timeline-item ${state.stage === 'Procurement completed' ? 'complete' : ''}`}>
            <div className="timeline-dot">{state.stage === 'Procurement completed' ? <Check size={13} /> : null}</div>
            <div><b>Procurement completed</b><span>Digital receipt generated</span></div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot"><TrendingUp size={13} /></div>
            <div><b>Payment processing</b><span>Direct Benefit Transfer (DBT)</span></div>
          </div>
        </div>
      </section>
    </div>
  )
}
