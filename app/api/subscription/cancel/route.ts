import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Cancel a Razorpay subscription (at end of current billing cycle).
 * Cancels at the end of the current billing cycle.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
  });

  if (!sub?.razorpaySubscriptionId) {
    return NextResponse.json(
      { error: "No active Razorpay subscription found" },
      { status: 400 }
    );
  }

  // If Razorpay keys are configured, cancel via API
  const hasKeys =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID !== "rzp_test_REPLACE_ME";

  if (hasKeys) {
    try {
      const { razorpay } = await import("@/lib/razorpay");
      // Second argument = cancel_at_cycle_end (true = cancel at end of billing cycle)
      await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, true);
    } catch (err) {
      console.error("Razorpay cancel error:", err);
      return NextResponse.json(
        { error: "Failed to cancel subscription with Razorpay" },
        { status: 500 }
      );
    }
  }

  // Mark as cancel_pending - actual cancellation happens via Razorpay webhook
  // when the current billing cycle ends. User retains access until then.
  await prisma.subscription.update({
    where: { userId: session.user.id },
    data: { status: "cancel_pending" },
  });

  console.log(`Subscription cancel requested for user ${session.user.id}`);
  return NextResponse.json({ success: true });
}
