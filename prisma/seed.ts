import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting Kisan-Mitra database seeding...')

  // 1. Clean existing records in reverse dependency order
  await prisma.booking.deleteMany()
  await prisma.slot.deleteMany()
  await prisma.centre.deleteMany()
  await prisma.user.deleteMany()

  // 2. Hash default passwords
  const farmerPassword = await bcrypt.hash('farmer123', 10)
  const officerPassword = await bcrypt.hash('officer123', 10)
  const adminPassword = await bcrypt.hash('admin123', 10)

  // 3. Create Centres
  const nashik = await prisma.centre.create({
    data: {
      name: 'Nashik Procurement Centre',
      location: 'Nashik District, Maharashtra (8.4 km)',
      dailyCapacity: 60,
      processingRate: 5.25,
      currentQueue: 8,
      status: 'ACTIVE',
    },
  })

  const lasalgaon = await prisma.centre.create({
    data: {
      name: 'Lasalgaon Procurement Centre',
      location: 'Niphad Taluka, Nashik (18.2 km)',
      dailyCapacity: 55,
      processingRate: 11.0,
      currentQueue: 51,
      status: 'HIGH_LOAD',
    },
  })

  const sinnar = await prisma.centre.create({
    data: {
      name: 'Sinnar Procurement Centre',
      location: 'Sinnar Taluka, Maharashtra (24.0 km)',
      dailyCapacity: 42,
      processingRate: 9.0,
      currentQueue: 34,
      status: 'ACTIVE',
    },
  })

  console.log('✅ Created 3 procurement centres')

  // 4. Create Users for each role
  const farmerUser = await prisma.user.create({
    data: {
      name: 'Ramesh Jadhav',
      phone: '9876543210',
      passwordHash: farmerPassword,
      role: Role.FARMER,
      language: 'mr',
    },
  })

  const farmerUser2 = await prisma.user.create({
    data: {
      name: 'Meena Shinde',
      phone: '9876543219',
      passwordHash: farmerPassword,
      role: Role.FARMER,
      language: 'mr',
    },
  })

  const officerUser = await prisma.user.create({
    data: {
      name: 'Suresh Patil',
      phone: '9876543211',
      passwordHash: officerPassword,
      role: Role.OFFICER,
      language: 'en',
      assignedCentreId: nashik.id,
    },
  })

  const adminUser = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      phone: '9876543212',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      language: 'en',
    },
  })

  console.log('✅ Created 4 users across FARMER, OFFICER, ADMIN roles')

  // 5. Create Slots for Nashik Centre
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const slot1 = await prisma.slot.create({
    data: {
      centreId: nashik.id,
      date: today,
      startTime: '09:00 AM',
      endTime: '09:30 AM',
      capacity: 15,
      bookedCount: 2,
      status: 'OPEN',
    },
  })

  const slot2 = await prisma.slot.create({
    data: {
      centreId: nashik.id,
      date: today,
      startTime: '10:40 AM',
      endTime: '11:00 AM',
      capacity: 15,
      bookedCount: 3,
      status: 'OPEN',
    },
  })

  const slot3 = await prisma.slot.create({
    data: {
      centreId: nashik.id,
      date: today,
      startTime: '12:20 PM',
      endTime: '12:40 PM',
      capacity: 15,
      bookedCount: 0,
      status: 'OPEN',
    },
  })

  // Create slots for Lasalgaon and Sinnar
  await prisma.slot.create({
    data: {
      centreId: lasalgaon.id,
      date: today,
      startTime: '10:00 AM',
      endTime: '10:30 AM',
      capacity: 10,
      bookedCount: 10,
      status: 'FULL',
    },
  })

  await prisma.slot.create({
    data: {
      centreId: sinnar.id,
      date: today,
      startTime: '11:00 AM',
      endTime: '11:30 AM',
      capacity: 12,
      bookedCount: 4,
      status: 'OPEN',
    },
  })

  console.log('✅ Created slots across centres')

  // 6. Create Demo Bookings with Tokens matching prototype
  await prisma.booking.create({
    data: {
      farmerId: farmerUser2.id,
      centreId: nashik.id,
      slotId: slot1.id,
      tokenNumber: 'K-121',
      status: 'PROCESSING',
      etaMinutes: 0,
      arrivalStart: '09:00 AM',
      arrivalEnd: '09:20 AM',
    },
  })

  await prisma.booking.create({
    data: {
      farmerId: farmerUser2.id,
      centreId: nashik.id,
      slotId: slot1.id,
      tokenNumber: 'K-122',
      status: 'CONFIRMED',
      etaMinutes: 10,
      arrivalStart: '09:10 AM',
      arrivalEnd: '09:30 AM',
    },
  })

  await prisma.booking.create({
    data: {
      farmerId: farmerUser2.id,
      centreId: nashik.id,
      slotId: slot2.id,
      tokenNumber: 'K-123',
      status: 'CONFIRMED',
      etaMinutes: 25,
      arrivalStart: '10:40 AM',
      arrivalEnd: '11:00 AM',
    },
  })

  const rameshBooking = await prisma.booking.create({
    data: {
      farmerId: farmerUser.id,
      centreId: nashik.id,
      slotId: slot2.id,
      tokenNumber: 'K-124',
      status: 'CONFIRMED',
      etaMinutes: 42,
      arrivalStart: '10:40 AM',
      arrivalEnd: '11:00 AM',
    },
  })

  console.log(`✅ Created demo bookings including primary token ${rameshBooking.tokenNumber}`)
  console.log('🎉 Seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
