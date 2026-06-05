import { prisma } from "@/lib/prisma";
import AdminUsersClient from "@/components/AdminUsersClient";

export default async function AdminUsersPage() {
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        onboardingCompleted: true,
        companyProfilesEnabled: true,
        createdAt: true,
        subscription: {
          select: { status: true, trialEnd: true, currentPeriodEnd: true },
        },
        _count: { select: { contentPlans: true, newsletters: true } },
      },
    }),
    prisma.user.count(),
  ]);

  return <AdminUsersClient initialUsers={users} initialTotal={total} />;
}
