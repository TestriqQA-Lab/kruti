import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildStrategyPrompt, PreviousWeekSummary, deriveAllowedPostTypes } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getActiveWorkspaceId } from "@/lib/company";

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

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Resolve the active workspace (null = Personal, else a company the user owns)
  const companyProfileId = await getActiveWorkspaceId(session.user.id);
  const company = companyProfileId
    ? await prisma.companyProfile.findFirst({
        where: { id: companyProfileId, userId: session.user.id },
      })
    : null;
  // Preference source used for the prompt: the company (if active) else the user
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

  // Determine the start date: auto-continue from the day after the last scheduled post
  let weekStart: Date;
  if (body.weekStart) {
    weekStart = new Date(body.weekStart);
  } else {
    // Find the user's latest scheduled post
    const latestPost = await prisma.post.findFirst({
      where: { plan: { userId: user.id, companyProfileId }, scheduledAt: { not: null } },
      orderBy: { scheduledAt: "desc" },
      select: { scheduledAt: true },
    });

    if (latestPost?.scheduledAt) {
      // Start from the next day after the last scheduled post
      const nextDay = new Date(latestPost.scheduledAt);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      // Skip to next weekday if it lands on a weekend
      while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay.setDate(nextDay.getDate() + 1);
      }
      weekStart = nextDay;
    } else {
      // No posts yet — start from today
      weekStart = new Date();
    }
  }
  weekStart.setHours(0, 0, 0, 0);

  // Fetch previous plans (up to 4) with their posts for continuity
  const previousPlans = await prisma.contentPlan.findMany({
    where: {
      userId: user.id,
      companyProfileId,
      weekStart: { lt: weekStart }, // only weeks before the selected week
    },
    orderBy: { weekStart: "desc" },
    take: 4,
    include: {
      posts: {
        select: { title: true, postType: true },
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  // Build previous weeks summary for the prompt
  const previousWeeks: PreviousWeekSummary[] = previousPlans.map((plan) => {
    let weekTheme = "Not specified";
    let weekFocus = "Not specified";
    try {
      const strat = JSON.parse(plan.strategy);
      weekTheme = strat.weekTheme || weekTheme;
      weekFocus = strat.weekFocus || weekFocus;
    } catch {
      // strategy might not be valid JSON
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

  const profileContext = buildProfileContext(source);
  const allowedTypes = deriveAllowedPostTypes(source.contentStyles);
  const prompt = buildStrategyPrompt(profileContext, weekStart, previousWeeks, allowedTypes);

  try {
    const raw = await generateText(prompt);
    const strategy = parseJSON(raw);

    const existing = await prisma.contentPlan.findFirst({
      where: { userId: user.id, companyProfileId, weekStart },
      select: { id: true },
    });
    const plan = existing
      ? await prisma.contentPlan.update({
          where: { id: existing.id },
          data: { strategy: JSON.stringify(strategy) },
        })
      : await prisma.contentPlan.create({
          data: { userId: user.id, companyProfileId, weekStart, strategy: JSON.stringify(strategy) },
        });

    return NextResponse.json({ plan, strategy });
  } catch (err) {
    console.error("Strategy generation error:", err);
    return NextResponse.json({ error: "Failed to generate strategy" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyProfileId = await getActiveWorkspaceId(session.user.id);

  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get("weekStart");

  if (weekStartParam) {
    const weekStart = new Date(weekStartParam);
    weekStart.setHours(0, 0, 0, 0);
    const plan = await prisma.contentPlan.findFirst({
      where: { userId: session.user.id, companyProfileId, weekStart },
      include: { posts: { orderBy: { scheduledAt: "asc" } } },
    });
    return NextResponse.json(plan);
  }

  // Return most recent plan
  const plan = await prisma.contentPlan.findFirst({
    where: { userId: session.user.id, companyProfileId },
    orderBy: { weekStart: "desc" },
    include: { posts: { orderBy: { scheduledAt: "asc" } } },
  });
  return NextResponse.json(plan);
}

