import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTextWithConfig, parseJSON } from "@/lib/gemini";
import { buildRepurposePrompt, REPURPOSE_FORMAT_NAMES } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
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
  const { postId } = body;

  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId: session.user.id } },
    include: { plan: true },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Determine effective human mode
  const effectiveHumanMode =
    post.humanModeOverride !== null && post.humanModeOverride !== undefined
      ? post.humanModeOverride
      : (user.humanMode ?? true);

  const profileContext = buildProfileContext(user);
  const hashtags: string[] = post.hashtags ? JSON.parse(post.hashtags) : [];

  try {
    // Generate all 3 formats in parallel
    const repurposePromises = REPURPOSE_FORMAT_NAMES.map((format) => {
      const prompt = buildRepurposePrompt(
        profileContext,
        post.title,
        post.body,
        hashtags,
        format,
        effectiveHumanMode
      );
      return generateTextWithConfig(prompt, { temperature: 0.8 })
        .then((raw) => {
          const parsed = parseJSON(raw);
          return { format, content: parsed };
        });
    });

    const results = await Promise.all(repurposePromises);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("Repurpose generation error:", err);
    return NextResponse.json({ error: "Failed to repurpose content" }, { status: 500 });
  }
}
