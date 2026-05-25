const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({where: {provider: 'linkedin'}});
  if (!account) { console.log('No linkedin account found.'); return; }
  const user = await prisma.user.findUnique({where: {id: account.userId}});
  console.log('User ID:', user.id);
  console.log('LinkedIn ID:', user.linkedinId);
  console.log('Provider Account ID:', account.providerAccountId);
  console.log('Account Access Token length:', account.access_token ? account.access_token.length : 0);
  console.log('Account Refresh Token length:', account.refresh_token ? account.refresh_token.length : 0);
  console.log('Account Expires At:', account.expires_at, 'Now:', Math.floor(Date.now() / 1000));
}
main().finally(() => prisma.$disconnect());
