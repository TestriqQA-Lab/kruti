/**
 * POST /api/mobile/generate/strategy
 * Generates (or refreshes) the content strategy for the next week.
 * Adapted from app/api/generate/strategy/route.ts — mobile Bearer auth.
 *
 * Place at: app/api/mobile/generate/strategy/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON } from "@/lib/gemini";
import {
  buildStrategyPrompt,
  PreviousWeekSummary,
  deriveAllowedPostTypes,
} from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMobileUserId } from "@/lib/mobileAuth";

// Gemini generation + retry backoff can take >10s — give the function room
// so it doesn't time out (which surfaced to the app as a 500).
export const maxDuration = 60;

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

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Determine start date: continue from the day after the last scheduled post.
  let weekStart: Date;
  if (body.weekStart) {
    weekStart = new Date(body.weekStart);
  } else {
    const latestPost = await prisma.post.findFirst({
      where: { plan: { userId }, scheduledAt: { not: null } },
      orderBy: { scheduledAt: "desc" },
      select: { scheduledAt: true },
    });
    if (latestPost?.scheduledAt) {
      const nextDay = new Date(latestPost.scheduledAt);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 1);
      }
      weekStart = nextDay;
    } else {
      weekStart = new Date();
    }
  }
  weekStart.setHours(0, 0, 0, 0);

  const previousPlans = await prisma.contentPlan.findMany({
    where: { userId, weekStart: { lt: weekStart } },
    orderBy: { weekStart: "desc" },
    take: 4,
    include: {
      posts: {
        select: { title: true, postType: true },
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  const previousWeeks: PreviousWeekSummary[] = previousPlans.map((plan) => {
    let weekTheme = "Not specified";
    let weekFocus = "Not specified";
    try {
      const strat = JSON.parse(plan.strategy);
      weekTheme = strat.weekTheme || weekTheme;
      weekFocus = strat.weekFocus || weekFocus;
    } catch {
      /* strategy may not be valid JSON */
    }
    return {
      weekStart: plan.weekStart.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      weekTheme,
      weekFocus,
      postTitles: plan.posts.map((p) => p.title),
      postTypes: plan.posts.map((p) => p.postType),
    };
  });

  const profileContext = buildProfileContext(user);
  const allowedTypes = deriveAllowedPostTypes(user.contentStyles);
  const prompt = buildStrategyPrompt(
    profileContext,
    weekStart,
    previousWeeks,
    allowedTypes,
  );

  try {
    const raw = await generateText(prompt);
    const strategy = parseJSON(raw);

    const existingPlan = await prisma.contentPlan.findFirst({
      where: { userId, weekStart, companyProfileId: null },
    });
    const plan = existingPlan
      ? await prisma.contentPlan.update({
          where: { id: existingPlan.id },
          data: { strategy: JSON.stringify(strategy) },
        })
      : await prisma.contentPlan.create({
          data: {
            userId,
            weekStart,
            strategy: JSON.stringify(strategy),
          },
        });

    return NextResponse.json({
      plan,
      planId: plan.id,
      strategy,
      title:
        (strategy as { weekTheme?: string })?.weekTheme || "Strategy ready",
    });
  } catch (err) {
    console.error("[mobile strategy] generation error:", err);
    const m = String((err as { message?: string })?.message || "").toLowerCase();
    const quota =
      (err as { status?: number })?.status === 429 ||
      m.includes("spending cap") ||
      m.includes("quota") ||
      m.includes("exceeded");
    return NextResponse.json(
      {
        error: quota
          ? "AI generation is temporarily unavailable — the service usage limit was reached. Please try again later."
          : "Failed to generate strategy. Please try again.",
        code: quota ? "AI_LIMIT_REACHED" : "GENERATION_FAILED",
      },
      { status: quota ? 503 : 500 },
    );
  }
}
