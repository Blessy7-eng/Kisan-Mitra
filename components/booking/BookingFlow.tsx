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
} from 'lucide-react'

interface BookingFlowProps {
  farmerToken: string | null
  onBack: () => void
  onBookingSuccess: (booking: any) => void
}

export default function BookingFlow({
  farmerToken,
  onBack,
  onBookingSuccess,
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
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null)

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
  }, [selectedCentre?.id])

  // 3. Submit booking to POST /api/bookings
  const handleConfirmBooking = async () => {
    if (!selectedCentre || !selectedSlot) {
      setBookingError('Please select both a procurement centre and an arrival slot.')
      return
    }

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
        throw new Error(data.error || 'Failed to generate procurement booking')
      }

      setConfirmedBooking(data.booking)
      onBookingSuccess(data.booking)
    } catch (err: any) {
      setBookingError(err.message || 'Failed to create booking.')
    } finally {
      setSubmitting(false)
    }
  }

  // Confirmation View
  if (confirmedBooking) {
    return (
      <div className="booking-modal-card">
        <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: '#e6f3f1',
              color: '#2f6f73',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Check size={28} />
          </div>
          <div className="eyebrow teal" style={{ justifyContent: 'center' }}>
            BOOKING CONFIRMED · AUTHORITATIVE TOKEN ISSUED
          </div>
          <h2 style={{ fontSize: '24px', color: '#12304a', margin: '6px 0 10px', fontWeight: 800 }}>
            Procurement Token Generated
          </h2>
          <p style={{ color: '#62737e', fontSize: '13px', margin: 0 }}>
            Your slot has been registered in the Smart Queue Engine.
          </p>
        </div>

        <div style={{ background: '#f8fafb', border: '1px solid #dce4e8', borderRadius: '8px', padding: '18px 20px', marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px dashed #ccd8de', paddingBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: '#687882' }}>Digital Token Number</span>
            <b style={{ fontSize: '20px', color: '#12304a' }}>{confirmedBooking.tokenNumber}</b>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
            <div>
              <span style={{ display: 'block', color: '#7a8c96', fontSize: '10px' }}>Procurement Centre</span>
              <strong style={{ color: '#12304a' }}>{confirmedBooking.centre?.name || selectedCentre?.name}</strong>
            </div>
            <div>
              <span style={{ display: 'block', color: '#7a8c96', fontSize: '10px' }}>Arrival Window</span>
              <strong style={{ color: '#12304a' }}>{confirmedBooking.arrivalWindow || `${selectedSlot.startTime} – ${selectedSlot.endTime}`}</strong>
            </div>
            <div>
              <span style={{ display: 'block', color: '#7a8c96', fontSize: '10px' }}>Produce Category</span>
              <strong style={{ color: '#12304a' }}>{confirmedBooking.produceType || selectedProduce}</strong>
            </div>
            <div>
              <span style={{ display: 'block', color: '#7a8c96', fontSize: '10px' }}>Initial Estimated Wait</span>
              <strong style={{ color: '#2f6f73' }}>{confirmedBooking.etaMinutes ?? 20} minutes</strong>
            </div>
          </div>
        </div>

        <button className="button primary full" onClick={onBack}>
          Return to My Queue <ArrowRight size={15} />
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
            <ArrowLeft size={13} /> {step > 1 ? 'Back to previous step' : 'Cancel booking'}
          </button>
          <div className="eyebrow">STEP {step} OF 3</div>
          <h2 style={{ fontSize: '20px', color: '#12304a', margin: 0 }}>
            {step === 1 && 'Select Procurement Centre'}
            {step === 2 && 'Specify Agricultural Produce'}
            {step === 3 && 'Choose Arrival Slot & Confirm Token'}
          </h2>
        </div>
      </div>

      {bookingError && (
        <div className="inline-alert warning" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={17} />
          <div><b>Booking Error:</b> <span>{bookingError}</span></div>
        </div>
      )}

      {/* STEP 1: SELECT CENTRE */}
      {step === 1 && (
        <div>
          <p style={{ fontSize: '12px', color: '#687882', marginBottom: '14px' }}>
            Choose a nearby procurement centre. Centres with lower load will have shorter waiting times.
          </p>

          {loadingCentres ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#62737e' }}>Loading centres...</div>
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
                        <span>Queue: <strong>{c.currentQueue}</strong></span>
                        <span>Rate: <strong>{c.processingRate}m</strong></span>
                        <span>Capacity: <strong>{c.dailyCapacity}</strong></span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`status-pill ${isHigh ? 'warning' : 'success'}`}>
                        {c.calculatedLoadPercent}% load
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
            Continue to Produce Selection <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* STEP 2: SPECIFY PRODUCE */}
      {step === 2 && (
        <div>
          <p style={{ fontSize: '12px', color: '#687882', marginBottom: '14px' }}>
            Select the crop you are bringing for government minimum support price (MSP) procurement.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { name: 'Wheat', variety: 'Sharbati / Lokwan', msp: '₹2,275 / quintal' },
              { name: 'Onion', variety: 'Nashik Red', msp: 'Government Buffer Proc.' },
              { name: 'Soybean', variety: 'JS-335 / Yellow', msp: '₹4,892 / quintal' },
              { name: 'Cotton', variety: 'Medium Staple', msp: '₹7,121 / quintal' },
            ].map((p) => {
              const isSelected = selectedProduce === p.name
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setSelectedProduce(p.name)}
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
            <label htmlFor="procure-qty">Estimated Quantity (Kilograms):</label>
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
              Back
            </button>
            <button className="button primary full" onClick={() => setStep(3)}>
              Continue to Slot Selection <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CHOOSE ARRIVAL SLOT */}
      {step === 3 && (
        <div>
          <p style={{ fontSize: '12px', color: '#687882', marginBottom: '14px' }}>
            Select an available arrival slot at <strong>{selectedCentre?.name}</strong>.
          </p>

          {loadingSlots ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#62737e' }}>Loading available slots...</div>
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
                        Capacity: {s.bookedCount || 0} / {s.capacity} registered
                      </span>
                    </div>
                    <span className={`status-pill ${isFull ? 'danger' : 'success'}`}>
                      {isFull ? 'Full' : `${s.availableCapacity ?? (s.capacity - s.bookedCount)} open`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="button outline" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              id="generate-digital-token-btn"
              className="button dark full"
              disabled={!selectedSlot || submitting}
              onClick={handleConfirmBooking}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Issuing Digital Token...
                </>
              ) : (
                <>
                  <ShieldCheck size={14} /> Generate Digital Token
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
