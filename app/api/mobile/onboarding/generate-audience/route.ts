/**
 * POST /api/mobile/onboarding/generate-audience
 *
 * Analyses the user's onboarding profile (headline, industry, summary,
 * positioning, content goals + styles) and uses Gemini to write a concise
 * target-audience description. Used by the onboarding wizard's "Generate"
 * button on the Target Audience step.
 *
 * Body: { headline, industry, summary, positioning, contentGoals[], contentStyles[] }
 * Returns: { targetAudience }
 *
 * Place at: app/api/mobile/onboarding/generate-audience/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gemini";
import { getMobileUserId } from "@/lib/mobileAuth";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const headline = String(body?.headline || "").trim();
  const industry = String(body?.industry || "").trim();
  const summary = String(body?.summary || "").trim();
  const positioning = String(body?.positioning || "").trim();
  const goals = Array.isArray(body?.contentGoals)
    ? body.contentGoals.join(", ")
    : "";
  const styles = Array.isArray(body?.contentStyles)
    ? body.contentStyles.join(", ")
    : "";

  const prompt = `You are a LinkedIn content strategist. Based on this professional's profile, write a concise, specific description of their IDEAL target audience for LinkedIn content.

Professional headline: ${headline || "Not specified"}
Industry: ${industry || "Not specified"}
Summary: ${summary || "Not specified"}
Content positioning: ${positioning || "Not specified"}
Content goals: ${goals || "Not specified"}
Preferred content styles: ${styles || "Not specified"}

Write 1-2 sentences (max 280 characters) describing WHO they should target: the roles/titles, industry & seniority, and the key pains or goals that audience has. Be specific and concrete. Return ONLY the audience description text — no preamble, no quotes, no markdown.`;

  try {
    const raw = await generateText(prompt);
    const targetAudience = raw
      .trim()
      .replace(/^["'`]+|["'`]+$/g, "")
      .slice(0, 300);
    if (!targetAudience) {
      return NextResponse.json(
        { error: "Couldn't generate the audience. Please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json({ targetAudience });
  } catch (err) {
    console.error("[generate-audience] error:", err);
    const m = String((err as { message?: string })?.message || "").toLowerCase();
    const quota =
      (err as { status?: number })?.status === 429 ||
      m.includes("spending cap") ||
      m.includes("quota") ||
      m.includes("exceeded");
    return NextResponse.json(
      {
        error: quota
          ? "AI is temporarily unavailable — the usage limit was reached. Please try again later."
          : "Couldn't generate the audience. Please try again.",
        code: quota ? "AI_LIMIT_REACHED" : "GENERATION_FAILED",
      },
      { status: quota ? 503 : 500 },
    );
  }
}
