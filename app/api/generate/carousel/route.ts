import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCarouselImages, buildImagePrompt, lastImageGenError } from "@/lib/imagen";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const IMAGE_GEN_LIMIT_PER_POST = 2;
const CAROUSEL_COUNT = 4;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, reason } = await checkActiveSubscription(session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: reason, subscriptionRequired: true }, { status: 403 });
  }

  const rl = checkRateLimit(session.user.id, "image-gen", RATE_LIMITS.imageGeneration);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` }, { status: 429 });
  }

  const body = await req.json();
  const { postId } = body;

  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId: session.user.id } },
    include: { plan: { include: { user: true } } },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // A carousel generation consumes one of the per-post image generations.
  if (post.imageGenCount >= IMAGE_GEN_LIMIT_PER_POST) {
    return NextResponse.json(
      {
        error: `Image generation limit reached (${IMAGE_GEN_LIMIT_PER_POST} per post). You can still upload custom images.`,
        remaining: 0,
        limit: IMAGE_GEN_LIMIT_PER_POST,
      },
      { status: 429 }
    );
  }

  const basePrompt =
    post.imagePrompt ||
    buildImagePrompt(post.title, post.postType, post.plan.user.industry || "business");

  const images = await generateCarouselImages(
    basePrompt,
    post.id,
    post.plan.user.industry || "business",
    CAROUSEL_COUNT
  );

  if (images.length === 0) {
    return NextResponse.json(
      { error: lastImageGenError || "Carousel generation failed — no images were produced." },
      { status: 500 }
    );
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      carouselImages: JSON.stringify(images),
      imageUrl: images[0], // first slide doubles as the single-image fallback
      imagePrompt: basePrompt,
      imageGenCount: post.imageGenCount + 1,
    },
  });

  const remaining = IMAGE_GEN_LIMIT_PER_POST - (post.imageGenCount + 1);

  return NextResponse.json({
    carouselImages: images,
    imageUrl: images[0],
    count: images.length,
    remaining,
    limit: IMAGE_GEN_LIMIT_PER_POST,
  });
}
