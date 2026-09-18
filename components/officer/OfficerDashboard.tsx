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
  Globe,
} from 'lucide-react'
import { calculateCentreLoad, calculateETA, getAlternativeCentre, getCentreStatus } from '@/lib/smartQueueEngine'
import { translations, Language } from '@/lib/i18n'

interface OfficerDashboardProps {
  officerUser: any
  officerToken: string | null
  state: any
  onUpdateState: (next: any) => void
  onConditionUpdated?: () => void
  language?: Language
  onLanguageChange?: (lang: Language) => void
}

export default function OfficerDashboard({
  officerUser,
  officerToken,
  state,
  onUpdateState,
  onConditionUpdated,
  language = 'en',
  onLanguageChange,
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

  const t = translations[language] || translations.en
  const o = t.officerDashboard

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
  }, [assignedCentreId, officerToken])

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

  // Update operational conditions
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
        language === 'mr'
          ? `स्थिती अद्ययावत केली: गती ${newRate} मि./शेतकरी निश्चित केली. स्मार्ट क्यू इंजिनने रांगेची फेरगणना करून थेट प्रक्षेपित केले.`
          : language === 'hi'
          ? `परिस्थितियां अपडेट की गईं: गति ${newRate} मिनट/किसान तय की गई। स्मार्ट क्यू इंजन ने पुनर्गणना कर प्रसारित किया।`
          : `Conditions updated: Rate set to ${newRate} min/farmer. Smart Queue Engine recalculated and broadcasted to farmers via Socket.IO.`
      )

      onUpdateState({
        ...state,
        processingMinutes: newRate,
        delayMinutes,
        capacity: data.centre?.calculatedLoadPercent ?? calculatedLoad,
        notices: [
          {
            id: Date.now(),
            text: language === 'mr'
              ? `अधिकाऱ्यांनी ${centreData?.name || 'नाशिक केंद्र'} येथे मोजमाप स्थिती अपडेट केली (गती: ${newRate} मि.).`
              : language === 'hi'
              ? `अधिकारी ने ${centreData?.name || 'नासिक केंद्र'} पर परिचालन स्थितियां अपडेट कीं (दर: ${newRate} मिनट)।`
              : `Officer updated processing conditions at ${centreData?.name || 'Nashik Centre'} (Rate: ${newRate}m).`,
            audience: 'all' as const,
            time: 'Just now',
          },
          ...state.notices,
        ],
      })

      if (onConditionUpdated) {
        onConditionUpdated()
      }
    } catch (err: any) {
      setActionError(err.message || 'Error updating centre operational conditions')
    } finally {
      setUpdatingCondition(false)
    }
  }

  // Update single booking lifecycle status
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
        const data = await res.json()
        throw new Error(data.error || `Failed to update status to ${status}`)
      }

      await fetchLiveCentreAndQueue()

      onUpdateState({
        ...state,
        notices: [
          {
            id: Date.now(),
            text: noticeText,
            audience: 'all' as const,
            time: 'Just now',
          },
          ...state.notices,
        ],
      })
    } catch (err: any) {
      setActionError(err.message || 'Failed to update booking status')
    }
  }

  // Advance current processing booking to COMPLETED
  const handleCompleteProcurement = async () => {
    const activeBooking = activeBookings.find((b: any) => b.status === 'PROCESSING') || activeBookings[0]
    if (activeBooking && activeBooking.id) {
      await updateBookingStatus(
        activeBooking.id,
        'COMPLETED',
        `Token ${activeBooking.tokenNumber} completed procurement process.`
      )
    } else {
      const completedToken = state.token
      onUpdateState({
        ...state,
        stage: 'Procurement completed',
        currentToken: completedToken,
        notices: [
          {
            id: Date.now(),
            text: language === 'mr'
              ? `टोकन ${completedToken} खरेदी प्रक्रिया यशस्वीरीत्या पूर्ण झाली!`
              : language === 'hi'
              ? `टोकन ${completedToken} की खरीद प्रक्रिया सफलतापूर्वक पूरी हुई!`
              : `Token ${completedToken} completed procurement successfully!`,
            audience: 'all' as const,
            time: 'Just now',
          },
          ...state.notices,
        ],
      })
    }
  }

  // Call Next Farmer
  const handleCallNextFarmer = async () => {
    const waitingBooking = activeBookings.find((b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING')
    if (waitingBooking && waitingBooking.id) {
      await updateBookingStatus(
        waitingBooking.id,
        'PROCESSING',
        `Token ${waitingBooking.tokenNumber} called to Counter 2 for produce verification.`
      )
    } else {
      onUpdateState({
        ...state,
        ahead: Math.max(0, state.ahead - 1),
        notices: [
          {
            id: Date.now(),
            text: language === 'mr'
              ? `पुढील टोकन तपासणीसाठी बोलावले गेले. रांग पुढे सरकली.`
              : language === 'hi'
              ? `अगला टोकन जांच के लिए बुलाया गया। कतार आगे बढ़ी।`
              : 'Next token called forward for produce verification. Queue advanced.',
            audience: 'all' as const,
            time: 'Just now',
          },
          ...state.notices,
        ],
      })
    }
  }

  // Mark token as MISSED
  const handleMarkMissed = async () => {
    const candidate = activeBookings.find((b: any) => b.status === 'PROCESSING' || b.status === 'CONFIRMED')
    if (candidate && candidate.id) {
      await updateBookingStatus(
        candidate.id,
        'MISSED',
        `Token ${candidate.tokenNumber} marked as missed. Recovery slot enabled.`
      )
    } else {
      onUpdateState({
        ...state,
        missed: true,
        notices: [
          {
            id: Date.now(),
            text: language === 'mr'
              ? `टोकन अनुपस्थित नोंदवले गेले. स्मार्ट क्यू इंजिनने रिकव्हरी स्लॉट उपलब्ध केला.`
              : language === 'hi'
              ? `टोकन अनुपस्थित दर्ज किया गया। स्मार्ट क्यू इंजन ने रिकवरी स्लॉट सक्रिय किया।`
              : 'Token marked as missed. Smart Queue Engine opened prioritized recovery slot.',
            audience: 'all' as const,
            time: 'Just now',
          },
          ...state.notices,
        ],
      })
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
            <b>{language === 'mr' ? 'थेट प्रसारण सक्रिय:' : language === 'hi' ? 'लाइव प्रसारण सक्रिय:' : 'Operational Broadcast Active:'}</b>
            <span>{conditionSuccessMessage}</span>
          </div>
        </div>
      )}

      {/* Congestion warning if high load */}
      {calculatedLoad >= 80 && (
        <div className="inline-alert warning" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={17} />
          <div>
            <b>{language === 'mr' ? '⚠ रांग गर्दी इशारा:' : language === 'hi' ? '⚠ कतार भीड़ चेतावनी:' : '⚠ QUEUE CONGESTION ALERT:'}</b>
            <span>
              {language === 'mr'
                ? `केंद्राचा भार सध्या जास्त आहे (${calculatedLoad}% क्षमता). पर्यायी केंद्र शिफारस: ${alternative}.`
                : language === 'hi'
                ? `केंद्र का कार्यभार वर्तमान में अधिक है (${calculatedLoad}% क्षमता लोड)। अनुशंसित विकल्प: ${alternative}।`
                : `Centre workload is currently high (${calculatedLoad}% capacity load). Recommended alternative: ${alternative}.`}
            </span>
          </div>
        </div>
      )}

      {/* Officer Header */}
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            {language === 'mr' ? 'खरेदी केंद्र नियंत्रण कक्ष' : language === 'hi' ? 'खरीद केंद्र नियंत्रण कक्ष' : 'PROCUREMENT CENTRE CONTROL'}{' '}
            <span className="live-dot" /> {language === 'mr' ? 'थेट कामकाज' : language === 'hi' ? 'लाइव परिचालन' : 'Real-time operations'}
          </div>
          <h1 style={{ color: '#12304a', fontSize: '26px' }}>
            {centreData?.name || state.centre}
          </h1>
          <p className="subtle">
            <MapPin size={14} /> {language === 'mr' ? 'अधिकारी' : language === 'hi' ? 'अधिकारी' : 'Officer'}: <strong>{officerUser?.name || 'Suresh Patil'}</strong> · {language === 'mr' ? 'स्थान' : language === 'hi' ? 'स्थान' : 'Location'}: {centreData?.location || 'Nashik District'}
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
          <button className="button outline small" onClick={fetchLiveCentreAndQueue} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {o.refreshQueue}
          </button>
          <span className="status-pill success">{language === 'mr' ? 'थेट / सुरू' : language === 'hi' ? 'लाइव / सक्रिय' : 'LIVE / OPERATIONAL'}</span>
        </div>
      </div>

      {/* Officer KPI Row (Real Backend Data) */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-top"><span>{o.activeQueue.toUpperCase()}</span><Users size={17} /></div>
          <strong>{currentQueue} {language === 'mr' ? 'शेतकरी' : language === 'hi' ? 'किसान' : 'farmers'}</strong>
          <small>{o.waiting}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>{o.processingSpeed.replace(':', '').toUpperCase()}</span><Clock3 size={17} /></div>
          <strong className="info">{currentRate} {o.minPerFarmer}</strong>
          <small>~{Math.round(60 / (currentRate || 1))} {language === 'mr' ? 'शेतकरी/तास' : language === 'hi' ? 'किसान/घंटा' : 'farmers/hour'}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>{o.dailyCapacity.toUpperCase()}</span><Gauge size={17} /></div>
          <strong>{dailyCapacity}</strong>
          <small>{language === 'mr' ? 'दररोजचे एकूण स्लॉट' : language === 'hi' ? 'प्रति दिन कुल स्लॉट' : 'Total slots per day'}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>{o.centreLoad.toUpperCase()}</span><Activity size={17} /></div>
          <strong className={calculatedLoad >= 80 ? 'warning' : 'success'}>
            {calculatedLoad}%
          </strong>
          <small>{centreLoadStatus}</small>
        </div>

        <div className="metric-card">
          <div className="metric-top"><span>{o.expectedWait.toUpperCase()}</span><Clock3 size={17} /></div>
          <strong>{expectedWaitMinutes} {language === 'mr' ? 'मि.' : language === 'hi' ? 'मिनट' : 'min'}</strong>
          <small>{language === 'mr' ? 'शेवटचे रांग स्थान' : language === 'hi' ? 'अंतिम कतार स्थिति' : 'Last queue position'}</small>
        </div>
      </div>

      {/* Main Control Grid */}
      <div className="officer-grid">
        {/* Live Queue Management Table */}
        <section className="panel queue-table-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{o.liveControlRoom.toUpperCase()}</div>
              <h2>{o.liveQueueHeading}</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="button outline small"
                onClick={handleMarkMissed}
                title={language === 'mr' ? 'अनुपस्थित नोंदवा' : language === 'hi' ? 'अनुपस्थित दर्ज करें' : 'Mark current token as missed'}
              >
                {language === 'mr' ? 'अनुपस्थित नोंदवा' : language === 'hi' ? 'अनुपस्थित दर्ज करें' : 'Mark Missed'}
              </button>
              <button
                id="officer-call-next-btn"
                className="button dark small"
                onClick={handleCallNextFarmer}
              >
                <ArrowRight size={14} /> {language === 'mr' ? 'पुढील शेतकऱ्याला बोलवा' : language === 'hi' ? 'अगले किसान को बुलाएं' : 'Call Next Farmer'}
              </button>
            </div>
          </div>

          <div className="data-table">
            <div className="table-head">
              <span>{o.tableToken}</span>
              <span>{o.tableFarmer}</span>
              <span>{o.tableSlot}</span>
              <span>{o.tableStatus}</span>
              <span>{o.tableEta}</span>
              <span>{o.tableActions}</span>
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
                          {o.completeProcurement}
                        </button>
                      ) : (
                        <button
                          className="button outline small"
                          style={{ height: '24px', fontSize: '10px', padding: '0 6px' }}
                          onClick={() => updateBookingStatus(b.id, 'PROCESSING', `Called ${b.tokenNumber}`)}
                        >
                          {language === 'mr' ? 'बोलवा' : language === 'hi' ? 'बुलाएं' : 'Call'}
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
                      {language === 'mr' ? 'सुरू करा' : language === 'hi' ? 'शुरू करें' : 'Process'}
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="condition-actions" style={{ marginTop: '16px' }}>
            <button onClick={() => onUpdateState({ ...state, stage: 'Produce verification' })}>
              {o.markPresent}
            </button>
            <button onClick={handleCompleteProcurement}>
              {o.completeProcurement}
            </button>
          </div>
        </section>

        {/* Centre Conditions Control */}
        <section className="panel conditions" id="officer-centre-conditions-panel">
          <div className="eyebrow teal">
            <Zap size={14} /> {o.centreConditions}
          </div>
          <h2>{o.liveControlRoom}</h2>
          <p style={{ fontSize: '11px', color: '#687882', margin: '0 0 16px', lineHeight: 1.5 }}>
            {language === 'mr'
              ? `या स्थिती बदलल्याने स्मार्ट क्यू इंजिन सर्व शेतकऱ्यांच्या आगमन वेळेची फेरगणना करते आणि सॉकेटद्वारे थेट प्रसारित करते.`
              : language === 'hi'
              ? `इन परिस्थितियों को बदलने पर स्मार्ट क्यू इंजन सभी किसानों के आगमन समय की पुनर्गणना करता है और सॉकेट के माध्यम से प्रसारित करता है।`
              : `Adjusting these conditions calls PATCH /api/centres/${assignedCentreId.slice(0, 8)}. The Smart Queue Engine recalculates all farmer arrival windows and broadcasts via Socket.IO.`}
          </p>

          <div className="condition">
            <span>{o.processingSpeed}</span>
            <b>{selectedRate} {o.minPerFarmer}</b>
            <em><i style={{ width: `${Math.min(100, selectedRate * 8)}%` }} /></em>
          </div>

          <div className="condition">
            <span>{language === 'mr' ? 'सध्याची विलंब स्थिती:' : language === 'hi' ? 'वर्तमान विलंब स्थिति:' : 'Current Delay Status:'}</span>
            <b className={isDelayed ? 'warning-text' : ''}>
              {isDelayed ? o.delayActive : o.onSchedule}
            </b>
          </div>

          <div style={{ margin: '18px 0 12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#12304a', display: 'block', marginBottom: '8px' }}>
              {language === 'mr' ? 'मोजमाप गती प्रीसेट निवडा:' : language === 'hi' ? 'प्रसंस्करण गति प्रीसेट चुनें:' : 'Select Processing Speed Preset:'}
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                { rate: 5.25, label: `5.25m (${language === 'mr' ? 'जलद' : language === 'hi' ? 'तेज' : 'Fast'} / 11/hr)` },
                { rate: 7.0, label: `7.0m (${language === 'mr' ? 'मध्यम' : language === 'hi' ? 'मध्यम' : 'Moderate'} / 8/hr)` },
                { rate: 11.0, label: `11.0m (${language === 'mr' ? 'हळू' : language === 'hi' ? 'धीमा' : 'Slow'} / 5/hr)` },
                { rate: 15.0, label: `15.0m (${language === 'mr' ? 'सखोल तपासणी' : language === 'hi' ? 'सघन जांच' : 'Heavy Check'})` },
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
              {o.simDelayCheckbox}
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
                <RefreshCw size={14} className="animate-spin" /> {o.updating}
              </>
            ) : (
              <>
                <Zap size={14} /> {o.updateConditionsBtn}
              </>
            )}
          </button>

          {/* Smart Queue Engine Panel */}
          <div style={{ marginTop: '20px', padding: '12px', background: '#f5fbfb', border: '1px solid #d5e5e4', borderRadius: '5px' }}>
            <div className="eyebrow teal" style={{ fontSize: '9px', marginBottom: '4px' }}>
              {language === 'mr' ? 'स्मार्ट क्यू इंजिन' : language === 'hi' ? 'स्मार्ट क्यू इंजन' : 'SMART QUEUE ENGINE'}
            </div>
            <div style={{ fontSize: '11px', color: '#385563', lineHeight: 1.5 }}>
              <div>• {o.centreLoad}: <strong>{calculatedLoad}%</strong></div>
              <div>• {o.activeQueue}: <strong>{currentQueue} {language === 'mr' ? 'शेतकरी' : language === 'hi' ? 'किसान' : 'farmers'}</strong></div>
              <div>• {o.processingSpeed.replace(':', '')}: <strong>{currentRate} {language === 'mr' ? 'मि.' : language === 'hi' ? 'मिनट' : 'min'}</strong></div>
              <div>• {language === 'mr' ? 'विलंब' : language === 'hi' ? 'विलंब' : 'Delay'}: <strong>{isDelayed ? '15 min' : '0 min'}</strong></div>
              <div>• {language === 'mr' ? 'स्थिती' : language === 'hi' ? 'स्थिति' : 'Status'}: <strong>{centreLoadStatus}</strong></div>
            </div>
            <small style={{ display: 'block', marginTop: '6px', color: '#7a8e97', fontSize: '10px' }}>
              {o.ruleBasedActive} · Authoritative server calculation
            </small>
          </div>
        </section>
      </div>
    </div>
  )
}
