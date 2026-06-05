import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toStr(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

// GET /api/company/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const company = await prisma.companyProfile.findFirst({
    where: { id: params.id, userId: session.user.id, user: { companyProfilesEnabled: true } },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ company });
}

// PATCH /api/company/[id] — update profile + content preferences
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.companyProfile.findFirst({
    where: { id: params.id, userId: session.user.id, user: { companyProfilesEnabled: true } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  // Plain string / JSON fields (use "key in body" so explicit nulls clear values)
  const stringKeys = [
    "tagline",
    "about",
    "industry",
    "website",
    "logoUrl",
    "tonePrefs",
    "positioning",
    "contentGoals",
    "contentStyles",
    "targetAudience",
    "postingSchedule",
    "postSignature",
  ] as const;
  for (const k of stringKeys) {
    if (k in body) data[k] = toStr(body[k]);
  }

  if ("name" in body && typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if ("humanMode" in body && typeof body.humanMode === "boolean") {
    data.humanMode = body.humanMode;
  }
  if ("onboardingCompleted" in body && typeof body.onboardingCompleted === "boolean") {
    data.onboardingCompleted = body.onboardingCompleted;
  }
  if ("timezone" in body && typeof body.timezone === "string") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
      data.timezone = body.timezone;
    } catch {
      // ignore invalid timezone
    }
  }

  const company = await prisma.companyProfile.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ company });
}

// DELETE /api/company/[id] — removes the company and ALL its content (cascade)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.companyProfile.findFirst({
    where: { id: params.id, userId: session.user.id, user: { companyProfilesEnabled: true } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.companyProfile.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
