/**
 * GET /api/mobile/dashboard/stats
 * Returns post counts, subscription/cycle info, and the latest strategy.
 *
 * Place at: app/api/mobile/dashboard/stats/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

const POST_LIMIT_PER_CYCLE = 30;

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, plans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    }),
    prisma.contentPlan.findMany({
      where: { userId },
      include: { posts: true },
      orderBy: { weekStart: "desc" },
    }),
  ]);

  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const allPosts = plans.flatMap((p) => p.posts);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const totalPosts = allPosts.length;
  const postsThisWeek = allPosts.filter(
    (p) => p.createdAt && new Date(p.createdAt) >= weekAgo,
  ).length;
  const ready = allPosts.filter((p) => p.status === "ready").length;
  const published = allPosts.filter(
    (p) => p.postedToLinkedIn || p.status === "published",
  ).length;
  const drafts = allPosts.filter((p) => p.status === "draft").length;

  const sub = user.subscription;
  const used = sub?.postsGeneratedThisCycle ?? 0;
  const postsRemaining = Math.max(0, POST_LIMIT_PER_CYCLE - used);

  // Latest strategy (most recent plan)
  let latestStrategy: string | null = null;
  const latestPlan = plans[0];
  if (latestPlan?.strategy) {
    try {
      const s = JSON.parse(latestPlan.strategy);
      latestStrategy =
        s.weekTheme || s.weekFocus || s.title || "Strategy ready";
    } catch {
      latestStrategy = null;
    }
  }

  return NextResponse.json({
    stats: {
      totalPosts,
      postsThisWeek,
      ready,
      published,
      drafts,
    },
    subscription: {
      status: sub?.status ?? "none",
      trialEnd: sub?.trialEnd ?? null,
      currentPeriodEnd: sub?.currentPeriodEnd ?? null,
      postsLimit: POST_LIMIT_PER_CYCLE,
      postsRemaining,
    },
    postsThisCycle: used,
    cycleLimit: POST_LIMIT_PER_CYCLE,
    cycleResetDate: sub?.cyclePostsResetAt ?? null,
    latestStrategy,
  });
}
