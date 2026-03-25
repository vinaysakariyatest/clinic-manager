import prisma from './src/lib/prisma';

async function main() {
  const doctors = await prisma.doctor.findMany();
  console.log('Available Doctors:');
  console.log(JSON.stringify(doctors, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
