const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const pg = require('pg')
require('dotenv').config()

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined')
  }

  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    // 1. Seed Doctors
    const doctors = [
      { name: 'Dr. Rahul Sharma', specialization: 'General Physician' },
      { name: 'Dr. Priya Singh', specialization: 'Dermatologist' },
      { name: 'Dr. Amit Kumar', specialization: 'Cardiologist' },
    ]

    const seededDoctors = []
    for (const doc of doctors) {
      const id = 'dummy-' + doc.name.toLowerCase().replace(/\s/g, '-')
      const d = await prisma.doctor.upsert({
        where: { id: id },
        update: {},
        create: {
          id: id,
          name: doc.name,
          specialization: doc.specialization,
        },
      })
      seededDoctors.push(d)
    }

    // 2. Seed a Patient
    const patient = await prisma.patient.upsert({
      where: { phone: '919876543210' },
      update: {},
      create: {
        phone: '919876543210',
        name: 'John Doe (Test)'
      }
    })

    // 3. Seed a Sample Appointment for Today
    const today = new Date()
    // Make it 1 hour from now so it's "upcoming"
    today.setHours(today.getHours() + 1)

    await prisma.appointment.upsert({
      where: { id: 'test-appointment-1' },
      update: {},
      create: {
        id: 'test-appointment-1',
        patientId: patient.id,
        doctorId: seededDoctors[0].id,
        date: today,
        symptoms: 'Fever and Headache',
        status: 'CONFIRMED'
      }
    })

    console.log('Seeding finished successfully with sample appointment.')
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
