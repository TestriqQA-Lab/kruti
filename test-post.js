const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const account = await prisma.account.findFirst({where: {provider: 'linkedin'}});
  if (!account) return;
  const user = await prisma.user.findUnique({where: {id: account.userId}});
  const linkedinId = user.linkedinId || account.providerAccountId;
  const accessToken = account.access_token;
  
  const fullText = "Test post from Kruti.io local development. Please ignore.";
  const ugcPost = {
    author: `urn:li:person:${linkedinId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: fullText },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
  
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(ugcPost),
  });
  
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}
main().finally(() => prisma.$disconnect());
