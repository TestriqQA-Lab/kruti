import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const admins = await prisma.user.findMany({ where: { role: 'admin' } });
  console.log(`Found ${admins.length} admins.`);
  for (const admin of admins) {
    await prisma.subscription.upsert({
      where: { userId: admin.id },
      create: {
        userId: admin.id,
        status: 'active',
        currency: 'INR',
        currentPeriodEnd: new Date('2099-12-31T23:59:59Z'),
        trialEnd: null,
        trialRemindersSent: '',
        postsGeneratedThisCycle: 0,
      },
      update: {
        status: 'active',
        currentPeriodEnd: new Date('2099-12-31T23:59:59Z'),
        trialEnd: null,
        trialRemindersSent: '',
      },
    });
    console.log(`Granted lifetime active subscription to admin: ${admin.email}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());