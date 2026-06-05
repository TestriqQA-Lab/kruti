import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompaniesClient from "@/components/CompaniesClient";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const companies = await prisma.companyProfile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { contentPlans: true, newsletters: true } } },
  });

  const data = companies.map((c) => ({
    id: c.id,
    name: c.name,
    tagline: c.tagline,
    about: c.about,
    industry: c.industry,
    website: c.website,
    logoUrl: c.logoUrl,
    positioning: c.positioning,
    contentGoals: c.contentGoals,
    contentStyles: c.contentStyles,
    targetAudience: c.targetAudience,
    tonePrefs: c.tonePrefs,
    humanMode: c.humanMode,
    postingSchedule: c.postingSchedule,
    postSignature: c.postSignature,
    timezone: c.timezone,
    plansCount: c._count.contentPlans,
    newslettersCount: c._count.newsletters,
  }));

  return <CompaniesClient companies={data} />;
}
