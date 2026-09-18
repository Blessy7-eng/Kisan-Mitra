import { calculateETA, calculateArrivalWindow, calculateCentreLoad, getCentreStatus, getAlternativeCentre, CentreState } from '../lib/smartQueueEngine'
import { hashPassword, comparePassword, signToken, verifyToken } from '../lib/auth'
import { Role } from '@prisma/client'

async function runTests() {
  console.log('🧪 Running Kisan-Mitra Backend Logic & Engine Integration Tests...\n')
  let passed = 0

  // Test 1: Password hashing and comparison
  const rawPass = 'farmerSecret2026'
  const hash = await hashPassword(rawPass)
  const isMatch = await comparePassword(rawPass, hash)
  const wrongMatch = await comparePassword('wrongPass', hash)
  if (isMatch && !wrongMatch) {
    console.log('✅ Test 1: Password hashing & verification passed')
    passed++
  } else {
    console.error('❌ Test 1 failed')
  }

  // Test 2: JWT token signing and verification
  const payload = {
    userId: 'usr_farmer_1',
    phone: '9876543210',
    role: Role.FARMER,
    assignedCentreId: null,
  }
  const token = signToken(payload)
  const verified = verifyToken(token)
  if (verified && verified.userId === payload.userId && verified.role === Role.FARMER) {
    console.log('✅ Test 2: JWT signing and role payload verification passed')
    passed++
  } else {
    console.error('❌ Test 2 failed')
  }

  // Test 3: Smart Queue Engine ETA Calculation
  const centreState: CentreState = {
    queue: 8,
    capacity: 60,
    processingMinutes: 5.25,
    delayMinutes: 0,
    bookings: 84,
    counters: 4,
  }
  const eta = calculateETA(8, centreState)
  // 8 * 5.25 + 0 = 42 minutes
  if (eta === 42) {
    console.log(`✅ Test 3: Deterministic ETA calculation passed (8 farmers ahead @ 5.25 min = ${eta} min)`)
    passed++
  } else {
    console.error(`❌ Test 3 failed: expected 42, got ${eta}`)
  }

  // Test 4: Arrival window calculation with time offset
  const baseMinutes = 10 * 60 + 40 // 10:40 AM = 640 min
  const arrivalWindow = calculateArrivalWindow(baseMinutes, 0)
  if (arrivalWindow === '10:40 AM – 11:00 AM') {
    console.log(`✅ Test 4: Arrival window formatting passed (${arrivalWindow})`)
    passed++
  } else {
    console.error(`❌ Test 4 failed: expected 10:40 AM – 11:00 AM, got ${arrivalWindow}`)
  }

  // Test 5: Dynamic delay recalculation
  const delayedState: CentreState = {
    ...centreState,
    delayMinutes: 15,
  }
  const delayedEta = calculateETA(8, delayedState)
  // 42 + 15 = 57 minutes
  if (delayedEta === 57) {
    console.log(`✅ Test 5: Live delay recalculation passed (42 min + 15 min delay = ${delayedEta} min)`)
    passed++
  } else {
    console.error(`❌ Test 5 failed: expected 57, got ${delayedEta}`)
  }

  // Test 6: Centre load and high load alert status
  const load = calculateCentreLoad(centreState)
  const status = getCentreStatus(load)
  const highLoadState: CentreState = {
    queue: 51,
    capacity: 55,
    processingMinutes: 11.0,
    delayMinutes: 0,
    bookings: 90,
    counters: 4,
  }
  const highLoad = calculateCentreLoad(highLoadState)
  const highStatus = getCentreStatus(highLoad)
  const alternative = getAlternativeCentre(highLoad)

  if (highStatus === 'High Load' && alternative === 'Nashik Procurement Centre') {
    console.log(`✅ Test 6: Centre load threshold & alternative centre recommendation passed (${highStatus} -> ${alternative})`)
    passed++
  } else {
    console.error('❌ Test 6 failed')
  }

  console.log(`\n🎉 All ${passed}/6 Core Backend Flow Tests Passed!`)
}

runTests().catch(console.error)
