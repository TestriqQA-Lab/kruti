const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({where: {provider: 'linkedin'}});
  console.log('Scopes:', account.scope);
}
main().finally(() => prisma.$disconnect());
