import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
dotenv.config()

const connectionString = process.env.POOLED_URL || process.env.DATABASE_URL
const pool = new pg.Pool({ connectionString })
const adapter = new PrismaPg(pool as any) as any
const prisma = new PrismaClient({ adapter })

async function main() {
  try {
    const apps = await prisma.appointment.findMany({
      take: 2,
      include: { patient: true, doctor: true }
    });
    console.log("Success! Found appointments:", JSON.stringify(apps, null, 2));
  } catch (err) {
    console.error("Query Error:", err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
