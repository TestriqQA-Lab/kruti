/**
 * POST /api/mobile/posts/[id]/regenerate
 * Body (optional): { humanMode?: boolean }
 *
 * Regenerates a single post's text. If `humanMode` is sent, it is persisted
 * as the post's humanModeOverride first, then used for generation. Otherwise
 * the effective mode = post.humanModeOverride ?? user.humanMode.
 *
 * Mobile (Bearer) version of the web single-post regenerate route.
 * Place at: app/api/mobile/posts/[id]/regenerate/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildSinglePostPrompt } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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

  const rl = checkRateLimit(userId, "generate", RATE_LIMITS.generation);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` },
      { status: 429 },
    );
  }

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
    include: { plan: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Optional body: set + persist the per-post override before generating.
  let override: boolean | null | undefined = post.humanModeOverride;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.humanMode === "boolean") {
      override = body.humanMode;
      await prisma.post.update({
        where: { id: post.id },
        data: { humanModeOverride: body.humanMode },
      });
    }
  } catch {
    /* no body — fine */
  }

  const strategy = JSON.parse(post.plan.strategy) as {
    weekTheme?: string;
    weeks?: Array<{ weekNumber: number; theme: string }>;
  };
  const weekTheme =
    strategy.weekTheme ??
    strategy.weeks?.find((w) => w.weekNumber === post.weekNumber)?.theme ??
    "Professional Insights";

  const effectiveHumanMode =
    override !== null && override !== undefined
      ? override
      : (user.humanMode ?? false);

  const profileContext = buildProfileContext(user);
  const prompt = buildSinglePostPrompt(
    profileContext,
    post.title,
    post.postType,
    weekTheme,
    effectiveHumanMode,
  );

  try {
    const raw = await generateText(prompt);
    const generated = parseJSON<{
      title: string;
      body: string;
      hashtags: string[];
      imagePrompt: string;
    }>(raw);

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        title: generated.title,
        body: generated.body,
        hashtags: JSON.stringify(generated.hashtags ?? []),
        imagePrompt: generated.imagePrompt,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[mobile/posts/[id]/regenerate] error:", err);
    return NextResponse.json(
      { error: "Failed to regenerate post" },
      { status: 500 },
    );
  }
}