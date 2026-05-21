/**
 * GET /api/mobile/newsletters
 * Lists the user's newsletters, parsed into the mobile card shape.
 *
 * Place at: app/api/mobile/newsletters/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.newsletter.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // The DB stores the full generated newsletter JSON in `body`.
  // Parse it into the structured shape the mobile screen expects.
  const newsletters = rows.map((n) => {
    let parsed: {
      title?: string;
      subject?: string;
      intro?: { hook?: string; preview?: string };
      sections?: Array<{
        heading?: string;
        content?: string;
        keyTakeaway?: string;
      }>;
      featuredInsight?: { quote?: string; context?: string };
      cta?: { heading?: string; text?: string; action?: string };
      signoff?: string;
    } = {};
    try {
      parsed = JSON.parse(n.body);
    } catch {
      /* body may be plain text */
    }

    return {
      id: n.id,
      title: parsed.title || n.title,
      subjectLine: parsed.subject || n.subject || "",
      status: n.status,
      introHook: parsed.intro?.hook || "",
      preview: parsed.intro?.preview || "",
      sections: (parsed.sections || []).map((s) => ({
        heading: s.heading,
        body: s.content,
        takeaway: s.keyTakeaway,
      })),
      featuredInsight: parsed.featuredInsight
        ? `${parsed.featuredInsight.quote || ""}${
            parsed.featuredInsight.context
              ? " — " + parsed.featuredInsight.context
              : ""
          }`
        : "",
      ctaText: parsed.cta
        ? `${parsed.cta.heading ? parsed.cta.heading + ": " : ""}${
            parsed.cta.text || parsed.cta.action || ""
          }`
        : "",
      signoff: parsed.signoff || "",
      createdAt: n.createdAt,
    };
  });

  return NextResponse.json({ newsletters });
}
