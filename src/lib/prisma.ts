import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
  // Prisma 7 requires a Driver Adapter or Accelerate URL when the URL is removed from schema.prisma
  const connectionString = process.env.POOLED_URL || process.env.DATABASE_URL
  
  if (!connectionString) {
    throw new Error('DATABASE_URL or POOLED_URL is not defined in environment variables')
  }

  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool as any) as any
  
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
// Cache-bust: 2026-03-26T11:45:00
