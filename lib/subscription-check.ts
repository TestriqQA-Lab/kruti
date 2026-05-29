import { prisma } from "@/lib/prisma";

/**
 * Check if a user has an active subscription that allows content generation.
 * Returns allowed: false for expired trials, canceled, unpaid, or missing subscriptions.
 */
export async function checkActiveSubscription(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  // Super admins get lifetime access — bypass all subscription checks
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === "admin") {
    return { allowed: true };
  }

  let sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    try {
      sub = await prisma.subscription.create({
        data: {
          userId,
          status: "trialing",
          trialEnd,
          currency: "INR",
        },
      });
    } catch (err) {
      console.error("Failed to auto-create trial subscription in check:", err);
      return { allowed: false, reason: "No subscription found and failed to create one. Please try again or contact support." };
    }
  }

  if (sub.status === "active" || sub.status === "cancel_pending") {
    return { allowed: true };
  }

  if (sub.status === "trialing") {
    if (sub.trialEnd && sub.trialEnd < new Date()) {
      return {
        allowed: false,
        reason: "Your free trial has ended. Subscribe to continue creating content.",
      };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: "Your subscription is not active. Please subscribe to continue." };
}
