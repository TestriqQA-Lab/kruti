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
      trialActive: false,
      hasAccess: false,
      // Trial never started yet — user CAN activate it (one-time).
      canActivateTrial: true,
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

  const trialActive =
    sub.status === "trialing" &&
    !!sub.trialEnd &&
    sub.trialEnd.getTime() > now.getTime();

  const paidActive =
    (sub.status === "active" || sub.status === "cancel_pending") &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now.getTime());

  const hasAccess = trialActive || paidActive;

  // Trial is a one-time grant. Once trialEnd is set (active OR expired),
  // it can never be activated again — user must pay.
  const canActivateTrial = sub.trialEnd === null;

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
    canActivateTrial,
  });
}