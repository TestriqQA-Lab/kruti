import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all admin users
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true, email: true, name: true },
  });

  if (admins.length === 0) {
    console.log("❌ No admin users found in the database.");
    return;
  }

  console.log(`Found ${admins.length} admin user(s):\n`);

  for (const admin of admins) {
    console.log(`  → ${admin.name || "Unknown"} (${admin.email})`);

    // Upsert subscription: set to active with a far-future expiry (2099-12-31)
    const sub = await prisma.subscription.upsert({
      where: { userId: admin.id },
      create: {
        userId: admin.id,
        status: "active",
        currency: "INR",
        currentPeriodEnd: new Date("2099-12-31T23:59:59Z"),
        trialEnd: null,
        trialRemindersSent: "",
        postsGeneratedThisCycle: 0,
      },
      update: {
        status: "active",
        currentPeriodEnd: new Date("2099-12-31T23:59:59Z"),
        trialEnd: null,
        trialRemindersSent: "",
      },
    });

    console.log(`    ✅ Subscription set to ACTIVE (expires 2099-12-31)`);
    console.log(`    Subscription ID: ${sub.id}\n`);
  }

  console.log("✅ All admin users now have lifetime subscriptions!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
