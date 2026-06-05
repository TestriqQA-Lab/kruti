import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildPostsPrompt, deriveAllowedPostTypes } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { getNextScheduledSlots } from "@/lib/timezone";
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

  const rl = checkRateLimit(session.user.id, "generate", RATE_LIMITS.generation);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` }, { status: 429 });
  }

  const body = await req.json();
  const { planId } = body;

  const plan = await prisma.contentPlan.findFirst({
    where: { id: planId, userId: session.user.id },
  });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // If this plan belongs to a company workspace, use that company's preferences
  const company = plan.companyProfileId
    ? await prisma.companyProfile.findFirst({
        where: { id: plan.companyProfileId, userId: session.user.id },
      })
    : null;
  const source = company
    ? {
        ...user,
        name: company.name,
        headline: company.tagline,
        summary: company.about,
        skills: null,
        industry: company.industry,
        positioning: company.positioning,
        contentGoals: company.contentGoals,
        contentStyles: company.contentStyles,
        targetAudience: company.targetAudience,
        tonePrefs: company.tonePrefs,
        humanMode: company.humanMode,
        postingSchedule: company.postingSchedule,
        postSignature: company.postSignature,
        timezone: company.timezone,
      }
    : user;

  // Determine how many posts to generate based on the workspace's posting schedule
  const schedule = source.postingSchedule
    ? (JSON.parse(source.postingSchedule) as { days: string[]; time: string })
    : { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], time: "09:00" };
  const postCount = schedule.days.length; // one post per scheduled day

  // ── Enforce 30-post limit per billing cycle ──
  const POST_LIMIT_PER_CYCLE = 30;
  const subscription = user.subscription;

  if (subscription) {
    // Reset counter if it's been more than 30 days since last reset
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (!subscription.cyclePostsResetAt || subscription.cyclePostsResetAt < thirtyDaysAgo) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { postsGeneratedThisCycle: 0, cyclePostsResetAt: new Date() },
      });
      subscription.postsGeneratedThisCycle = 0;
    }

    // Check limit
    if (subscription.postsGeneratedThisCycle + postCount > POST_LIMIT_PER_CYCLE) {
      const remaining = POST_LIMIT_PER_CYCLE - subscription.postsGeneratedThisCycle;
      return NextResponse.json(
        {
          error: `Post generation limit reached for this billing cycle. You have ${remaining} post(s) remaining out of ${POST_LIMIT_PER_CYCLE}.`,
          postsRemaining: remaining,
          postsLimit: POST_LIMIT_PER_CYCLE,
        },
        { status: 429 }
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

  const profileContext = buildProfileContext(source);
  const humanMode = source.humanMode ?? false;

  const allowedTypes = deriveAllowedPostTypes(source.contentStyles);

  const prompt = buildPostsPrompt(
    profileContext,
    strategy.weekTheme ?? "Professional Growth",
    strategy.weekFocus ?? "Sharing expertise",
    strategy.postTypes ?? allowedTypes,
    { pillars: strategy.pillars, tone: strategy.tone, postMix: strategy.postMix },
    humanMode,
    postCount,
    allowedTypes
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

    // Schedule posts on the user's chosen posting days using their timezone and preferred time
    const weekStart = new Date(plan.weekStart);
    const timezone = source.timezone || "Asia/Kolkata";
    const postingSlots = getNextScheduledSlots(weekStart, schedule.days, schedule.time, timezone);

    // Create posts, cycling through available slots if fewer slots than posts
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
            status: "draft", // user must review, add image, and mark as ready
          },
        });
      })
    );

    // Increment billing cycle counter
    let postsRemaining = POST_LIMIT_PER_CYCLE;
    if (subscription) {
      const newCount = subscription.postsGeneratedThisCycle + createdPosts.length;
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
    console.error("Posts generation error:", err);
    return NextResponse.json({ error: "Failed to generate posts" }, { status: 500 });
  }
}
