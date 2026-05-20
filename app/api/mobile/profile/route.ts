/**
 * Mobile Profile API — Bearer JWT auth (self-contained)
 *
 * GET  /api/mobile/profile  → return full profile + subscription
 * PATCH /api/mobile/profile → update profile fields
 *
 * Path in web app:
 *   app/api/mobile/profile/route.ts
 *
 * Auth pattern matches mobile-callback's encode():
 *   - mobile-callback ENCODES JWT with next-auth/jwt and ships it to mobile
 *   - this route DECODES that same JWT from Authorization: Bearer header
 *   - No external @/lib/mobile-auth helper needed (self-contained)
 *
 * Push to mobile-auth-integration branch → Vercel auto-deploys.
 */

import { NextRequest, NextResponse } from "next/server";
import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────
//  JWT Auth Helper (inline — self-contained)
// ─────────────────────────────────────────────
async function getMobileUserId(req: NextRequest): Promise<string | null> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[mobile-profile] NEXTAUTH_SECRET not set");
      return null;
    }

    const payload = await decode({ token, secret });
    if (!payload?.sub) return null;
    return payload.sub as string;
  } catch (err) {
    console.warn("[mobile-profile] JWT decode failed:", err);
    return null;
  }
}

// ─────────────────────────────────────────────
//  GET /api/mobile/profile
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      headline: true,
      summary: true,
      skills: true,
      industry: true,
      tonePrefs: true,
      positioning: true,
      contentGoals: true,
      contentStyles: true,
      targetAudience: true,
      humanMode: true,
      postingSchedule: true,
      postSignature: true,
      timezone: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          trialEnd: true,
          currentPeriodEnd: true,
          currency: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json(user);
}

// ─────────────────────────────────────────────
//  PATCH /api/mobile/profile
// ─────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Build update object — only set keys that are present in body.
  // Mirrors web /api/profile exactly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  if ("headline" in body) updateData.headline = body.headline ?? null;
  if ("summary" in body) updateData.summary = body.summary ?? null;
  if ("industry" in body) updateData.industry = body.industry ?? null;
  if ("skills" in body) {
    updateData.skills = body.skills ? JSON.stringify(body.skills) : null;
  }
  if ("tonePrefs" in body) {
    updateData.tonePrefs = body.tonePrefs ? JSON.stringify(body.tonePrefs) : null;
  }
  if ("positioning" in body) updateData.positioning = body.positioning ?? null;
  if ("contentGoals" in body) {
    updateData.contentGoals = body.contentGoals
      ? JSON.stringify(body.contentGoals)
      : null;
  }
  if ("contentStyles" in body) {
    updateData.contentStyles = body.contentStyles
      ? JSON.stringify(body.contentStyles)
      : null;
  }
  if ("targetAudience" in body) {
    updateData.targetAudience = body.targetAudience ?? null;
  }
  if ("humanMode" in body) updateData.humanMode = Boolean(body.humanMode);
  if ("postingSchedule" in body) {
    updateData.postingSchedule = body.postingSchedule
      ? JSON.stringify(body.postingSchedule)
      : null;
  }
  if ("postSignature" in body) {
    updateData.postSignature = body.postSignature ?? null;
  }
  if ("timezone" in body) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
      updateData.timezone = body.timezone;
    } catch {
      updateData.timezone = "Asia/Kolkata";
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        headline: true,
        summary: true,
        industry: true,
        skills: true,
        tonePrefs: true,
        positioning: true,
        contentGoals: true,
        contentStyles: true,
        targetAudience: true,
        humanMode: true,
        postingSchedule: true,
        postSignature: true,
        timezone: true,
      },
    });
    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    console.error("[/api/mobile/profile PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}