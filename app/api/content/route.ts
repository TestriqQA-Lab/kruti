import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/company";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyProfileId = await getActiveWorkspaceId(session.user.id);
  const { searchParams } = new URL(req.url);
  const weekStart = searchParams.get("weekStart"); // ISO date string, e.g. "2026-03-09"
  const status = searchParams.get("status");

  const plans = await prisma.contentPlan.findMany({
    where: {
      userId: session.user.id,
      companyProfileId,
      ...(weekStart && {
        weekStart: {
          gte: new Date(weekStart),
          lt: new Date(new Date(weekStart).getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    },
    include: {
      posts: {
        where: status ? { status } : undefined,
        orderBy: { scheduledAt: "asc" },
      },
    },
    orderBy: { weekStart: "desc" },
  });

  return NextResponse.json(plans);
}
