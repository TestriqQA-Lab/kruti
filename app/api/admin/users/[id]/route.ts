import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      subscription: true,
      _count: { select: { contentPlans: true, newsletters: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  if ("role" in body) {
    if (params.id === session!.user.id && body.role !== "admin") {
      return NextResponse.json({ error: "Cannot remove your own admin role" }, { status: 400 });
    }
    updateData.role = body.role;
  }

  if ("companyProfilesEnabled" in body && typeof body.companyProfilesEnabled === "boolean") {
    updateData.companyProfilesEnabled = body.companyProfilesEnabled;
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, session } = await requireAdmin();
  if (error) return error;

  if (params.id === session!.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "data";

  if (mode === "full") {
    await prisma.user.delete({ where: { id: params.id } });
  } else {
    // Delete content only, keep account and subscription
    await prisma.$transaction([
      prisma.post.deleteMany({ where: { plan: { userId: params.id } } }),
      prisma.contentPlan.deleteMany({ where: { userId: params.id } }),
      prisma.newsletter.deleteMany({ where: { userId: params.id } }),
    ]);
  }

  return NextResponse.json({ success: true, mode });
}
