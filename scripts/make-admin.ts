import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "mishraprakashcpn47@gmail.com";
  
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`❌ User with email ${email} not found in the database! (Make sure they have logged in at least once)`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data: { 
      role: "admin",
      onboardingCompleted: true 
    },
  });

  console.log(`✅ Success! ${email} is now an admin and onboarding is marked as completed.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
