import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_COMPANIES = 20;

/** Coerce a value to a DB-storable string (JSON-stringify objects/arrays). */
function toStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function validTimezone(tz: unknown): string {
  if (typeof tz === "string") {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    } catch {
      /* fall through */
    }
  }
  return "Asia/Kolkata";
}

// GET /api/company — list the current user's company profiles
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const companies = await prisma.companyProfile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ companies });
}

// POST /api/company — create a new company profile
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const count = await prisma.companyProfile.count({ where: { userId: session.user.id } });
  if (count >= MAX_COMPANIES) {
    return NextResponse.json(
      { error: `You can create up to ${MAX_COMPANIES} company profiles.` },
      { status: 400 }
    );
  }

  const company = await prisma.companyProfile.create({
    data: {
      userId: session.user.id,
      name,
      tagline: toStr(body.tagline),
      about: toStr(body.about),
      industry: toStr(body.industry),
      website: toStr(body.website),
      logoUrl: toStr(body.logoUrl),
      tonePrefs: toStr(body.tonePrefs),
      positioning: toStr(body.positioning),
      contentGoals: toStr(body.contentGoals),
      contentStyles: toStr(body.contentStyles),
      targetAudience: toStr(body.targetAudience),
      humanMode: typeof body.humanMode === "boolean" ? body.humanMode : false,
      postingSchedule: toStr(body.postingSchedule),
      postSignature: toStr(body.postSignature),
      timezone: validTimezone(body.timezone),
      onboardingCompleted:
        typeof body.onboardingCompleted === "boolean" ? body.onboardingCompleted : false,
    },
  });

  return NextResponse.json({ company });
}
