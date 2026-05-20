/**
 * Mobile Dashboard Stats (v2 — matches web exactly)
 * GET /api/mobile/dashboard/stats
 *
 * Returns KPIs queried through ContentPlan (matches web structure).
 * Includes trial info, cycle counter, recent posts.
 */

import { NextRequest, NextResponse } from "next/server";
import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const decoded = await decode({ token, secret });
    if (!decoded?.uid) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const userId = decoded.uid as string;
    const now = new Date();

    // Query posts via plan relation (matches web)
    const [user, postCounts, publishedCount, upcomingPosts, recentPlan] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { subscription: true },
      }),
      prisma.post.groupBy({
        by: ["status"],
        where: { plan: { userId } },
        _count: { _all: true },
      }),
      prisma.post.count({
        where: { plan: { userId }, postedToLinkedIn: true },
      }),
      prisma.post.findMany({
        where: {
          plan: { userId },
          postedToLinkedIn: false,
          scheduledAt: { gt: now },
        },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          body: true,
          postType: true,
          scheduledAt: true,
          status: true,
          postedToLinkedIn: true,
          imageUrl: true,
        },
      }),
      prisma.contentPlan.findFirst({
        where: { userId },
        orderBy: { weekStart: "desc" },
        select: { id: true, weekStart: true, strategy: true },
      }),
    ]);

    // Calculate stats (matches web's statCards)
    let totalPosts = 0;
    let readyPosts = 0;
    let draftPosts = 0;
    let publishedPosts = publishedCount;
    for (const c of postCounts) {
      totalPosts += c._count._all;
      if (c.status === "ready") readyPosts = c._count._all;
      if (c.status === "draft") draftPosts = c._count._all;
      if (c.status === "published") publishedPosts = Math.max(publishedPosts, c._count._all);
    }

    // Trial info
    const sub = user?.subscription;
    const isTrialExpired =
      sub?.status === "trialing" && sub.trialEnd != null && sub.trialEnd < now;
    let daysLeftInTrial = 0;
    if (sub?.trialEnd) {
      const ms = new Date(sub.trialEnd).getTime() - now.getTime();
      daysLeftInTrial = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    // Posts remaining (POST_LIMIT = 30 per cycle)
    const POST_LIMIT = 30;
    const postsGenerated = sub?.postsGeneratedThisCycle ?? 0;
    const postsRemaining = Math.max(0, POST_LIMIT - postsGenerated);

    return NextResponse.json({
      stats: {
        totalPosts,
        readyPosts,
        draftPosts,
        publishedPosts,
      },
      subscription: {
        status: sub?.status ?? "none",
        daysLeftInTrial,
        isTrialExpired,
        trialEnd: sub?.trialEnd?.toISOString() ?? null,
        postsRemaining,
        postsLimit: POST_LIMIT,
        currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      },
      upcomingPosts,
      recentPlan: recentPlan
        ? {
            id: recentPlan.id,
            weekStart: recentPlan.weekStart.toISOString(),
            strategy: recentPlan.strategy,
          }
        : null,
      user: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        image: user?.image,
        headline: user?.headline,
        industry: user?.industry,
      },
    });
  } catch (err: any) {
    console.error("[mobile/dashboard/stats] error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
