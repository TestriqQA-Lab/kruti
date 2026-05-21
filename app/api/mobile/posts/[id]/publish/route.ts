/**
 * POST /api/mobile/posts/[id]/publish
 * Publishes a post to LinkedIn.
 * Adapted from app/api/post-to-linkedin/route.ts — mobile Bearer auth.
 *
 * Place at: app/api/mobile/posts/[id]/publish/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postToLinkedIn } from "@/lib/linkedin-post";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, reason } = await checkActiveSubscription(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: reason, subscriptionRequired: true },
      { status: 403 },
    );
  }

  const rl = checkRateLimit(userId, "linkedin-post", RATE_LIMITS.linkedinPost);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` },
      { status: 429 },
    );
  }

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
  });
  if (!post)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (post.postedToLinkedIn) {
    return NextResponse.json(
      { error: "Post has already been published to LinkedIn" },
      { status: 400 },
    );
  }

  const result = await postToLinkedIn(userId, {
    title: post.title,
    body: post.body,
    hashtags: post.hashtags,
    imageUrl: post.imageUrl,
    customSignature: post.customSignature,
  });

  const updated = await prisma.post.update({
    where: { id: params.id },
    data: {
      postedToLinkedIn: result.success,
      linkedinPostId: result.linkedinPostId ?? undefined,
      status: result.success ? "published" : post.status,
      postError: result.error ?? null,
    },
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      linkedinPostId: result.linkedinPostId,
      post: updated,
    });
  }
  return NextResponse.json(
    { success: false, error: result.error || "Failed to publish" },
    { status: 502 },
  );
}
