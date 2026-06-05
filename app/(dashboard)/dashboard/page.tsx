import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";
import { getActiveWorkspaceId } from "@/lib/company";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const now = new Date();

  // Resolve the active workspace (null = Personal, else a company the user owns)
  const companyProfileId = await getActiveWorkspaceId(session.user.id);

  // Display + schedule source: the company (if active) else the user.
  // Normalized into the shape DashboardClient expects.
  let displayUser:
    | { name: string | null; headline: string | null; industry: string | null; image: string | null; postingSchedule: string | null }
    | null = null;
  if (companyProfileId) {
    const c = await prisma.companyProfile.findFirst({
      where: { id: companyProfileId, userId: session.user.id },
      select: { name: true, tagline: true, industry: true, logoUrl: true, postingSchedule: true },
    });
    if (c) displayUser = { name: c.name, headline: c.tagline, industry: c.industry, image: c.logoUrl, postingSchedule: c.postingSchedule };
  } else {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, headline: true, industry: true, image: true, postingSchedule: true },
    });
    if (u) displayUser = { name: u.name, headline: u.headline, industry: u.industry, image: u.image, postingSchedule: u.postingSchedule };
  }

  const [recentPlan, allPostCounts, newsletters, upcomingPosts] = await Promise.all([
    // Get most recent week's plan
    prisma.contentPlan.findFirst({
      where: { userId: session.user.id, companyProfileId },
      orderBy: { weekStart: "desc" },
    }),
    // Count all posts for this workspace
    prisma.post.groupBy({
      by: ["status"],
      where: { plan: { userId: session.user.id, companyProfileId } },
      _count: { _all: true },
    }),
    prisma.newsletter.count({ where: { userId: session.user.id, companyProfileId } }),
    // Upcoming posts across ALL plans — scheduled in the future and not yet posted
    prisma.post.findMany({
      where: {
        plan: { userId: session.user.id, companyProfileId },
        postedToLinkedIn: false,
        scheduledAt: { gt: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        postType: true,
        scheduledAt: true,
        status: true,
        weekNumber: true,
        postedToLinkedIn: true,
      },
    }),
  ]);

  // Also count posts that are posted to LinkedIn (safety net for status mismatch)
  const [linkedInPostedCount, latestScheduledPost, subscription] = await Promise.all([
    prisma.post.count({
      where: { plan: { userId: session.user.id, companyProfileId }, postedToLinkedIn: true },
    }),
    // Find the latest scheduled post to determine where the next batch should start
    prisma.post.findFirst({
      where: { plan: { userId: session.user.id, companyProfileId }, scheduledAt: { not: null } },
      orderBy: { scheduledAt: "desc" },
      select: { scheduledAt: true },
    }),
    // Subscription stays account-level (post quota is shared across all workspaces)
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { postsGeneratedThisCycle: true, currentPeriodEnd: true, status: true, createdAt: true, cyclePostsResetAt: true, trialEnd: true },
    }),
  ]);

  // Compute next batch start date
  let nextStartDate: Date;
  if (latestScheduledPost?.scheduledAt) {
    nextStartDate = new Date(latestScheduledPost.scheduledAt);
    nextStartDate.setDate(nextStartDate.getDate() + 1);
    nextStartDate.setHours(0, 0, 0, 0);
    // Skip weekends
    while (nextStartDate.getDay() === 0 || nextStartDate.getDay() === 6) {
      nextStartDate.setDate(nextStartDate.getDate() + 1);
    }
  } else {
    nextStartDate = new Date();
    nextStartDate.setHours(0, 0, 0, 0);
  }

  // Compute posts per batch based on the workspace's posting schedule
  const postingSchedule = displayUser?.postingSchedule
    ? (JSON.parse(displayUser.postingSchedule) as { days: string[]; time: string })
    : { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], time: "09:00" };
  const postsPerBatch = postingSchedule.days.length;

  // Check if trial is expired
  const isTrialExpired = subscription?.status === "trialing" &&
    subscription.trialEnd != null && subscription.trialEnd < now;

  // Compute posts remaining in billing cycle
  const POST_LIMIT = 30;
  let postsRemaining = POST_LIMIT;
  if (subscription) {
    // Reset counter if it's been more than 30 days since last reset
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (!subscription.cyclePostsResetAt || subscription.cyclePostsResetAt < thirtyDaysAgo) {
      postsRemaining = POST_LIMIT;
    } else {
      postsRemaining = POST_LIMIT - subscription.postsGeneratedThisCycle;
    }
  }

  // Build stats from grouped counts
  const statusMap = Object.fromEntries(
    allPostCounts.map((g) => [g.status, g._count._all])
  );
  const totalPosts = Object.values(statusMap).reduce((a, b) => a + b, 0);
  // Use the higher of status-based count or postedToLinkedIn count
  const publishedPosts = Math.max(statusMap["published"] ?? 0, linkedInPostedCount);
  // Subtract any mismatched posts from "ready" count (posts marked ready but already published)
  const readyPosts = Math.max(0, (statusMap["ready"] ?? 0) - Math.max(0, linkedInPostedCount - (statusMap["published"] ?? 0)));
  const draftPosts = statusMap["draft"] ?? 0;

  // Fallback: if no future posts, show the most recent posts so the section isn't blank
  let postsToShow = upcomingPosts;
  if (postsToShow.length === 0 && totalPosts > 0) {
    postsToShow = await prisma.post.findMany({
      where: { plan: { userId: session.user.id, companyProfileId } },
      orderBy: { scheduledAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        postType: true,
        scheduledAt: true,
        status: true,
        weekNumber: true,
        postedToLinkedIn: true,
      },
    });
  }

  return (
    <DashboardClient
      user={displayUser}
      recentPlan={
        recentPlan
          ? { id: recentPlan.id, strategy: recentPlan.strategy, weekStart: recentPlan.weekStart }
          : null
      }
      stats={{ totalPosts, readyPosts, draftPosts, publishedPosts, newsletters }}
      upcomingPosts={postsToShow}
      nextStartDate={nextStartDate.toISOString()}
      postsRemaining={postsRemaining}
      postsLimit={POST_LIMIT}
      isTrialExpired={isTrialExpired}
      postsPerBatch={postsPerBatch}
      postingDays={postingSchedule.days}
      cycleResetDate={subscription?.cyclePostsResetAt
        ? new Date(subscription.cyclePostsResetAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null}
    />
  );
}
