import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      headline: true,
      summary: true,
      skills: true,
      industry: true,
      profileUrl: true,
      tonePrefs: true,
      positioning: true,
      contentGoals: true,
      contentStyles: true,
      targetAudience: true,
      humanMode: true,
      postingSchedule: true,
      postSignature: true,
      timezone: true,
      createdAt: true,
      subscription: {
        select: { status: true, trialEnd: true, currentPeriodEnd: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Use "field" in body pattern to allow explicit null clears
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  // Preserve values as-is - only set null if explicitly null, not for empty strings
  if ("headline" in body) updateData.headline = body.headline ?? null;
  if ("summary" in body) updateData.summary = body.summary ?? null;
  if ("industry" in body) updateData.industry = body.industry ?? null;
  if ("skills" in body) updateData.skills = body.skills ? JSON.stringify(body.skills) : null;
  if ("tonePrefs" in body) updateData.tonePrefs = body.tonePrefs ? JSON.stringify(body.tonePrefs) : null;
  if ("positioning" in body) updateData.positioning = body.positioning ?? null;
  if ("contentGoals" in body) updateData.contentGoals = body.contentGoals ? JSON.stringify(body.contentGoals) : null;
  if ("contentStyles" in body) updateData.contentStyles = body.contentStyles ? JSON.stringify(body.contentStyles) : null;
  if ("targetAudience" in body) updateData.targetAudience = body.targetAudience ?? null;
  if ("humanMode" in body) updateData.humanMode = Boolean(body.humanMode);
  if ("postingSchedule" in body) updateData.postingSchedule = body.postingSchedule ? JSON.stringify(body.postingSchedule) : null;
  if ("postSignature" in body) updateData.postSignature = body.postSignature ?? null;
  if ("timezone" in body) {
    // Validate IANA timezone string
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
      updateData.timezone = body.timezone;
    } catch {
      updateData.timezone = "Asia/Kolkata";
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  return NextResponse.json(updated);
}
