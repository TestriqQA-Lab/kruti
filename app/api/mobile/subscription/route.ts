/**
 * GET /api/mobile/subscription
 *
 * Returns the current user's subscription status, mirroring the web
 * /api/subscription route but authenticating via Bearer JWT (mobile)
 * instead of next-auth cookies.
 *
 * Also returns the Razorpay public key so the mobile app can hand it
 * straight to the react-native-razorpay SDK without a second round trip.
 *
 * Place at: app/api/mobile/subscription/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null;

  if (!sub) {
    return NextResponse.json({
      status: "none",
      daysRemaining: 0,
      trialEnd: null,
      currentPeriodEnd: null,
      currency: "INR",
      razorpayKeyId: keyId,
      // Convenience flags for the mobile gate.
      trialActive: false,
      hasAccess: false,
    });
  }

  const now = new Date();

  // Trial day count (web parity).
  let daysRemaining = 0;
  if (sub.status === "trialing" && sub.trialEnd) {
    daysRemaining = Math.max(
      0,
      Math.ceil((sub.trialEnd.getTime() - now.getTime()) / 86400000),
    );
  }

  // Has the trial actually run out? (web doesn't expose this directly,
  // but mobile needs a clear yes/no for the access gate.)
  const trialActive =
    sub.status === "trialing" &&
    !!sub.trialEnd &&
    sub.trialEnd.getTime() > now.getTime();

  // Active paid subscription? "cancel_pending" still has access until
  // currentPeriodEnd, matching the web cancel flow.
  const paidActive =
    (sub.status === "active" || sub.status === "cancel_pending") &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now.getTime());

  const hasAccess = trialActive || paidActive;

  return NextResponse.json({
    status: sub.status,
    trialEnd: sub.trialEnd?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    daysRemaining,
    razorpayCustomerId: sub.razorpayCustomerId ?? null,
    razorpaySubscriptionId: sub.razorpaySubscriptionId ?? null,
    currency: sub.currency ?? "INR",
    razorpayKeyId: keyId,
    trialActive,
    hasAccess,
  });
}