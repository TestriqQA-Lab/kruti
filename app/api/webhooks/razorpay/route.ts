import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay Webhook handler.
 *
 * Configure in Razorpay Dashboard → Settings → Webhooks:
 *   URL:    https://your-domain.com/api/webhooks/razorpay
 *   Events: subscription.activated, subscription.charged,
 *           subscription.pending, subscription.halted,
 *           subscription.cancelled, subscription.completed
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "No x-razorpay-signature header" },
      { status: 400 }
    );
  }

  // Verify webhook signature
  if (!verifyWebhookSignature(body, signature)) {
    console.error("Razorpay webhook signature verification failed");
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  let payload: { event: string; created_at?: number; payload: { subscription: { entity: RazorpaySubscriptionEntity } } };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Replay protection: reject webhooks older than 5 minutes
  if (payload.created_at) {
    const ageMs = Date.now() - payload.created_at * 1000;
    if (ageMs > 5 * 60 * 1000) {
      console.warn("Razorpay webhook rejected - too old:", ageMs, "ms");
      return NextResponse.json({ error: "Webhook expired" }, { status: 400 });
    }
  }

  const event = payload.event;
  const subEntity = payload.payload?.subscription?.entity;

  if (!subEntity?.id) {
    // Not a subscription event we handle
    return NextResponse.json({ received: true });
  }

  const razorpaySubscriptionId = subEntity.id;

  try {
    switch (event) {
      case "subscription.activated":
      case "subscription.charged": {
        // Subscription is live & paid
        const currentPeriodEnd = subEntity.current_end
          ? new Date(subEntity.current_end * 1000)
          : null;

        await prisma.subscription.updateMany({
          where: { razorpaySubscriptionId },
          data: {
            status: "active",
            ...(currentPeriodEnd && { currentPeriodEnd }),
            trialEnd: null,
          },
        });
        break;
      }

      case "subscription.pending": {
        // Payment is pending (retry period)
        await prisma.subscription.updateMany({
          where: { razorpaySubscriptionId },
          data: { status: "past_due" },
        });
        break;
      }

      case "subscription.halted": {
        // All payment retries exhausted
        await prisma.subscription.updateMany({
          where: { razorpaySubscriptionId },
          data: { status: "unpaid" },
        });
        break;
      }

      case "subscription.cancelled":
      case "subscription.completed": {
        // Subscription ended
        await prisma.subscription.updateMany({
          where: { razorpaySubscriptionId },
          data: { status: "canceled" },
        });
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }
  } catch (err) {
    console.error("Error processing Razorpay webhook:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

// ── Type for Razorpay subscription entity ───────────────────────────────────
interface RazorpaySubscriptionEntity {
  id: string;
  plan_id?: string;
  customer_id?: string;
  status?: string;
  current_start?: number;
  current_end?: number;
  ended_at?: number;
  charge_at?: number;
  short_url?: string;
  has_scheduled_changes?: boolean;
  remaining_count?: number;
  paid_count?: number;
  notes?: Record<string, string>;
}
