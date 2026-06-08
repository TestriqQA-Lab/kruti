import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postToLinkedIn } from "@/lib/linkedin-post";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, reason } = await checkActiveSubscription(session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: reason, subscriptionRequired: true }, { status: 403 });
  }

  const rl = checkRateLimit(session.user.id, "linkedin-post", RATE_LIMITS.linkedinPost);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` }, { status: 429 });
  }

  const body = await req.json();
  const { postId } = body;

  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  // Validate post ownership
  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId: session.user.id } },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.postedToLinkedIn) {
    return NextResponse.json(
      { error: "Post has already been published to LinkedIn" },
      { status: 400 }
    );
  }

  const result = await postToLinkedIn(session.user.id, {
    title: post.title,
    body: post.body,
    hashtags: post.hashtags,
    imageUrl: post.imageUrl,
    carouselImages: post.carouselImages ? (JSON.parse(post.carouselImages) as string[]) : null,
    customSignature: post.customSignature,
  });

  // Update post record
  const updated = await prisma.post.update({
    where: { id: postId },
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
  } else {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 }
    );
  }
}
