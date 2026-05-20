/**
 * Mobile Posts List (v2 — matches web)
 * GET /api/mobile/posts?status=draft|ready|published
 *
 * Returns posts via ContentPlan (matches web data model).
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
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const plans = await prisma.contentPlan.findMany({
      where: { userId },
      include: {
        posts: {
          where: statusFilter ? { status: statusFilter } : undefined,
          orderBy: { scheduledAt: "asc" },
        },
      },
      orderBy: { weekStart: "desc" },
      take: 8,
    });

    const posts = plans.flatMap((plan) =>
      plan.posts.map((post) => ({
        id: post.id,
        title: post.title,
        body: post.body,
        postType: post.postType,
        status: post.status,
        scheduledAt: post.scheduledAt,
        imageUrl: post.imageUrl,
        hashtags: post.hashtags,
        postedToLinkedIn: post.postedToLinkedIn,
        linkedinPostId: post.linkedinPostId,
        weekStart: plan.weekStart,
      }))
    );

    return NextResponse.json({
      posts,
      total: posts.length,
    });
  } catch (err: any) {
    console.error("[mobile/posts] error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
