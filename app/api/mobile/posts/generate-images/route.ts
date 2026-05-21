/**
 * POST /api/mobile/posts/generate-images
 * Body: { postIds: string[] }
 * Generates AI images for posts that don't have one yet.
 * Adapted from app/api/generate/image/bulk/route.ts — mobile Bearer auth.
 *
 * Place at: app/api/mobile/posts/generate-images/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generatePostImage, buildImagePrompt } from "@/lib/imagen";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { getMobileUserId } from "@/lib/mobileAuth";

const IMAGE_GEN_LIMIT_PER_POST = 2;

export async function POST(req: NextRequest) {
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

  const { postIds } = (await req.json()) as { postIds: string[] };
  if (!Array.isArray(postIds) || postIds.length === 0 || postIds.length > 10) {
    return NextResponse.json(
      { error: "Provide 1-10 post IDs" },
      { status: 400 },
    );
  }

  const posts = await prisma.post.findMany({
    where: {
      id: { in: postIds },
      plan: { userId },
      imageUrl: null,
      imageGenCount: { lt: IMAGE_GEN_LIMIT_PER_POST },
    },
    include: {
      plan: { include: { user: { select: { industry: true } } } },
    },
  });

  if (posts.length === 0) {
    return NextResponse.json({
      error: "No eligible posts (already have images or limit reached)",
      generated: 0,
    });
  }

  let generated = 0;
  const errors: string[] = [];
  let firstImageUrl: string | null = null;

  for (const post of posts) {
    try {
      const imagePrompt =
        post.imagePrompt ||
        buildImagePrompt(
          post.title,
          post.postType,
          post.plan.user.industry || "business",
        );
      const imageUrl = await generatePostImage(
        imagePrompt,
        post.id,
        post.plan.user.industry || "business",
      );
      if (imageUrl) {
        await prisma.post.update({
          where: { id: post.id },
          data: {
            imageUrl,
            imagePrompt,
            imageGenCount: post.imageGenCount + 1,
          },
        });
        if (!firstImageUrl) firstImageUrl = imageUrl;
        generated++;
      }
    } catch {
      errors.push(post.id);
    }
  }

  return NextResponse.json({
    generated,
    total: posts.length,
    imageUrl: firstImageUrl,
    results: posts
      .filter((p) => p.imageUrl || firstImageUrl)
      .map((p) => ({ id: p.id, imageUrl: p.imageUrl || firstImageUrl })),
    errors:
      errors.length > 0 ? `Failed for ${errors.length} post(s)` : undefined,
  });
}
