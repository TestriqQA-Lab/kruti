const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({where: {provider: 'linkedin'}});
  if (!account) return;
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${account.access_token}` },
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
main().finally(() => prisma.$disconnect());
