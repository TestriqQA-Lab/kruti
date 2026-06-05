import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { getUserCompanyProfiles, getActiveWorkspaceId } from "@/lib/company";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Check trial countdown for banner
  const sub = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true, trialEnd: true },
  });

  const [companies, activeWorkspaceId] = await Promise.all([
    getUserCompanyProfiles(session.user.id),
    getActiveWorkspaceId(session.user.id),
  ]);

  const now = new Date();
  const daysLeft = sub?.trialEnd
    ? Math.ceil((sub.trialEnd.getTime() - now.getTime()) / 86400000)
    : null;
  const showTrialBanner =
    sub?.status === "trialing" && daysLeft !== null && daysLeft <= 3 && daysLeft > 0;
  const isTrialExpired =
    sub?.status === "trialing" && daysLeft !== null && daysLeft <= 0;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        user={session.user}
        companies={companies.map((c) => ({ id: c.id, name: c.name, logoUrl: c.logoUrl }))}
        activeWorkspaceId={activeWorkspaceId}
      />
      <main className="flex-1 overflow-y-auto flex flex-col">
        {isTrialExpired && (
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <p className="text-sm text-red-800 dark:text-red-300">
              <strong>Your free trial has ended.</strong>{" "}
              Subscribe to continue creating and scheduling content.
            </p>
            <Link
              href="/subscribe"
              className="text-sm font-semibold bg-[#0A66C2] text-white px-4 py-1.5 rounded-lg hover:bg-[#004182] transition-colors ml-4 flex-shrink-0"
            >
              Subscribe Now
            </Link>
          </div>
        )}
        {showTrialBanner && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
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
        <footer className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 px-6 py-3">
          <nav className="flex justify-center gap-4">
            <Link href="/privacy" className="text-xs text-gray-400 dark:text-gray-500 hover:text-[#0A66C2] dark:hover:text-blue-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-xs text-gray-400 dark:text-gray-500 hover:text-[#0A66C2] dark:hover:text-blue-400 transition-colors">Terms</Link>
            <Link href="/refund" className="text-xs text-gray-400 dark:text-gray-500 hover:text-[#0A66C2] dark:hover:text-blue-400 transition-colors">Refunds</Link>
            <Link href="/cookies" className="text-xs text-gray-400 dark:text-gray-500 hover:text-[#0A66C2] dark:hover:text-blue-400 transition-colors">Cookies</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
