import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      positioning,
      contentGoals,
      contentStyles,
      targetAudience,
      headline,
      summary,
      industry,
      timezone,
    } = body;

    // Use "field" in body pattern to safely map data, similar to profile route
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      onboardingCompleted: true,
    };

    if (positioning !== undefined) updateData.positioning = positioning || null;
    if (contentGoals !== undefined) updateData.contentGoals = contentGoals && contentGoals.length > 0 ? JSON.stringify(contentGoals) : null;
    if (contentStyles !== undefined) updateData.contentStyles = contentStyles && contentStyles.length > 0 ? JSON.stringify(contentStyles) : null;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience || null;
    if (headline !== undefined) updateData.headline = headline || null;
    if (summary !== undefined) updateData.summary = summary || null;
    if (industry !== undefined) updateData.industry = industry || null;
    
    if (timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        updateData.timezone = timezone;
      } catch {
        updateData.timezone = "Asia/Kolkata";
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error("Onboarding API Error:", error);
    
    // Handle Prisma "Record to update not found" specifically
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: "User not found in database. Please log out and sign in again." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
