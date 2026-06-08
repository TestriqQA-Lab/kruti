"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  CheckCircle,
  Zap,
  Calendar,
  Image,
  BarChart2,
  Clock,
  Rocket,
  RefreshCw,
  TrendingUp,
  Settings2,
  Palette,
  Mic,
  LayoutTemplate,
  BookOpen,
  Crown,
  Star,
  Loader2,
  Shield,
  Gift,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface SubscriptionGateProps {
  daysLeft: number;
  trialExpired: boolean;
}

type Currency = "INR" | "USD";

const PRICE: Record<Currency, { symbol: string; amount: number }> = {
  INR: { symbol: "\u20B9", amount: 999 },
  USD: { symbol: "$", amount: 19 },
};

const PLANS = [
  {
    id: "free-trial",
    name: "7-Day Free Trial",
    description: "Experience the full power of Content Pro",
    active: false,
    comingSoon: false,
    highlight: false,
    badge: "Free",
    icon: Gift,
    features: [
      { icon: Zap, text: "Test all Content Pro features" },
      { icon: Calendar, text: "Auto-scheduling & posting" },
      { icon: Image, text: "AI image generation" },
      { icon: BarChart2, text: "Personalized strategy" },
      { icon: Shield, text: "No credit card required" },
    ],
    cta: "Included",
  },
  {
    id: "content-pro",
    name: "Content Pro",
    description: "Everything you need to create great LinkedIn content",
    active: true,
    comingSoon: false,
    highlight: true,
    badge: "Most Popular",
    icon: Star,
    features: [
      { icon: Zap, text: "5 AI-generated posts per week" },
      { icon: Calendar, text: "Auto-scheduling & LinkedIn auto-posting" },
      { icon: Image, text: "AI image generation for every post" },
      { icon: BarChart2, text: "Personalized content strategy" },
      { icon: Clock, text: "Human Mode \u2014 sounds like you" },
    ],
    cta: "Subscribe Now",
  },
];

const PLAN_MULTIPLIER: Record<string, number> = {
  "free-trial": 0,
  "content-pro": 1,
  "everything-automatic": 2,
  "brand-identity": 3,
};

