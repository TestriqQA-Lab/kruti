/**
 * POST /api/mobile/generate/posts
 * Generates posts for a content plan. If no planId is given in the body,
 * uses the user's most recent content plan (mobile flow: strategy -> posts).
 * Adapted from app/api/generate/posts/route.ts — mobile Bearer auth.
 *
 * Place at: app/api/mobile/generate/posts/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildPostsPrompt, deriveAllowedPostTypes } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { getNextScheduledSlots } from "@/lib/timezone";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMobileUserId } from "@/lib/mobileAuth";

const POST_LIMIT_PER_CYCLE = 30;

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

  const rl = checkRateLimit(userId, "generate", RATE_LIMITS.generation);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => ({}));

  // Use given planId, else the most recent plan for this user.
  const plan = body.planId
    ? await prisma.contentPlan.findFirst({
        where: { id: body.planId, userId },
      })
    : await prisma.contentPlan.findFirst({
        where: { userId },
        orderBy: { weekStart: "desc" },
      });

  if (!plan) {
    return NextResponse.json(
      { error: "No content plan found. Generate a strategy first." },
      { status: 404 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const schedule = user.postingSchedule
    ? (JSON.parse(user.postingSchedule) as { days: string[]; time: string })
    : {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        time: "09:00",
      };
  const postCount = schedule.days.length;

  // ── 30-post cycle limit ──
  const subscription = user.subscription;
  if (subscription) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    if (
      !subscription.cyclePostsResetAt ||
      subscription.cyclePostsResetAt < thirtyDaysAgo
    ) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { postsGeneratedThisCycle: 0, cyclePostsResetAt: new Date() },
      });
      subscription.postsGeneratedThisCycle = 0;
    }
    if (
      subscription.postsGeneratedThisCycle + postCount >
      POST_LIMIT_PER_CYCLE
    ) {
      const remaining =
        POST_LIMIT_PER_CYCLE - subscription.postsGeneratedThisCycle;
      return NextResponse.json(
        {
          error: `Post limit reached for this cycle. ${remaining} of ${POST_LIMIT_PER_CYCLE} remaining.`,
          postsRemaining: remaining,
          postsLimit: POST_LIMIT_PER_CYCLE,
        },
        { status: 429 },
      );
    }
  }

  const strategy = JSON.parse(plan.strategy) as {
    weekTheme: string;
    weekFocus: string;
    postTypes: string[];
    pillars: object[];
    tone: object;
    postMix: object;
  };

  const profileContext = buildProfileContext(user);
  const humanMode = user.humanMode ?? false;
  const allowedTypes = deriveAllowedPostTypes(user.contentStyles);

  const prompt = buildPostsPrompt(
    profileContext,
    strategy.weekTheme ?? "Professional Growth",
    strategy.weekFocus ?? "Sharing expertise",
    strategy.postTypes ?? allowedTypes,
    { pillars: strategy.pillars, tone: strategy.tone, postMix: strategy.postMix },
    humanMode,
    postCount,
    allowedTypes,
  );

  try {
    const raw = await generateText(prompt);
    const posts = parseJSON<
      Array<{
        title: string;
        body: string;
        hashtags: string[];
        postType: string;
        imagePrompt: string;
        bestTimeToPost: string;
        callToAction: string;
      }>
    >(raw);

    const weekStart = new Date(plan.weekStart);
    const timezone = user.timezone || "Asia/Kolkata";
    const postingSlots = getNextScheduledSlots(
      weekStart,
      schedule.days,
      schedule.time,
      timezone,
    );

    const createdPosts = await Promise.all(
      posts.map(async (post, idx) => {
        let scheduledAt: Date | undefined;
        if (postingSlots.length > 0) {
          scheduledAt = postingSlots[idx % postingSlots.length];
        }
        return prisma.post.create({
          data: {
            planId: plan.id,
            title: post.title,
            body: post.body,
            hashtags: JSON.stringify(post.hashtags),
            postType: post.postType,
            imagePrompt: post.imagePrompt,
            weekNumber: 1,
            scheduledAt,
            status: "draft",
          },
        });
      }),
    );

    let postsRemaining = POST_LIMIT_PER_CYCLE;
    if (subscription) {
      const newCount =
        subscription.postsGeneratedThisCycle + createdPosts.length;
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          postsGeneratedThisCycle: newCount,
          cyclePostsResetAt: subscription.cyclePostsResetAt ?? new Date(),
        },
      });
      postsRemaining = POST_LIMIT_PER_CYCLE - newCount;
    }

    return NextResponse.json({
      posts: createdPosts,
      weekTheme: strategy.weekTheme,
      postsRemaining,
      postsLimit: POST_LIMIT_PER_CYCLE,
    });
  } catch (err) {
    console.error("[mobile posts] generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate posts" },
      { status: 500 },
    );
  }
}
