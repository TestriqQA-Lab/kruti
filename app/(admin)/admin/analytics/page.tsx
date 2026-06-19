import { prisma } from "@/lib/prisma";
import { buildUsageReport, istDayKey } from "@/lib/usage-analytics";
import { getImagePromptsRevealUntil } from "@/lib/app-settings";
import AdminAnalyticsClient from "@/components/AdminAnalyticsClient";

// Always render fresh (usage data changes continuously).
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const now = Date.now();
  const start = istDayKey(now - 29 * 24 * 60 * 60 * 1000);
  const end = istDayKey(now);

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

  // Privacy gate: only include user image thumbnails + prompts while the admin has
  // explicitly revealed them (auto-expires). Otherwise strip them server-side so the
  // sensitive data never reaches the client.
  const revealUntil = await getImagePromptsRevealUntil();
  const revealed = revealUntil !== null && revealUntil.getTime() > Date.now();
  report.promptsRevealed = revealed;
  report.promptsRevealUntil = revealed && revealUntil ? revealUntil.toISOString() : null;
  if (!revealed) report.prompts = [];

  return <AdminAnalyticsClient initialReport={report} initialStart={start} initialEnd={end} />;
}
