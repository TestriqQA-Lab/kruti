import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCarouselImages, generateCarouselFromPlan, buildImagePrompt, lastImageGenError } from "@/lib/imagen";
import { getCarouselPlan } from "@/lib/image-brief";
import { appendImageHistory } from "@/lib/image-history";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Generating 4 images can take longer than the default serverless limit.
export const maxDuration = 60;

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

  // A carousel generation consumes one of the per-post image generations (Admins have no limits).
  const isAdmin = post.plan.user.role === "admin";
  if (!isAdmin && post.imageGenCount >= IMAGE_GEN_LIMIT_PER_POST) {
    return NextResponse.json(
      {
        error: `Image generation limit reached (${IMAGE_GEN_LIMIT_PER_POST} per post). You can still upload custom images.`,
        remaining: 0,
        limit: IMAGE_GEN_LIMIT_PER_POST,
      },
      { status: 429 }
    );
  }

  const industry = post.plan.user.industry || "business";
  const userVisualProfile = {
    positioning: post.plan.user.positioning,
    contentStyles: post.plan.user.contentStyles,
    industry,
    name: post.plan.user.name,
    headline: post.plan.user.headline, // the actual ROLE that drives the imagery
  };

  // Content-aware: plan a cohesive carousel from THIS post (hook -> key points ->
  // takeaway), each slide a branded graphic with its own short headline. Fall back
  // to the legacy generic carousel only if planning fails.
  const plan = await getCarouselPlan(
    { title: post.title, body: post.body, postType: post.postType },
    industry,
    CAROUSEL_COUNT,
    userVisualProfile
  );

  let images: string[];
  let savedPrompt: string;
  if (plan && plan.slides.length >= 2) {
    images = await generateCarouselFromPlan(plan, post.id, industry);
    savedPrompt = plan.slides.map((s) => s.headline).join(" / ");
  } else {
    const basePrompt = buildImagePrompt(post.title, post.postType, industry, userVisualProfile.headline ?? undefined);
    images = await generateCarouselImages(basePrompt, post.id, industry, CAROUSEL_COUNT);
    savedPrompt = basePrompt;
  }

  if (images.length === 0) {
    return NextResponse.json(
      { error: lastImageGenError || "Carousel generation failed - no images were produced." },
      { status: 500 }
    );
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      carouselImages: JSON.stringify(images),
      imageUrl: images[0], // first slide doubles as the single-image fallback
      imagePrompt: savedPrompt,
      imageGenCount: post.imageGenCount + 1,
      // Keep the whole carousel set in history so it can be restored later
      imageHistory: appendImageHistory(post.imageHistory, images),
      // Images and a PDF document are mutually exclusive on LinkedIn
      documentUrl: null,
      documentName: null,
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
