import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Check trial countdown for banner
  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, trialEnd: true },
  });

  const now = new Date();
  const daysLeft = sub?.trialEnd
    ? Math.ceil((sub.trialEnd.getTime() - now.getTime()) / 86400000)
    : null;
  const showTrialBanner =
    sub?.status === "trialing" && daysLeft !== null && daysLeft <= 3 && daysLeft > 0;
  const isTrialExpired =
    sub?.status === "trialing" && daysLeft !== null && daysLeft <= 0;

  return (
    <div className="flex h-screen bg-[#F6F8FB] text-slate-900 antialiased dark:bg-[#0A0E14] dark:text-slate-100">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-y-auto flex flex-col">
        {isTrialExpired && (
          <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <p className="text-sm text-red-800 dark:text-red-300">
              <strong>Your free trial has ended.</strong>{" "}
              Subscribe to continue creating and scheduling content.
            </p>
            <Link
              href="/subscribe"
              className="text-sm font-semibold bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors ml-4 flex-shrink-0"
            >
              Subscribe Now
            </Link>
          </div>
        )}
        {showTrialBanner && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Your free trial ends in{" "}
              <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>.
              Don&apos;t lose your content!
            </p>
            <Link
              href="/subscribe"
              className="text-sm font-semibold text-amber-900 dark:text-amber-200 underline hover:text-amber-700 dark:hover:text-amber-100 ml-4 flex-shrink-0"
            >
              Subscribe now
            </Link>
          </div>
        )}
        <div className="flex-1 max-w-6xl mx-auto w-full p-6">{children}</div>
        <footer className="flex-shrink-0 border-t border-slate-200 dark:border-white/10 px-6 py-3">
          <nav className="flex justify-center gap-4">
            <Link href="/privacy" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms</Link>
            <Link href="/refund" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Refunds</Link>
            <Link href="/cookies" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Cookies</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
