import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AnalyticsClient from "@/components/AnalyticsClient";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const userFilter = { plan: { userId: session.user.id } };

  const [
    postsByStatus,
    postsByType,
    linkedinPublished,
    linkedinErrors,
    totalPosts,
    weeklyPosts,
    heatmapPosts,
    engagementPosts,
  ] = await Promise.all([
    prisma.post.groupBy({
      by: ["status"],
      where: userFilter,
      _count: { _all: true },
    }),
    prisma.post.groupBy({
      by: ["postType"],
      where: userFilter,
      _count: { _all: true },
    }),
    prisma.post.count({ where: { ...userFilter, postedToLinkedIn: true } }),
    prisma.post.count({ where: { ...userFilter, postError: { not: null } } }),
    prisma.post.count({ where: userFilter }),
    prisma.post.findMany({
      where: { ...userFilter, createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true, postedToLinkedIn: true },
    }),
    prisma.post.findMany({
      where: { ...userFilter, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
    }),
    // Engagement data from published posts
    prisma.post.findMany({
      where: { ...userFilter, postedToLinkedIn: true },
      select: {
        id: true,
        title: true,
        postType: true,
        linkedinLikes: true,
        linkedinComments: true,
        linkedinShares: true,
        linkedinImpressions: true,
        engagementSyncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Posts created this week (Mon-Sun)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  const postsThisWeek = await prisma.post.count({
    where: { ...userFilter, createdAt: { gte: startOfWeek } },
  });

  // Build status map
  const statusMap: Record<string, number> = {};
  postsByStatus.forEach((g) => {
    statusMap[g.status] = g._count._all;
  });

  // Build type map
  const typeMap: Record<string, number> = {};
  postsByType.forEach((g) => {
    typeMap[g.postType] = g._count._all;
  });

  // Build weekly activity (last 8 weeks)
  const weekBuckets: Record<string, { created: number; published: number }> = {};
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);
    weekBuckets[key] = { created: 0, published: 0 };
  }
  weeklyPosts.forEach((p) => {
    const d = new Date(p.createdAt);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);
    if (weekBuckets[key]) {
      weekBuckets[key].created++;
      if (p.postedToLinkedIn) weekBuckets[key].published++;
    }
  });
  const weeklyActivity = Object.entries(weekBuckets).map(([date, data]) => {
    const d = new Date(date + "T00:00:00");
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { weekLabel: label, ...data };
  });

  // Build calendar heatmap (last 90 days)
  const heatmapMap: Record<string, number> = {};
  heatmapPosts.forEach((p) => {
    const key = new Date(p.createdAt).toISOString().slice(0, 10);
    heatmapMap[key] = (heatmapMap[key] || 0) + 1;
  });
  const calendarHeatmap: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    calendarHeatmap.push({ date: key, count: heatmapMap[key] || 0 });
  }

  // Average posts per week
  const weeksActive = Math.max(1, Math.ceil((now.getTime() - eightWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const avgPostsPerWeek = totalPosts > 0 ? Math.round((totalPosts / weeksActive) * 10) / 10 : 0;

  const successRate = linkedinPublished + linkedinErrors > 0
    ? Math.round((linkedinPublished / (linkedinPublished + linkedinErrors)) * 100)
    : 0;

  // Aggregate engagement by post type
  const engagementByType: Record<string, { count: number; likes: number; comments: number; shares: number; impressions: number }> = {};
  engagementPosts.forEach((p) => {
    if (!engagementByType[p.postType]) {
      engagementByType[p.postType] = { count: 0, likes: 0, comments: 0, shares: 0, impressions: 0 };
    }
    const t = engagementByType[p.postType];
    t.count++;
    t.likes += p.linkedinLikes ?? 0;
    t.comments += p.linkedinComments ?? 0;
    t.shares += p.linkedinShares ?? 0;
    t.impressions += p.linkedinImpressions ?? 0;
  });

  // Aggregate engagement metrics
  const engagementTotals = {
    likes: 0,
    comments: 0,
    shares: 0,
    impressions: 0,
    hasSyncedData: false,
  };
  const engagementByPost = engagementPosts.map((p) => {
    const likes = p.linkedinLikes ?? 0;
    const comments = p.linkedinComments ?? 0;
    const shares = p.linkedinShares ?? 0;
    const impressions = p.linkedinImpressions ?? 0;
    engagementTotals.likes += likes;
    engagementTotals.comments += comments;
    engagementTotals.shares += shares;
    engagementTotals.impressions += impressions;
    if (p.engagementSyncedAt) engagementTotals.hasSyncedData = true;
    return {
      id: p.id,
      title: p.title,
      postType: p.postType,
      likes,
      comments,
      shares,
      impressions,
      engagementRate: impressions > 0
        ? Math.round(((likes + comments + shares) / impressions) * 1000) / 10
        : 0,
    };
  });

  return (
    <AnalyticsClient
      stats={{
        totalPosts,
        postsThisWeek,
        linkedinPublished,
        linkedinErrors,
        avgPostsPerWeek,
        successRate,
      }}
      postsByStatus={statusMap}
      postsByType={typeMap}
      weeklyActivity={weeklyActivity}
      calendarHeatmap={calendarHeatmap}
      engagement={{
        totals: engagementTotals,
        byPost: engagementByPost,
        byType: Object.entries(engagementByType).map(([type, data]) => ({
          postType: type,
          ...data,
          avgEngagement: data.impressions > 0
            ? Math.round(((data.likes + data.comments + data.shares) / data.impressions) * 1000) / 10
            : 0,
        })),
      }}
    />
  );
}
