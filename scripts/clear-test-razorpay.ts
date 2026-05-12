import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Show current state
  const subs = await prisma.subscription.findMany({
    select: {
      userId: true,
      razorpayCustomerId: true,
      razorpaySubscriptionId: true,
      status: true,
    },
  });

  console.log("Current subscriptions:", JSON.stringify(subs, null, 2));

  // Clear old test-mode Razorpay IDs so live-mode can create fresh ones
  const result = await prisma.subscription.updateMany({
    where: {
      razorpayCustomerId: { not: null },
    },
    data: {
      razorpayCustomerId: null,
      razorpaySubscriptionId: null,
      razorpayPlanId: null,
    },
  });

  console.log(`\n✅ Cleared Razorpay IDs from ${result.count} subscription(s)`);
  console.log("Now the checkout will create fresh live-mode customers.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
