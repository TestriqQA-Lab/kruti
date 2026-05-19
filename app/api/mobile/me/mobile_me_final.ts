/**
 * Mobile /api/mobile/me endpoint
 * Moved from /api/auth/me to avoid NextAuth catch-all conflict on Vercel.
 *
 * Validates Bearer JWT (signed by NextAuth-compatible encode) and returns user info.
 */

import { NextRequest, NextResponse } from "next/server";
import { decode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const decoded = await decode({ token, secret });
    if (!decoded?.uid) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.uid as string },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      headline: (user as any).headline ?? null,
      industry: (user as any).industry ?? null,
      summary: (user as any).summary ?? null,
      positioning: (user as any).positioning ?? null,
      goals: (user as any).goals ?? null,
      styles: (user as any).styles ?? null,
      audience: (user as any).audience ?? null,
      timezone: (user as any).timezone ?? null,
      onboardingComplete: (user as any).onboardingCompleted ?? false,
      role: (user as any).role ?? "user",
      subscriptionStatus: user.subscription?.status ?? "none",
      trialEnd: user.subscription?.trialEnd?.toISOString() ?? null,
    });
  } catch (err: any) {
    console.error("[mobile/me] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}