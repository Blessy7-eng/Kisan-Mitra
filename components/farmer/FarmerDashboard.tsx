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
  Info,
  XCircle,
} from 'lucide-react'
import { calculateCentreLoad, calculateETA, handleMissedSlot } from '@/lib/smartQueueEngine'
import { Language, maskPhoneNumber, translations } from '@/lib/i18n'

interface FarmerDashboardProps {
  farmerName: string
  farmerPhone: string
  state: any
  onBookSlot: () => void
  onDelayToggle?: () => void
  onRecoverSlot: () => void
  onCancelBooking?: (bookingId?: string) => Promise<void> | void
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
  onCancelBooking,
  lastEtaChangeNotice,
  language,
  onLanguageChange,
}: FarmerDashboardProps) {
  const [showWhyEta, setShowWhyEta] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const t = translations[language] || translations.en
  const f = t.farmerDashboard

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
  const todayFormatted = new Date().toLocaleDateString(
    language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  )

  const handleConfirmCancel = async () => {
    if (cancelling) return
    setCancelling(true)
    try {
      if (onCancelBooking) {
        await onCancelBooking(state.bookingId)
      }
      setShowCancelModal(false)
    } finally {
      setCancelling(false)
    }
  }

  // Loading State
  if (state.bookingLoading) {
    return (
      <div className="farmer-dashboard-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <RefreshCw size={32} className="animate-spin text-teal-600" style={{ margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#12304a', marginBottom: '8px' }}>
          {language === 'mr' ? 'आपली बुकिंग लोड होत आहे…' : language === 'hi' ? 'आपकी बुकिंग लोड हो रही है…' : 'Loading your booking…'}
        </h2>
        <p style={{ color: '#607282', fontSize: '13px' }}>
          {language === 'mr'
            ? 'कृषी उत्पन्न बाजार समिती सर्व्हरवरून अधिकृत टोकन आणि रांगेची माहिती मिळवत आहे.'
            : language === 'hi'
            ? 'मंडी सर्वर से आधिकारिक टोकन और कतार की जानकारी प्राप्त की जा रही है।'
            : 'Fetching authoritative token and queue information from APMC servers.'}
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
              {language === 'mr' ? 'शेतकरी पोर्टल' : language === 'hi' ? 'किसान पोर्टल' : 'FARMER PORTAL'}{' '}
              <span className="live-dot" /> {f.liveQueueStatus}
            </div>
            <h1>
              {f.welcome}, {farmerName ? farmerName.split(' ')[0] : (language === 'mr' ? 'शेतकरी बंधू' : language === 'hi' ? 'किसान मित्र' : 'Farmer')}
            </h1>
            <p className="subtle">
              {maskedPhone} · {t.tagline}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="button primary" onClick={onBookSlot} id="farmer-empty-book-top-btn">
              {f.bookSlot} <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Empty State Banner */}
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
            {f.notBooked}
          </h2>
          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '24px' }}>
            {f.noActiveToken}
          </p>
          <button
            className="button primary"
            onClick={onBookSlot}
            id="farmer-empty-state-book-btn"
            style={{ padding: '12px 24px', fontSize: '15px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {f.bookSlot} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    )
  }

  const quickActionItems = [
    { label: f.bookSlot, detail: f.findBest, icon: Clock3, action: onBookSlot, primary: true },
    { label: f.tokenNumber, detail: `${state.token} · ${f.bookingConfirmed}`, icon: ShieldCheck },
    { label: f.liveQueueStatus, detail: `${state.ahead} ${f.farmersAhead}`, icon: Users },
    { label: f.procStatus, detail: state.stage === 'Procurement completed' ? f.stageProcCompleted : f.stageProduceVerification, icon: Activity },
  ]

  const progress = Math.min(88, 44 + state.ahead * 3)

  return (
    <div className="farmer-dashboard-container">
      {/* Real-time ETA Change Notification */}
      {lastEtaChangeNotice && (
        <div className="inline-alert info" style={{ marginBottom: '16px', background: '#eef7f7', borderColor: '#b3dedb' }}>
          <RefreshCw size={16} className="animate-spin text-teal-600" />
          <div>
            <b>{language === 'mr' ? 'थेट रांग फेरगणना:' : language === 'hi' ? 'लाइव कतार पुनर्गणना:' : 'Live Queue Recalculation:'}</b>
            <span>{lastEtaChangeNotice}</span>
          </div>
        </div>
      )}

      {/* Missed Slot Recovery Alert */}
      {state.missed && (
        <div className="inline-alert warning" style={{ marginBottom: '18px' }}>
          <AlertTriangle size={17} />
          <div>
            <b>{language === 'mr' ? 'आपला स्लॉट चुकला आहे का?' : language === 'hi' ? 'क्या आप���ा स्लॉट छूट गया?' : 'Missed your procurement slot?'}</b>
            <span>
              {language === 'mr'
                ? `स्मार्ट क्यू इंजिनने ${recovery.centre} येथे ${recovery.slot} साठी रिकव्हरी स्लॉट शोधला आहे. अंदाजे प्रतीक्षा: ${recovery.wait} मिनिटे.`
                : language === 'hi'
                ? `स्मार्ट क्यू इंजन ने ${recovery.centre} पर ${recovery.slot} के लिए रिकवरी स्लॉट खोजा है। अनुमानित प्रतीक्षा: ${recovery.wait} मिनट।`
                : `Smart Queue Engine found a recovery window at ${recovery.centre} for ${recovery.slot}. Estimated wait: ${recovery.wait} minutes.`}
            </span>
          </div>
          <button className="button primary small" onClick={onRecoverSlot}>
            {language === 'mr' ? 'रिकव्हरी स्लॉट निश्चित करा' : language === 'hi' ? 'रिकवरी स्लॉट चुनें' : 'Confirm recovery slot'}
          </button>
        </div>
      )}

      {/* Top Welcome Row */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            {language === 'mr' ? 'शेतकरी पोर्टल' : language === 'hi' ? 'किसान पोर्टल' : 'FARMER PORTAL'}{' '}
            <span className="live-dot" /> {f.liveQueueStatus}
          </div>
          <h1>
            {f.welcome}, {farmerName ? farmerName.split(' ')[0] : (language === 'mr' ? 'शेतकरी बंधू' : language === 'hi' ? 'किसान मित्र' : 'Farmer')}
          </h1>
          <p className="subtle">
            <MapPin size={14} /> {state.centre} · {maskedPhone} · {t.tagline}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="button primary" onClick={onBookSlot} id="farmer-book-slot-top-btn">
            {f.bookSlot} <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <section className="farmer-quick-actions">
        <div className="quick-actions-head">
          <div>
            <div className="eyebrow">{language === 'mr' ? 'आपल्यासाठी जलद पर्याय' : language === 'hi' ? 'त्वरित सेवाएं' : 'WHAT WOULD YOU LIKE TO DO?'}</div>
            <h2>{f.quickActions}</h2>
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
          {/* Cancel Booking Quick Action Button */}
          <button
            className="quick-action"
            onClick={() => setShowCancelModal(true)}
            id="farmer-quick-action-cancel"
            style={{ border: '1px solid #fecaca', background: '#fff5f5' }}
          >
            <span className="quick-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <XCircle size={20} />
            </span>
            <span>
              <b style={{ color: '#b91c1c' }}>{f.cancelBooking}</b>
              <small style={{ color: '#ef4444' }}>{f.keepBookingBtn ? f.keepBookingBtn : 'Release token'}</small>
            </span>
            <ArrowRight size={15} style={{ color: '#dc2626' }} />
          </button>
        </div>
      </section>

      {/* KPI Metrics Row */}
      <div className="metrics-grid farmer-metrics">
        <div className="metric-card primary-kpi">
          <div className="metric-top"><span>{f.howLong}</span><Gauge size={17} /></div>
          <strong className={state.delayMinutes ? 'warning' : 'primary-eta'}>
            {backendEta} {f.minutes}
          </strong>
          <small>{state.delayMinutes ? f.delayRecorded : f.calculatedBy}</small>
        </div>

        <div className="metric-card primary-kpi">
          <div className="metric-top"><span>{f.arrWindow}</span><Clock3 size={17} /></div>
          <strong>{arrivalWindow}</strong>
          <small>{todayFormatted} · {f.windowDesc}</small>
        </div>

        <div className="metric-card primary-kpi">
          <div className="metric-top"><span>{f.tokenNumber}</span><ShieldCheck size={17} /></div>
          <strong className="success-token">{state.token}</strong>
          <small>{state.centre} · {f.authoritativeToken}</small>
        </div>

        <div className="metric-card primary-kpi">
          <div className="metric-top"><span>{f.positionInQueue}</span><Users size={17} /></div>
          <strong className="info">#{state.ahead + 1} {f.inQueue}</strong>
          <small>{state.ahead} {f.farmersAhead}</small>
        </div>
      </div>

      {/* Main Grid: Queue View & Token Card */}
      <div className="content-grid farmer-main">
        {/* Queue Rail Panel */}
        <section className="panel queue-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">
                {f.liveQueueStatus} <span className="live-dot" /> {f.smartQueueEngine}
              </div>
              <h2>{f.liveQueueStatus}</h2>
            </div>
            <span className="status-pill success">{todayFormatted}</span>
          </div>

          {/* Interactive Queue Rail */}
          <div className="queue-rail-wrap">
            <div className="queue-rail-labels">
              <span>{f.completed} ({state.currentToken})</span>
              <span>{f.processingActive}</span>
              <span>{f.yourToken} ({state.token})</span>
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
              <span className="processing-text">{f.countersActive}</span>
              <span className="your-text">{state.token} · {backendEta} {f.minutes} wait</span>
            </div>
          </div>

          {/* ETA & Arrival Window Details */}
          <div className="eta-row">
            <div className="eta-card">
              <span>{f.howLong}</span>
              <strong>{backendEta} <small>{f.minutes}</small></strong>
              <span className={state.delayMinutes ? 'warning-text' : 'success-text'}>
                {state.delayMinutes ? f.delayRecordedAtCentre : f.onTrack}
              </span>
            </div>
            <div className="appointment-card">
              <span>{f.arrWindow}</span>
              <strong>{arrivalWindow}</strong>
              <span>{f.tokenNumber}: <b>{state.token}</b> · {todayFormatted}</span>
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
                {f.whyEta} {f.ruleBasedIntelligence}
              </span>
              {showWhyEta ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showWhyEta && (
              <div style={{ padding: '12px 14px', background: '#ffffff', border: '1px solid #e2e9ec', borderTop: '0', borderRadius: '0 0 6px 6px', fontSize: '11px', color: '#4a5b67', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#12304a' }}>
                  {f.etaExplanation} <strong>{backendEta} {f.minutes}</strong>:
                </p>
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div>• <strong>{f.farmersAheadLabel}</strong> {state.ahead} {f.farmersAhead}</div>
                  <div>• <strong>{f.processingRateLabel}</strong> {centreState.processingMinutes} {f.minPerFarmer}</div>
                  <div>• <strong>{f.currentDelayLabel}</strong> {centreState.delayMinutes > 0 ? `${centreState.delayMinutes} ${f.delayMinutesRecorded}` : f.noDelay}</div>
                </div>
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#7a8d98', fontStyle: 'italic' }}>
                  {f.etaFormula}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Digital Token Side Panel */}
        <section className="panel engine-side">
          <div className="eyebrow teal"><ShieldCheck size={14} /> {f.digitalTokenTitle}</div>
          <h2 style={{ fontSize: '32px', margin: '12px 0 6px', color: '#12304a', fontWeight: 800 }}>
            {state.token}
          </h2>
          <p style={{ margin: '0 0 12px', color: '#52636f' }}>
            {state.centre}
            <br />
            {f.arrWindow}: <strong>{arrivalWindow}</strong> ({todayFormatted})
          </p>
          <span className={`status-pill ${state.delayMinutes ? 'warning' : 'success'}`}>
            {state.delayMinutes ? f.windowUpdated : f.bookingConfirmed}
          </span>

          <div className="input-list">
            <span><Check size={14} /> #{state.ahead + 1} {f.positionInQueue}</span>
            <span><Check size={14} /> {state.ahead} {f.farmersCurrentlyAhead}</span>
            <span><Check size={14} /> {f.liveEtaSync}</span>
            <span><Check size={14} /> {f.realtimeActive}</span>
          </div>

          {/* Option to Cancel Booking */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button
              type="button"
              className="button outline full"
              onClick={() => setShowCancelModal(true)}
              id="farmer-cancel-booking-btn"
              style={{
                color: '#b91c1c',
                borderColor: '#fca5a5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontWeight: 600,
              }}
            >
              <XCircle size={16} /> {f.cancelBooking}
            </button>
          </div>
        </section>
      </div>

      {/* Procurement Journey Timeline */}
      <section className="panel timeline-panel" style={{ marginTop: '20px' }}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{f.procJourney}</div>
            <h2>{f.journeyTitle}</h2>
          </div>
          <span className="status-pill info">{f.tokenNumber} {state.token}</span>
        </div>

        <div className="timeline">
          <div className="timeline-item complete">
            <div className="timeline-dot"><Check size={13} /></div>
            <div><b>{f.stageBookingConfirmed}</b><span>{f.arrWindow}: {arrivalWindow}</span></div>
          </div>
          <div className={`timeline-item ${state.stage !== 'Procurement completed' ? 'complete' : ''}`}>
            <div className="timeline-dot"><Check size={13} /></div>
            <div><b>{f.stageQueueActive}</b><span>{state.ahead} {f.farmersAhead}</span></div>
          </div>
          <div className={`timeline-item ${state.stage === 'Produce verification' || state.stage === 'Procurement completed' ? 'complete' : ''}`}>
            <div className="timeline-dot">{state.stage === 'Produce verification' ? <Activity size={13} /> : null}</div>
            <div><b>{f.stageProduceVerification}</b><span>{f.stageProduceVerificationDesc}</span></div>
          </div>
          <div className={`timeline-item ${state.stage === 'Procurement completed' ? 'complete' : ''}`}>
            <div className="timeline-dot">{state.stage === 'Procurement completed' ? <Check size={13} /> : null}</div>
            <div><b>{f.stageWeighing}</b><span>{f.stageWeighingDesc}</span></div>
          </div>
          <div className={`timeline-item ${state.stage === 'Procurement completed' ? 'complete' : ''}`}>
            <div className="timeline-dot">{state.stage === 'Procurement completed' ? <Check size={13} /> : null}</div>
            <div><b>{f.stageProcCompleted}</b><span>{f.stageProcCompletedDesc}</span></div>
          </div>
          <div className="timeline-item">
            <div className="timeline-dot"><TrendingUp size={13} /></div>
            <div><b>{f.stagePayment}</b><span>{f.stagePaymentDesc}</span></div>
          </div>
        </div>
      </section>

      {/* Cancel Booking Confirmation Modal */}
      {showCancelModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-icon-wrap warning" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ color: '#1e293b' }}>{f.cancelBookingConfirmTitle}</h3>
                <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '12px' }}>
                  {f.tokenNumber}: <b>{state.token}</b> ({arrivalWindow})
                </p>
              </div>
            </div>
            <p className="modal-body-text" style={{ color: '#475569', fontSize: '13px', lineHeight: 1.6 }}>
              {f.cancelBookingConfirmDesc}
            </p>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="button outline"
                disabled={cancelling}
                onClick={() => setShowCancelModal(false)}
              >
                {f.keepBookingBtn}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={cancelling}
                onClick={handleConfirmCancel}
                id="farmer-confirm-cancel-modal-btn"
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
              >
                {cancelling ? f.cancelling : f.cancelBookingConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
