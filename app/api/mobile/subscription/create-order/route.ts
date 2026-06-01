/**
 * POST /api/mobile/subscription/create-order
 *
 * Mobile equivalent of /api/subscription/create-order. Creates a
 * Razorpay subscription for the current user and returns the
 * subscription id + Razorpay public key so the react-native-razorpay
 * SDK can open the checkout sheet.
 *
 * Auth: Bearer JWT (mobile), not next-auth cookies.
 *
 * Place at: app/api/mobile/subscription/create-order/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

// Same DEV_MODE check as the web route — bypass payment when keys are
// placeholders so the mobile flow can be tested end-to-end without real
// money. In your case keys are real, so this branch will NOT run.
const DEV_MODE =
  !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === "rzp_test_REPLACE_ME";

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional currency in body, default INR.
  let currency: "INR" | "USD" = "INR";
  try {
    const body = await req.json();
    if (body?.currency === "USD") currency = "USD";
  } catch {
    /* no body — default INR */
  }

  // ── DEV BYPASS (only when keys are placeholders) ──
  if (DEV_MODE) {
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        status: "active",
        trialEnd: null,
        currentPeriodEnd,
        currency,
      },
      create: {
        userId,
        status: "active",
        currentPeriodEnd,
        currency,
      },
    });

    console.log(`[mobile/create-order DEV] activated for user ${userId}`);
    return NextResponse.json({
      dev: true,
      success: true,
    });
  }

  try {
    const { razorpay, getPlanId } = await import("@/lib/razorpay");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create or reuse Razorpay Customer.
    let customerId = user.subscription?.razorpayCustomerId;
    if (!customerId) {
      // The Razorpay customer might already exist (e.g. from an earlier
      // failed attempt or because the DB Subscription was wiped while the
      // Razorpay customer wasn't). Without this guard, customers.create()
      // throws "Customer already exists for the merchant" and the whole
      // checkout fails — that's the bug we just hit on Priya's account.
      //
      // Two-step fix:
      //   1. Pass fail_existing: 0 so Razorpay RETURNS the existing
      //      customer instead of erroring (newer SDK behavior).
      //   2. If the SDK still errors, fall back to looking up by email
      //      via customers.all() — works on older SDKs too.
      let customer: any = null;
      try {
        customer = await razorpay.customers.create({
          name: user.name ?? "User",
          email: user.email ?? undefined,
          fail_existing: 0,
          notes: { userId, source: "mobile" },
        } as Parameters<typeof razorpay.customers.create>[0]);
      } catch (createErr: any) {
        const desc =
          createErr?.error?.description || createErr?.message || "";
        const isDuplicate = /already exists/i.test(desc);
        if (!isDuplicate || !user.email) throw createErr;

        // Look it up by email.
        console.warn(
          "[mobile/create-order] customer exists, fetching by email:",
          user.email,
        );
        const list: any = await razorpay.customers.all({
          email: user.email,
          count: 1,
        } as any);
        if (list?.items?.length) {
          customer = list.items[0];
        } else {
          throw createErr;
        }
      }
      customerId = customer.id;

      if (user.subscription) {
        await prisma.subscription.update({
          where: { userId },
          data: { razorpayCustomerId: customerId, currency },
        });
      } else {
        // No subscription row yet — user is paying directly without
        // having activated a trial first. Create the row with status
        // "none" (NOT "trialing") so we don't grant a free trial they
        // didn't choose. verify-route will flip status to "active" once
        // the Razorpay payment is confirmed.
        await prisma.subscription.create({
          data: {
            userId,
            razorpayCustomerId: customerId,
            status: "none",
            currency,
          },
        });
      }
    }

    // Create the Razorpay Subscription.
    const planId = getPlanId(currency);
    console.log(
      `[mobile/create-order] planId=${planId} customerId=${customerId} currency=${currency}`,
    );

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_id: customerId,
      total_count: 120, // up to 10 years of monthly billing
      notes: { userId, currency, source: "mobile" },
    } as Parameters<typeof razorpay.subscriptions.create>[0]);

    // Persist the subscription + plan id.
    await prisma.subscription.update({
      where: { userId },
      data: {
        razorpaySubscriptionId: subscription.id,
        razorpayPlanId: planId,
        currency,
      },
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      // Echo back basics the mobile SDK needs for the checkout sheet.
      name: user.name ?? "User",
      email: user.email ?? "",
      currency,
    });
  } catch (err: any) {
    console.error(
      "[mobile/create-order] Razorpay error:",
      err?.message ?? err,
      JSON.stringify(err?.error ?? {}),
    );
    return NextResponse.json(
      {
        error: err?.message ?? "Payment checkout failed",
        details: err?.error?.description ?? null,
      },
      { status: 500 },
    );
  }
}