import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateText } from "@/lib/gemini";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const MAX_AUDIENCE_CHARS = 300; // must match the textarea cap in OnboardingWizard

function cleanStr(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function cleanList(value: unknown, maxItems = 30, maxLen = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Map raw model/API errors to a short, user-facing message. */
function friendlyGenError(raw: string): string {
  const m = (raw || "").toLowerCase();
  if (
    m.includes("spending cap") ||
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("exceeded") ||
    m.includes("429")
  ) {
    return "AI is temporarily unavailable — the monthly quota has been reached. Please write your audience manually for now.";
  }
  return "Couldn't generate the audience right now. Please try again, or write it manually.";
}

/**
 * Generate a target-audience description from the in-progress onboarding answers.
 * Pre-subscription (runs during onboarding) — auth + rate-limit only.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(session.user.id, "onboarding-audience", RATE_LIMITS.generation);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Please try again in ${rl.retryAfterSecs}s.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const headline = cleanStr(body.headline, 300);
  const industry = cleanStr(body.industry, 100);
  const summary = cleanStr(body.summary, 1500);
  const positioning = cleanStr(body.positioning, 100);
  const contentGoals = cleanList(body.contentGoals);
  const contentStyles = cleanList(body.contentStyles);

  // Need at least some context to tailor the audience.
  if (!headline && !industry && !positioning && contentGoals.length === 0) {
    return NextResponse.json(
      { error: "Fill in the earlier steps first so we can tailor your audience." },
      { status: 400 }
    );
  }

  const prompt = `You are helping a LinkedIn creator define the ideal target audience for their AI content strategy.

Creator profile:
- Headline: ${headline || "—"}
- Industry: ${industry || "—"}
- About / summary: ${summary || "—"}
- Content positioning: ${positioning || "—"}
- Content goals: ${contentGoals.join(", ") || "—"}
- Preferred content styles: ${contentStyles.join(", ") || "—"}

Write ONE concise paragraph (2-3 sentences, STRICTLY under ${MAX_AUDIENCE_CHARS} characters) describing this creator's ideal LinkedIn target audience: who they are (roles, seniority, industry/context) and the main challenge or goal that audience has which the creator's content can help with.

Rules:
- Output ONLY the audience description text — no preamble, no quotes, no labels, no markdown, no bullet points, no line breaks.
- Be specific and concrete: name real roles/titles and a genuine pain point or aspiration.
- Keep it under ${MAX_AUDIENCE_CHARS} characters.`;

  try {
    const raw = await generateText(prompt);
    const text = raw
      .replace(/\s+/g, " ")
      .replace(/^["'`]+|["'`]+$/g, "")
      .trim()
      .slice(0, MAX_AUDIENCE_CHARS);

    if (!text) {
      return NextResponse.json({ error: friendlyGenError("") }, { status: 502 });
    }
    return NextResponse.json({ targetAudience: text });
  } catch (err) {
    const message = (err as Error).message;
    console.error("[Onboarding] audience generation failed:", message);
    return NextResponse.json({ error: friendlyGenError(message) }, { status: 502 });
  }
}
