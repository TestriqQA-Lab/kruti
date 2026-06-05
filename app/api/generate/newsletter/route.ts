import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildNewsletterPrompt } from "@/lib/prompts";
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
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  // Support optional weekStart param; otherwise use the most recent plan
  const weekStart = body.weekStart ? new Date(body.weekStart) : null;

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Resolve the active workspace (null = Personal, else a company the user owns)
  const companyProfileId = await getActiveWorkspaceId(session.user.id);
  const company = companyProfileId
    ? await prisma.companyProfile.findFirst({
        where: { id: companyProfileId, userId: session.user.id },
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

  // Get the most recent (or specified week's) content plan for context
  const plan = weekStart
    ? await prisma.contentPlan.findFirst({
        where: {
          userId: session.user.id,
          companyProfileId,
          weekStart: {
            gte: weekStart,
            lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      })
    : await prisma.contentPlan.findFirst({
        where: { userId: session.user.id, companyProfileId },
        orderBy: { weekStart: "desc" },
      });

  const pillars = plan
    ? (JSON.parse(plan.strategy) as { pillars: object[] }).pillars
    : [
        { name: "Industry Insights", description: "Expert analysis and trends" },
        { name: "Professional Growth", description: "Career development tips" },
        { name: "Personal Stories", description: "Authentic experiences" },
      ];

  const profileContext = buildProfileContext(source);
  const prompt = buildNewsletterPrompt(profileContext, pillars, month, year);

  try {
    const raw = await generateText(prompt);
    const newsletter = parseJSON<{
      title: string;
      subject: string;
      intro: { hook: string; preview: string };
      sections: Array<{ heading: string; content: string; keyTakeaway: string }>;
      featuredInsight: { quote: string; context: string };
      cta: { heading: string; text: string; action: string };
      signoff: string;
    }>(raw);

    const created = await prisma.newsletter.create({
      data: {
        userId: session.user.id,
        companyProfileId,
        title: newsletter.title,
        subject: newsletter.subject,
        body: JSON.stringify(newsletter),
        pillars: JSON.stringify(pillars),
        status: "draft",
      },
    });

    return NextResponse.json({ newsletter: created, content: newsletter });
  } catch (err) {
    console.error("Newsletter generation error:", err);
    return NextResponse.json({ error: "Failed to generate newsletter" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyProfileId = await getActiveWorkspaceId(session.user.id);
  const newsletters = await prisma.newsletter.findMany({
    where: { userId: session.user.id, companyProfileId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(newsletters);
}
