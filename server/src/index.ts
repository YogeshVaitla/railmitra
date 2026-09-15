import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
const prisma = new PrismaClient();
const server = createApp(prisma).listen(Number(process.env.PORT || 3001));
async function cleanup() {
  const now = Date.now();
  await prisma.$transaction([
    prisma.exchangeOffer.deleteMany({ where:{ created:{ lt:new Date(now-86400000) } } }),
    prisma.exchangeRevocation.deleteMany({ where:{ expires:{ lt:new Date(now) } } }),
    prisma.exchangeReport.deleteMany({ where:{ created:{ lt:new Date(now-30*86400000) } } }),
  ]);
}
const interval = setInterval(() => { void cleanup().catch(() => console.error('retention_cleanup_failed')); },3600000);
void cleanup().catch(() => console.error('retention_cleanup_failed'));
process.on('SIGTERM', () => { clearInterval(interval); server.close(() => { void prisma.$disconnect(); }); });