export default function SubscriptionGate({ daysLeft, trialExpired }: SubscriptionGateProps) {
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState<Currency>("INR");
  const { data: session, update } = useSession();
  const { toast } = useToast();

  // Load the Razorpay checkout script
  useEffect(() => {
    if (document.querySelector("script[src='https://checkout.razorpay.com/v1/checkout.js']")) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  function getPlanPrice(planId: string): number {
    const base = PRICE[currency].amount;
    const multiplier = PLAN_MULTIPLIER[planId] ?? 1;
    return base * multiplier;
  }

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency }),
      });
      const data = await res.json();

      // DEV bypass — no Razorpay keys, auto-activated
      if (data.dev && data.redirectUrl) {
        await update();
        window.location.href = data.redirectUrl;
        return;
      }

      // Surface any server-side error (e.g. Razorpay misconfiguration / auth failure)
      // so the user sees why nothing opened instead of a silent dead button.
      if (!res.ok || data.error) {
        console.error("Checkout failed:", data.error ?? res.status, data.details ?? "");
        toast(
          data.error
            ? `Couldn't start payment: ${data.error}`
            : "Couldn't start payment right now. Please try again in a moment.",
          "error"
        );
        setLoading(false);
        return;
      }

      if (!data.subscriptionId || !data.keyId) {
        console.error("Missing subscriptionId or keyId from API");
        toast("Couldn't start payment right now. Please try again in a moment.", "error");
        setLoading(false);
        return;
      }

      // Make sure the Razorpay checkout script has actually loaded before we open it,
      // otherwise `new window.Razorpay()` throws and the modal never appears.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window === "undefined" || !(window as any).Razorpay) {
        toast("Payment system is still loading. Please try again in a moment.", "error");
        setLoading(false);
        return;
      }

      // Open Razorpay Checkout modal
      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "LinkedIn Content Platform",
        description: `Content Pro \u2014 ${PRICE[currency].symbol}${PRICE[currency].amount}/month`,
        handler: async (response: {
          razorpay_subscription_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Verify payment on server
          try {
            const verifyRes = await fetch("/api/subscription/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              await update();
              window.location.href = "/dashboard?subscribed=true";
            } else {
              console.error("Payment verification failed:", verifyData.error);
              toast(
                "Payment verification failed. If you were charged, please contact support.",
                "error"
              );
              setLoading(false);
            }
          } catch (err) {
            console.error("Verify error:", err);
            toast(
              "Payment verification failed. If you were charged, please contact support.",
              "error"
            );
            setLoading(false);
          }
        },
        prefill: {
          name: session?.user?.name ?? "",
          email: session?.user?.email ?? "",
        },
        theme: {
          color: "#0A66C2",
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Checkout error:", err);
      toast("Something went wrong while starting payment. Please try again.", "error");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0A0E14] flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white px-4 py-2 rounded-lg backdrop-blur-sm border border-slate-200 dark:border-white/10 transition-colors shadow-sm"
        >
          Logout
        </button>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto mx-auto mb-4" />
        {trialExpired ? (
          <>
            <h1 className="text-3xl font-bold font-display text-slate-900 dark:text-white">Your trial has ended</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Choose a plan to continue creating LinkedIn content</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold font-display text-slate-900 dark:text-white">
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} left in your trial
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Subscribe now to keep your momentum going</p>
          </>
        )}
      </div>

      {/* Currency Toggle */}
      <div className="flex items-center gap-2 mb-6 bg-white/80 dark:bg-white/[0.03] backdrop-blur rounded-xl border border-slate-200 dark:border-white/10 p-1">
        <button
          onClick={() => setCurrency("INR")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
            currency === "INR"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          {"\u20B9"} INR
        </button>
        <button
          onClick={() => setCurrency("USD")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
            currency === "USD"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          $ USD
        </button>
      </div>



      {/* Pricing Grid */}
      <div className="flex flex-col md:flex-row justify-center items-stretch gap-8 w-full max-w-5xl">
        {PLANS.map((plan) => {
          const PlanIcon = plan.icon;
          const price = getPlanPrice(plan.id);
          return (
            <div
              key={plan.id}
              className={cn(
                "relative bg-white dark:bg-white/[0.03] rounded-2xl shadow-lg overflow-hidden flex flex-col w-full md:w-[420px]",
                plan.highlight
                  ? "ring-2 ring-blue-600 shadow-xl md:scale-105 z-10"
                  : "ring-1 ring-slate-200 dark:ring-white/10",
                plan.comingSoon && "opacity-90"
              )}
            >
              {/* Badge */}
              {plan.badge && (
                <div
                  className={cn(
                    "absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full",
                    plan.highlight
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400"
                  )}
                >
                  {plan.badge}
                </div>
              )}

              {/* Plan Header */}
              <div className="px-6 pt-6 pb-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                    plan.highlight ? "bg-blue-500/10" : "bg-slate-100 dark:bg-white/[0.06]"
                  )}
                >
                  <PlanIcon
                    className={cn(
                      "w-5 h-5",
                      plan.highlight ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                    )}
                  />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="px-6 pb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900 dark:text-white">
                    {price === 0 ? "Free" : `${PRICE[currency].symbol}${price}`}
                  </span>
                  {price > 0 && <span className="text-slate-500 dark:text-slate-400">/month</span>}
                </div>
              </div>

              {/* Features */}
              <div className="px-6 pb-6 flex-1">
                <div className="space-y-3">
                  {plan.features.map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                          plan.highlight ? "bg-blue-50 dark:bg-blue-500/10" : "bg-slate-50 dark:bg-white/[0.06]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-4 h-4",
                            plan.highlight ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                          )}
                        />
                      </div>
                      <p
                        className={cn(
                          "text-sm",
                          plan.comingSoon ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="px-6 pb-6 mt-auto">
                {plan.id === "free-trial" ? (
                  trialExpired ? (
                    <button
                      disabled
                      className="w-full py-3 bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 font-semibold rounded-xl cursor-not-allowed border border-slate-200 dark:border-white/10"
                    >
                      Trial Ended
                    </button>
                  ) : (
                    <a
                      href="/dashboard"
                      className="w-full py-3 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.08] flex items-center justify-center transition-colors"
                    >
                      Go to Dashboard ({daysLeft} days left)
                    </a>
                  )
                ) : plan.active ? (
                  <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      `${plan.cta} \u2014 ${PRICE[currency].symbol}${price}/mo`
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-3 bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 font-semibold rounded-xl cursor-not-allowed border border-slate-200 dark:border-white/10"
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Guarantee */}
      <div className="w-full max-w-md mt-8 flex items-center gap-3 bg-white/60 dark:bg-white/[0.03] backdrop-blur border border-slate-200 dark:border-white/10 rounded-xl px-5 py-4">
        <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Cancel anytime, no questions asked</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            You keep full access until the end of your billing cycle. No lock-in, no hidden fees.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-6 space-y-2">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Secure payment via Razorpay. Cancel anytime from your account settings.
        </p>
        <nav className="flex justify-center gap-3">
          <a href="/privacy" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">Privacy</a>
          <a href="/terms" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">Terms</a>
          <a href="/refund" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">Refunds</a>
        </nav>
      </div>
    </div>
  );
}
