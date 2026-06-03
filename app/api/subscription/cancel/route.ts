import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

/**
 * POST /api/mobile/subscription/cancel
 *
 * Mobile (Bearer-token) version of the web cancel route. Cancels the
 * Razorpay subscription at the END of the current billing cycle — the user
 * keeps full access until then. Status is set to "cancel_pending"; the final
 * "canceled" flip happens via the Razorpay webhook when the cycle ends.
 *
 * Place at: app/api/mobile/subscription/cancel/route.ts
 */
export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub?.razorpaySubscriptionId) {
    return NextResponse.json(
      { error: "No active Razorpay subscription found" },
      { status: 400 },
    );
  }

  // If Razorpay keys are configured, cancel via API.
  const hasKeys =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID !== "rzp_test_REPLACE_ME";

  if (hasKeys) {
    try {
      const { razorpay } = await import("@/lib/razorpay");
      // Second arg = cancel_at_cycle_end (true = cancel at end of billing cycle)
      await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, true);
    } catch (err) {
      console.error("Razorpay cancel error:", err);
      return NextResponse.json(
        { error: "Failed to cancel subscription with Razorpay" },
        { status: 500 },
      );
    }
  }

  // Mark as cancel_pending — actual cancellation happens via Razorpay webhook
  // when the current billing cycle ends. User retains access until then.
  await prisma.subscription.update({
    where: { userId },
    data: { status: "cancel_pending" },
  });

  console.log(`[mobile] Subscription cancel requested for user ${userId}`);
  return NextResponse.json({ success: true });
}