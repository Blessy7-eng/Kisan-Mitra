import assert from 'assert'
import { createExpressApp } from '../backend/app'
import http from 'http'
import type { AddressInfo } from 'net'

async function runProductionFailureSuite() {
  console.log('🧪 Starting Production Failure Mode Verification Suite...')
  console.log('Config: NODE_ENV=production, ALLOW_IN_MEMORY_DB_FALLBACK=false, unreachable MySQL')

  // Setup test Express app with production settings
  const app = createExpressApp()
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}`

  try {
    // TEST 1: Health check must report 503 Service Unavailable and database: disconnected
    console.log('\n--- Test 1: Production Health Check with Unreachable MySQL ---')
    const healthRes = await fetch(`${baseUrl}/api/health`)
    assert.strictEqual(healthRes.status, 503, `Health check must return 503 when MySQL fails, got ${healthRes.status}`)
    const healthData = await healthRes.json()
    assert.strictEqual(healthData.status, 'unhealthy', `Health status must be 'unhealthy', got ${healthData.status}`)
    assert.strictEqual(healthData.database, 'disconnected', `Database status must be 'disconnected', got ${healthData.database}`)
    console.log('✅ Test 1 Passed: /api/health returned 503 with database: "disconnected"')

    // TEST 2: Farmer login must FAIL (500 or 401) and NOT authenticate against seed memory users
    console.log('\n--- Test 2: Production Login Failure Mode ---')
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210', password: 'farmer123' }),
    })
    assert.notStrictEqual(loginRes.status, 200, 'Login must not succeed when MySQL is unreachable in production')
    console.log(`✅ Test 2 Passed: Farmer login was rejected with HTTP ${loginRes.status} (did not authenticate against in-memory seed)`)

    // TEST 3: Public registration must FAIL and not silently write to memory
    console.log('\n--- Test 3: Production Registration Failure Mode ---')
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Farmer', phone: '9999888877', password: 'password123' }),
    })
    assert.notStrictEqual(regRes.status, 201, 'Registration must not return 201 when MySQL is unreachable')
    console.log(`✅ Test 3 Passed: Registration rejected with HTTP ${regRes.status}`)

    // TEST 4: Centres list must FAIL and not return seeded centres
    console.log('\n--- Test 4: Production Centres List Failure Mode ---')
    const centresRes = await fetch(`${baseUrl}/api/centres`)
    assert.notStrictEqual(centresRes.status, 200, 'Centres endpoint must not return 200 with fake data')
    console.log(`✅ Test 4 Passed: Centres endpoint returned HTTP ${centresRes.status}`)

    // TEST 5: Queue endpoint must FAIL and not return in-memory queue
    console.log('\n--- Test 5: Production Queue Failure Mode ---')
    const queueRes = await fetch(`${baseUrl}/api/queue/centre_nashik`)
    assert.notStrictEqual(queueRes.status, 200, 'Queue endpoint must not return 200 with fake in-memory queue')
    console.log(`✅ Test 5 Passed: Queue endpoint returned HTTP ${queueRes.status}`)

    console.log('\n🎉 ALL 5 Production Failure Mode Tests Passed: Production NEVER falls back to in-memory store!')
  } finally {
    server.close()
  }
}

runProductionFailureSuite().catch((err) => {
  console.error('❌ Production Failure Mode Suite FAILED:', err)
  process.exit(1)
})
