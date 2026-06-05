import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/company";

// POST /api/company/active — set the active workspace for this user.
// Body: { workspace: "personal" | "<companyProfileId>" }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const workspace = typeof body.workspace === "string" ? body.workspace : "personal";

  let value = "personal";
  if (workspace !== "personal") {
    // verify the company belongs to this user before activating it
    const owned = await prisma.companyProfile.findFirst({
      where: { id: workspace, userId: session.user.id, user: { companyProfilesEnabled: true } },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    value = owned.id;
  }

  const res = NextResponse.json({ success: true, workspace: value });
  res.cookies.set(ACTIVE_WORKSPACE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return res;
}
