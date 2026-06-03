import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";
import { getMobileUserId } from "@/lib/mobileAuth";

/**
 * GET /api/mobile/subscription/invoices
 *
 * Mobile (Bearer-token) version of the web invoices route. Returns the
 * payment history for the user's Razorpay subscription. Returns an empty
 * array when there is no subscription or Razorpay keys aren't configured.
 *
 * Place at: app/api/mobile/subscription/invoices/route.ts
 */
const DEV_MODE =
  !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === "rzp_test_REPLACE_ME";

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { razorpaySubscriptionId: true },
  });

  if (!sub?.razorpaySubscriptionId) {
    return NextResponse.json({ invoices: [] });
  }

  if (DEV_MODE) {
    console.log(
      "[mobile Invoices] Razorpay keys not configured — returning empty array",
    );
    return NextResponse.json({ invoices: [] });
  }

  try {
    // Fetch payments for this subscription from Razorpay.
    const payments = await (razorpay.payments as any).all({
      subscription_id: sub.razorpaySubscriptionId,
      count: 50,
    });

    const formatted = (payments.items || []).map((p: any) => ({
      id: p.id,
      date: p.created_at ? new Date(p.created_at * 1000).toISOString() : null,
      amount: p.amount ? p.amount / 100 : 0,
      currency: p.currency || "INR",
      status: p.status,
      method: p.method,
      invoiceId: p.invoice_id,
    }));

    return NextResponse.json({ invoices: formatted });
  } catch (err: any) {
    console.error("[mobile Invoices] Razorpay API error:", err?.message);
    return NextResponse.json({ invoices: [] });
  }
}