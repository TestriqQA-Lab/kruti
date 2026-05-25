/**
 * Mobile Posts List (v3 — adds per-post customSignature)
 * GET /api/mobile/posts?status=draft|ready|published
 *
 * v3 change: each post now includes `customSignature` so the mobile
 * post-detail screen can show + edit a per-post signature.
 *
 * Place at: app/api/mobile/posts/route.ts
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
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
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
        // Per-post signature — lets the mobile editor show/edit it.
        customSignature: (post as any).customSignature ?? null,
        weekStart: plan.weekStart,
      })),
    );

    return NextResponse.json({
      posts,
      total: posts.length,
    });
  } catch (err: any) {
    console.error("[mobile/posts] error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}