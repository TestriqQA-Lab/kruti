import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewsletterClient from "@/components/NewsletterClient";
import { getActiveWorkspaceId } from "@/lib/company";

export default async function NewsletterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const companyProfileId = await getActiveWorkspaceId(session.user.id);

  const newsletters = await prisma.newsletter.findMany({
    where: { userId: session.user.id, companyProfileId },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  return (
    <NewsletterClient
      newsletters={newsletters}
      currentMonth={now.getMonth() + 1}
      currentYear={now.getFullYear()}
    />
  );
}
