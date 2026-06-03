/**
 * POST /api/mobile/posts/generate-images
 * Body: { postIds: string[], regenerate?: boolean }
 *
 * v2 change (mobile editor support):
 *   • `regenerate: true` lets the editor generate even when a post already
 *     has an image (still capped at imageGenCount < limit). Without the
 *     flag, behaviour is unchanged — only posts with imageUrl=null are
 *     eligible (used by the Dashboard bulk "generate images").
 *   • Returns `remaining` and `imageGenCount` for the first post so the
 *     editor can show "X of 2 remaining" / "Limit Reached".
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

  const { postIds, regenerate } = (await req.json()) as {
    postIds: string[];
    regenerate?: boolean;
  };
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
      // When regenerate is requested (single post from the editor) we allow
      // posts that already have an image. Otherwise keep the old behaviour
      // (only empty posts) for the Dashboard bulk action.
      ...(regenerate ? {} : { imageUrl: null }),
      imageGenCount: { lt: IMAGE_GEN_LIMIT_PER_POST },
    },
    include: {
      plan: { include: { user: { select: { industry: true } } } },
    },
  });

  if (posts.length === 0) {
    // Either already at the limit, or (non-regenerate) all already have
    // images. Tell the client the limit is exhausted so the UI can update.
    return NextResponse.json({
      error: "No eligible posts (already have images or limit reached)",
      generated: 0,
      remaining: 0,
    });
  }

  let generated = 0;
  const errors: string[] = [];
  let firstImageUrl: string | null = null;
  let firstNewCount: number | null = null;

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
        const newCount = post.imageGenCount + 1;
        await prisma.post.update({
          where: { id: post.id },
          data: {
            imageUrl,
            imagePrompt,
            imageGenCount: newCount,
          },
        });
        if (!firstImageUrl) {
          firstImageUrl = imageUrl;
          firstNewCount = newCount;
        }
        generated++;
      }
    } catch {
      errors.push(post.id);
    }
  }

  const remaining =
    firstNewCount != null
      ? Math.max(0, IMAGE_GEN_LIMIT_PER_POST - firstNewCount)
      : undefined;

  return NextResponse.json({
    generated,
    total: posts.length,
    imageUrl: firstImageUrl,
    imageGenCount: firstNewCount ?? undefined,
    remaining,
    results: posts
      .filter((p) => p.imageUrl || firstImageUrl)
      .map((p) => ({ id: p.id, imageUrl: p.imageUrl || firstImageUrl })),
    errors:
      errors.length > 0 ? `Failed for ${errors.length} post(s)` : undefined,
  });
}