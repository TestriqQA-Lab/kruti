/**
 * POST /api/mobile/subscription/verify
 *
 * Mobile equivalent of /api/subscription/verify. The react-native-razorpay
 * SDK returns razorpay_payment_id / razorpay_subscription_id /
 * razorpay_signature on success — the app sends them here, we verify the
 * signature with the existing helper, and flip the user's subscription
 * to "active".
 *
 * Auth: Bearer JWT (mobile).
 *
 * Place at: app/api/mobile/subscription/verify/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { verifyPaymentSignature } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
  } = await req.json();

  if (
    !razorpay_subscription_id ||
    !razorpay_payment_id ||
    !razorpay_signature
  ) {
    return NextResponse.json(
      { error: "Missing payment verification fields" },
      { status: 400 },
    );
  }

  // Use the same signature verifier the web route uses, so a single
  // crypto implementation handles both flows.
  const isValid = verifyPaymentSignature({
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    console.error(
      "[mobile/verify] signature mismatch for user",
      userId,
      "sub",
      razorpay_subscription_id,
    );
    return NextResponse.json(
      { error: "Invalid payment signature" },
      { status: 400 },
    );
  }

  // Activate. One billing cycle = +1 month, matching the web route.
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  await prisma.subscription.update({
    where: { userId },
    data: {
      razorpaySubscriptionId: razorpay_subscription_id,
      status: "active",
      trialEnd: null,
      currentPeriodEnd,
    },
  });

  console.log(`[mobile/verify] activated subscription for user ${userId}`);
  return NextResponse.json({ success: true });
}