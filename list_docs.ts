import 'dotenv/config';
import prisma from './src/lib/prisma';

async function main() {
  const doctors = await prisma.doctor.findMany();
  doctors.forEach(d => console.log(`${d.id}: ${d.name} (${d.specialization})`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
