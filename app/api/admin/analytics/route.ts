import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildUsageReport, istDayKey } from "@/lib/usage-analytics";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

/** Default range: the last 30 IST days (today inclusive). */
function defaultRange(): { start: string; end: string } {
  const now = Date.now();
  return {
    start: istDayKey(now - 29 * 24 * 60 * 60 * 1000),
    end: istDayKey(now),
  };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const def = defaultRange();
  let start = searchParams.get("from") ?? def.start;
  let end = searchParams.get("to") ?? def.end;

  if (!DAY_RE.test(start)) start = def.start;
  if (!DAY_RE.test(end)) end = def.end;
  if (start > end) [start, end] = [end, start]; // tolerate swapped inputs

  // Cap the span so a hostile/typo range can't zero-fill thousands of days.
  const spanDays =
    Math.round(
      (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1;
  if (spanDays > MAX_RANGE_DAYS) {
    start = istDayKey(new Date(`${end}T00:00:00Z`).getTime() - (MAX_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000);
  }

  // Platform-wide (admin) — fetch all posts + plans. Datasets are small (capped
  // image histories, weekly plans), so we reduce in memory.
  const [posts, plans] = await Promise.all([
    prisma.post.findMany({
      select: {
        id: true,
        postType: true,
        status: true,
        imageUrl: true,
        carouselImages: true,
        imageHistory: true,
        imagePrompt: true,
        createdAt: true,
      },
    }),
    prisma.contentPlan.findMany({ select: { createdAt: true } }),
  ]);

  const report = buildUsageReport(posts, plans, start, end);
  return NextResponse.json(report);
}
