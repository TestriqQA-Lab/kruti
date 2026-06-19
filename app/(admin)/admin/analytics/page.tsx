import { prisma } from "@/lib/prisma";
import { buildUsageReport, istDayKey } from "@/lib/usage-analytics";
import AdminAnalyticsClient from "@/components/AdminAnalyticsClient";

// Always render fresh (usage data changes continuously).
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const now = Date.now();
  const start = istDayKey(now - 29 * 24 * 60 * 60 * 1000);
  const end = istDayKey(now);

  const [posts, plans] = await Promise.all([
    prisma.post.findMany({
      select: {
        id: true,
        postType: true,
        status: true,
        imageUrl: true,
        carouselImages: true,
        imageHistory: true,
        imagePrompt: true,
        createdAt: true,
      },
    }),
    prisma.contentPlan.findMany({ select: { createdAt: true } }),
  ]);

  const initialReport = buildUsageReport(posts, plans, start, end);

  return <AdminAnalyticsClient initialReport={initialReport} initialStart={start} initialEnd={end} />;
}
