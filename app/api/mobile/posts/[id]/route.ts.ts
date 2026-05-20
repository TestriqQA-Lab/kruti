/**
 * Mobile Post Detail Endpoint
 * GET /api/mobile/posts/[id]
 *
 * Returns full post details with hashtags, image, scheduling info.
 */

import { NextRequest, NextResponse } from "next/server";
import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const postId = params.id;

    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        plan: { userId }, // ensure post belongs to current user
      },
      include: {
        plan: {
          select: { weekStart: true, strategy: true },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: post.id,
      title: post.title,
      body: post.body,
      postType: post.postType,
      status: post.status,
      scheduledAt: post.scheduledAt,
      imageUrl: post.imageUrl,
      imagePrompt: post.imagePrompt,
      hashtags: post.hashtags,
      postedToLinkedIn: post.postedToLinkedIn,
      linkedinPostId: post.linkedinPostId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      weekStart: post.plan.weekStart,
    });
  } catch (err: any) {
    console.error("[mobile/posts/[id]] error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
