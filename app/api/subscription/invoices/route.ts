import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";

const DEV_MODE =
  !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === "rzp_test_REPLACE_ME";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { razorpaySubscriptionId: true },
  });

  if (!sub?.razorpaySubscriptionId) {
    return NextResponse.json({ invoices: [] });
  }

  if (DEV_MODE) {
    console.log("[Invoices] Razorpay keys not configured - returning empty array");
    return NextResponse.json({ invoices: [] });
  }

  try {
    // Fetch payments for this subscription from Razorpay
    const payments = await (razorpay.payments as any).all({
      "subscription_id": sub.razorpaySubscriptionId,
      count: 50,
    });

    const formatted = (payments.items || []).map((p: any) => ({
      id: p.id,
      date: p.created_at
        ? new Date(p.created_at * 1000).toISOString()
        : null,
      amount: p.amount ? p.amount / 100 : 0,
      currency: p.currency || "INR",
      status: p.status,
      method: p.method,
      invoiceId: p.invoice_id,
    }));

    return NextResponse.json({ invoices: formatted });
  } catch (err: any) {
    console.error("[Invoices] Razorpay API error:", err?.message);
    return NextResponse.json({ invoices: [] });
  }
}
