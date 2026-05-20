/**
 * Mobile Onboarding Endpoint (v2 — matches web exactly)
 * POST /api/mobile/onboarding
 *
 * Accepts same 8 fields as web's /api/onboarding:
 *   headline, industry, summary, positioning, contentGoals,
 *   contentStyles, targetAudience, timezone
 */

import { NextRequest, NextResponse } from "next/server";
import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const decoded = await decode({ token, secret });
    if (!decoded?.uid) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const body = await req.json();
    const {
      headline,
      industry,
      summary,
      positioning,
      contentGoals,
      contentStyles,
      targetAudience,
      timezone,
    } = body;

    const updated = await prisma.user.update({
      where: { id: decoded.uid as string },
      data: {
        headline: headline || undefined,
        industry: industry || undefined,
        summary: summary || undefined,
        positioning: positioning || null,
        contentGoals: contentGoals ? JSON.stringify(contentGoals) : null,
        contentStyles: contentStyles ? JSON.stringify(contentStyles) : null,
        targetAudience: targetAudience || null,
        timezone: timezone || undefined,
        onboardingCompleted: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: { id: updated.id, email: updated.email, onboardingCompleted: true },
    });
  } catch (err: any) {
    console.error("[mobile/onboarding] error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
