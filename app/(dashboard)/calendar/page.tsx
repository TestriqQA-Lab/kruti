import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CalendarClient from "@/components/CalendarClient";
import { getActiveWorkspaceId } from "@/lib/company";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const companyProfileId = await getActiveWorkspaceId(session.user.id);

  // Timezone for display comes from the active workspace
  let timezone = "Asia/Kolkata";
  if (companyProfileId) {
    const company = await prisma.companyProfile.findFirst({
      where: { id: companyProfileId, userId: session.user.id },
      select: { timezone: true },
    });
    timezone = company?.timezone ?? "Asia/Kolkata";
  } else {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });
    timezone = user?.timezone ?? "Asia/Kolkata";
  }

  // Load the last 8 weeks of plans (covers ~2 months for the calendar)
  const plans = await prisma.contentPlan.findMany({
    where: { userId: session.user.id, companyProfileId },
    include: { posts: { orderBy: { scheduledAt: "asc" } } },
    orderBy: { weekStart: "desc" },
    take: 8,
  });

  // Flatten all posts from all plans
  const allPosts = plans.flatMap((p) =>
    p.posts.map((post) => ({
      ...post,
      weekStart: p.weekStart,
    }))
  );

  return <CalendarClient posts={allPosts} userTimezone={timezone} />;
}
