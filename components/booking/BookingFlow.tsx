'use client'

import React, { useState, useEffect } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  ShieldCheck,
  Sparkles,
  Wheat,
  AlertTriangle,
  RefreshCw,
  Globe,
} from 'lucide-react'
import { translations, Language } from '@/lib/i18n'

interface BookingFlowProps {
  farmerToken: string | null
  onBack: () => void
  onBookingSuccess: (booking: any) => void
  language?: Language
  onLanguageChange?: (lang: Language) => void
}

export default function BookingFlow({
  farmerToken,
  onBack,
  onBookingSuccess,
  language = 'en',
  onLanguageChange,
}: BookingFlowProps) {
  const [step, setStep] = useState<number>(1)
  const [centres, setCentres] = useState<any[]>([])
  const [loadingCentres, setLoadingCentres] = useState(false)
  const [centreError, setCentreError] = useState<string | null>(null)

  const [selectedCentre, setSelectedCentre] = useState<any | null>(null)
  const [selectedProduce, setSelectedProduce] = useState<string>('Wheat')
  const [quantityKg, setQuantityKg] = useState<number>(1000)

  const [slots, setSlots] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const isSubmittingRef = React.useRef(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null)

  const t = translations[language] || translations.en
  const bf = t.bookingFlow

  // 1. Fetch real centres
  useEffect(() => {
    async function loadCentres() {
      setLoadingCentres(true)
      setCentreError(null)
      try {
        const res = await fetch('/api/centres')
        const data = await res.json()
        if (res.ok && Array.isArray(data.centres)) {
          setCentres(data.centres)
          if (data.centres.length > 0) {
            setSelectedCentre(data.centres[0])
          }
        } else {
          throw new Error(data.error || 'Failed to fetch procurement centres')
        }
      } catch (err: any) {
        setCentreError(err.message || 'Unable to load centres')
      } finally {
        setLoadingCentres(false)
      }
    }
    loadCentres()
  }, [])

  // 2. Fetch real slots when selectedCentre changes
  useEffect(() => {
    if (!selectedCentre?.id) return
    async function loadSlots() {
      setLoadingSlots(true)
      try {
        const res = await fetch(`/api/centres/${selectedCentre.id}/slots`, {
          headers: farmerToken ? { Authorization: `Bearer ${farmerToken}` } : {},
        })
        const data = await res.json()
        if (res.ok && Array.isArray(data.slots)) {
          setSlots(data.slots)
          const firstOpen = data.slots.find((s: any) => !s.isFull) || data.slots[0]
          setSelectedSlot(firstOpen || null)
        }
      } catch (err) {
        console.warn('Error loading slots:', err)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [selectedCentre?.id, farmerToken])

  // 3. Submit booking to POST /api/bookings
  const handleConfirmBooking = async () => {
    if (!selectedCentre || !selectedSlot) {
      setBookingError(
        language === 'mr'
          ? 'कृपया खरेदी केंद्र आणि वेळ स्लॉट दोन्ही निवडा.'
          : language === 'hi'
          ? 'कृपया खरीद केंद्र और समय स्लॉट दोनों चुनें।'
          : 'Please select both a procurement centre and an arrival slot.'
      )
      return
    }

    // Prevent double submission / simultaneous clicks
    if (submitting || isSubmittingRef.current) return
    isSubmittingRef.current = true
    setSubmitting(true)
    setBookingError(null)

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(farmerToken ? { Authorization: `Bearer ${farmerToken}` } : {}),
        },
        body: JSON.stringify({
          centreId: selectedCentre.id,
          slotId: selectedSlot.id,
          produceType: selectedProduce,
          quantity: quantityKg,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Unable to complete slot booking')
      }

      setConfirmedBooking(data.booking)
      onBookingSuccess(data.booking)
    } catch (err: any) {
      setBookingError(err.message || 'Error communicating with booking server')
      isSubmittingRef.current = false
    } finally {
      setSubmitting(false)
    }
  }

  const produceList = [
    {
      id: 'Wheat',
      name: language === 'mr' ? 'गहू' : language === 'hi' ? 'गेहूं' : 'Wheat',
      variety: language === 'mr' ? 'शरबती / लोकवान' : language === 'hi' ? 'शरबती / लोकवान' : 'Sharbati / Lokwan',
      msp: '₹2,275 / quintal',
    },
    {
      id: 'Onion',
      name: language === 'mr' ? 'कांदा' : language === 'hi' ? 'प्याज' : 'Onion',
      variety: language === 'mr' ? 'नाशिक लाल' : language === 'hi' ? 'नासिक लाल' : 'Nashik Red',
      msp: language === 'mr' ? 'सरकारी बफर खरेदी' : language === 'hi' ? 'सरकारी बफर खरीद' : 'Government Buffer Proc.',
    },
    {
      id: 'Soybean',
      name: language === 'mr' ? 'सोयाबीन' : language === 'hi' ? 'सोयाबीन' : 'Soybean',
      variety: 'JS-335 / Yellow',
      msp: '₹4,892 / quintal',
    },
    {
      id: 'Cotton',
      name: language === 'mr' ? 'कापूस' : language === 'hi' ? 'कपास' : 'Cotton',
      variety: language === 'mr' ? 'मध्यम धागा' : language === 'hi' ? 'मध्यम रेशा' : 'Medium Staple',
      msp: '₹7,121 / quintal',
    },
  ]

  // If booking succeeded, show confirmation receipt card
  if (confirmedBooking) {
    return (
      <div className="panel" style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ display: 'inline-flex', padding: '14px', background: '#eef8f6', borderRadius: '50%', color: '#2f6f73', marginBottom: '14px' }}>
          <Check size={36} />
        </div>
        <div className="eyebrow teal" style={{ justifyContent: 'center' }}>
          {language === 'mr' ? 'शासकीय डिजिटल टोकन जारी' : language === 'hi' ? 'शासकीय डिजिटल टोकन जारी' : 'AUTHORITATIVE DIGITAL TOKEN'}
        </div>
        <h2 style={{ fontSize: '24px', color: '#12304a', margin: '4px 0 10px' }}>
          {bf.successTitle}
        </h2>
        <p style={{ color: '#5b6e79', fontSize: '13px', margin: '0 auto 24px', maxWidth: '440px' }}>
          {bf.successDesc}
        </p>

        <div style={{ background: '#f5fbfb', border: '1.5px dashed #2f6f73', borderRadius: '10px', padding: '22px', marginBottom: '24px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #d5e5e4', paddingBottom: '12px', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', color: '#5a717d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {language === 'mr' ? 'टोकन क्रमांक' : language === 'hi' ? 'टोकन संख्या' : 'Token Number'}
            </span>
            <b style={{ fontSize: '26px', color: '#12304a', fontFamily: 'monospace' }}>
              {confirmedBooking.tokenNumber}
            </b>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '12px' }}>
            <div>
              <span style={{ display: 'block', color: '#7a8c96', fontSize: '10px' }}>{language === 'mr' ? 'खरेदी केंद्र' : language === 'hi' ? 'खरीद केंद्र' : 'Procurement Centre'}</span>
              <strong style={{ color: '#12304a' }}>{confirmedBooking.centre?.name || selectedCentre?.name}</strong>
            </div>
            <div>
              <span style={{ display: 'block', color: '#7a8c96', fontSize: '10px' }}>{language === 'mr' ? 'आगमन वेळ' : language === 'hi' ? 'आगमन विंडो' : 'Arrival Window'}</span>
              <strong style={{ color: '#12304a' }}>{confirmedBooking.arrivalWindow || `${selectedSlot.startTime} – ${selectedSlot.endTime}`}</strong>
            </div>
            <div>
              <span style={{ display: 'block', color: '#7a8c96', fontSize: '10px' }}>{language === 'mr' ? 'शेतमाल' : language === 'hi' ? 'फसल' : 'Produce Category'}</span>
              <strong style={{ color: '#12304a' }}>{confirmedBooking.produceType || selectedProduce}</strong>
            </div>
            <div>
              <span style={{ display: 'block', color: '#7a8c96', fontSize: '10px' }}>{language === 'mr' ? 'अंदाजे प्रतीक्षा वेळ' : language === 'hi' ? 'प्रारंभिक अनुमानित प्रतीक्षा' : 'Initial Estimated Wait'}</span>
              <strong style={{ color: '#2f6f73' }}>{confirmedBooking.etaMinutes ?? 20} {language === 'mr' ? 'मिनिटे' : language === 'hi' ? 'मिनट' : 'minutes'}</strong>
            </div>
          </div>
        </div>

        <button className="button primary full" onClick={onBack}>
          {bf.goToDashboard} <ArrowRight size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="panel booking-panel" id="farmer-booking-workflow-panel">
      <div className="panel-heading" style={{ marginBottom: '20px' }}>
        <div>
          <button
            type="button"
            className="login-back-btn"
            style={{ marginBottom: '8px' }}
            onClick={step > 1 ? () => setStep(step - 1) : onBack}
          >
            <ArrowLeft size={13} /> {step > 1 ? (language === 'mr' ? 'मागील टप्प्यावर जा' : language === 'hi' ? 'पिछले चरण पर जाएं' : 'Back to previous step') : (language === 'mr' ? 'रद्द करा' : language === 'hi' ? 'रद्द करें' : 'Cancel booking')}
          </button>
          <div className="eyebrow">
            {language === 'mr' ? `टप्पा ${step} / ३` : language === 'hi' ? `चरण ${step} / ३` : `STEP ${step} OF 3`}
          </div>
          <h2 style={{ fontSize: '20px', color: '#12304a', margin: 0 }}>
            {step === 1 && bf.step1}
            {step === 2 && bf.step2}
            {step === 3 && bf.step3}
          </h2>
        </div>
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
      </div>

      {bookingError && (
        <div className="inline-alert warning" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={17} />
          <div><b>{language === 'mr' ? 'त्रुटी:' : language === 'hi' ? 'त्रुटि:' : 'Booking Error:'}</b> <span>{bookingError}</span></div>
        </div>
      )}

      {/* STEP 1: SELECT CENTRE */}
      {step === 1 && (
        <div>
          <p style={{ fontSize: '12px', color: '#687882', marginBottom: '14px' }}>
            {language === 'mr'
              ? 'जवळचे खरेदी केंद्र निवडा. कमी भार असलेल्या केंद्रांवर प्रतीक्षा वेळ कमी असेल.'
              : language === 'hi'
              ? 'निकटवर्ती खरीद केंद्र चुनें। कम लोड वाले केंद्रों पर प्रतीक्षा समय कम होगा।'
              : 'Choose a nearby procurement centre. Centres with lower load will have shorter waiting times.'}
          </p>

          {loadingCentres ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#62737e' }}>
              {language === 'mr' ? 'केंद्रे लोड होत आहेत...' : language === 'hi' ? 'केंद्र लोड हो रहे हैं...' : 'Loading centres...'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '10px', marginBottom: '22px' }}>
              {centres.map((c) => {
                const isSelected = selectedCentre?.id === c.id
                const isHigh = (c.calculatedLoadPercent || 0) >= 80

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCentre(c)}
                    style={{
                      border: `1.5px solid ${isSelected ? '#2f6f73' : '#dce4e8'}`,
                      background: isSelected ? '#f5fbfb' : '#fff',
                      borderRadius: '8px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <b style={{ fontSize: '14px', color: '#12304a' }}>{c.name}</b>
                      <span style={{ display: 'block', fontSize: '11px', color: '#687882', marginTop: '2px' }}>
                        <MapPin size={12} style={{ display: 'inline', marginRight: '3px' }} /> {c.location}
                      </span>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: '#4b5e6b' }}>
                        <span>{language === 'mr' ? 'रांग' : language === 'hi' ? 'कतार' : 'Queue'}: <strong>{c.currentQueue}</strong></span>
                        <span>{language === 'mr' ? 'गती' : language === 'hi' ? 'दर' : 'Rate'}: <strong>{c.processingRate}m</strong></span>
                        <span>{language === 'mr' ? 'क्षमता' : language === 'hi' ? 'क्षमता' : 'Capacity'}: <strong>{c.dailyCapacity}</strong></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`status-pill ${isHigh ? 'warning' : 'success'}`}>
                        {c.calculatedLoadPercent}% {language === 'mr' ? 'भार' : language === 'hi' ? 'लोड' : 'load'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button
            className="button primary full"
            disabled={!selectedCentre}
            onClick={() => setStep(2)}
          >
            {language === 'mr' ? 'शेतमाल निवडीसाठी पुढे जा' : language === 'hi' ? 'फसल चयन के लिए आगे बढ़ें' : 'Continue to Produce Selection'} <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* STEP 2: SPECIFY PRODUCE */}
      {step === 2 && (
        <div>
          <p style={{ fontSize: '12px', color: '#687882', marginBottom: '14px' }}>
            {language === 'mr'
              ? 'शासकीय हमीभाव (MSP) खरेदीसाठी आणत असलेला शेतमाल निवडा.'
              : language === 'hi'
              ? 'सरकारी न्यूनतम समर्थन मूल्य (MSP) खरीद के लिए लाई जा रही फसल का चयन करें।'
              : 'Select the crop you are bringing for government minimum support price (MSP) procurement.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {produceList.map((p) => {
              const isSelected = selectedProduce === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProduce(p.id)}
                  style={{
                    border: `1.5px solid ${isSelected ? '#2f6f73' : '#dce4e8'}`,
                    background: isSelected ? '#f5fbfb' : '#fff',
                    borderRadius: '8px',
                    padding: '14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <b style={{ display: 'block', fontSize: '14px', color: '#12304a' }}>{p.name}</b>
                  <small style={{ display: 'block', color: '#687882', fontSize: '11px', marginTop: '2px' }}>{p.variety}</small>
                  <span style={{ display: 'block', color: '#2f6f73', fontWeight: 700, fontSize: '11px', marginTop: '6px' }}>{p.msp}</span>
                </button>
              )
            })}
          </div>

          <div className="login-field" style={{ marginBottom: '22px' }}>
            <label htmlFor="procure-qty">{bf.estimatedQty}</label>
            <input
              id="procure-qty"
              type="number"
              min={100}
              step={100}
              value={quantityKg}
              onChange={(e) => setQuantityKg(Number(e.target.value))}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="button outline" onClick={() => setStep(1)}>
              {bf.backBtn}
            </button>
            <button className="button primary full" onClick={() => setStep(3)}>
              {bf.continueBtn} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CHOOSE ARRIVAL SLOT */}
      {step === 3 && (
        <div>
          <p style={{ fontSize: '12px', color: '#687882', marginBottom: '14px' }}>
            {language === 'mr' ? 'येथे उपलब्ध आगमन स्लॉट निवडा: ' : language === 'hi' ? 'यहाँ उपलब्ध आगमन स्लॉट चुनें: ' : 'Select an available arrival slot at '}
            <strong>{selectedCentre?.name}</strong>.
          </p>

          {loadingSlots ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#62737e' }}>
              {language === 'mr' ? 'उपलब्ध स्लॉट लोड होत आहेत...' : language === 'hi' ? 'उपलब्ध स्लॉट लोड हो रहे हैं...' : 'Loading available slots...'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '8px', marginBottom: '22px', maxHeight: '240px', overflowY: 'auto' }}>
              {slots.map((s) => {
                const isSelected = selectedSlot?.id === s.id
                const isFull = s.isFull

                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={isFull}
                    onClick={() => setSelectedSlot(s)}
                    style={{
                      border: `1.5px solid ${isSelected ? '#2f6f73' : '#dce4e8'}`,
                      background: isSelected ? '#f5fbfb' : isFull ? '#f7f8f9' : '#fff',
                      opacity: isFull ? 0.6 : 1,
                      borderRadius: '6px',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: isFull ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div>
                      <b style={{ fontSize: '13px', color: '#12304a' }}>{s.startTime} – {s.endTime}</b>
                      <span style={{ display: 'block', fontSize: '10px', color: '#7a8c96', marginTop: '2px' }}>
                        {language === 'mr' ? 'नोंदणी क्षमता' : language === 'hi' ? 'पंजीकरण क्षमता' : 'Capacity'}: {s.bookedCount || 0} / {s.capacity}
                      </span>
                    </div>
                    <span className={`status-pill ${isFull ? 'danger' : 'success'}`}>
                      {isFull ? (language === 'mr' ? 'पूर्ण' : language === 'hi' ? 'फुल' : 'Full') : `${s.availableCapacity ?? (s.capacity - s.bookedCount)} ${language === 'mr' ? 'उपलब्ध' : language === 'hi' ? 'उपलब्ध' : 'open'}`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="button outline" onClick={() => setStep(2)}>
              {bf.backBtn}
            </button>
            <button
              id="generate-digital-token-btn"
              className="button dark full"
              disabled={!selectedSlot || submitting}
              onClick={handleConfirmBooking}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> {language === 'mr' ? 'टोकन तयार होत आहे...' : language === 'hi' ? 'टोकन जनरेट हो रहा है...' : 'Generating Token...'}
                </>
              ) : (
                <>
                  <ShieldCheck size={14} /> {bf.confirmBookingBtn}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
