import { prisma } from "@/lib/prisma";

// Privacy gate for showing user image thumbnails + prompts in admin analytics.
// Stored as a global AppSetting: an ISO timestamp until which they are revealed,
// or null/absent for hidden. Auto-expires (no cron) - "revealed" is just
// (until > now). Helpers are resilient: if the AppSetting table doesn't exist yet
// (pre-migration), they default to HIDDEN rather than throwing.

const IMAGE_PROMPTS_REVEAL_KEY = "imagePromptsRevealUntil";

/** Safety cap on the reveal window, in days. */
export const MAX_REVEAL_DAYS = 3650;

/** ISO expiry until which user image prompts are revealed in admin analytics, or null. */
export async function getImagePromptsRevealUntil(): Promise<Date | null> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: IMAGE_PROMPTS_REVEAL_KEY } });
    if (!row?.value) return null;
    const d = new Date(row.value);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null; // table not migrated yet -> hidden by default
  }
}

/** True while user image prompts/images are temporarily revealed (and not expired). */
export async function isImagePromptsRevealed(): Promise<boolean> {
  const until = await getImagePromptsRevealUntil();
  return until !== null && until.getTime() > Date.now();
}

/** Reveal user image prompts for `days` (a positive whole number). Returns the new expiry. */
export async function setImagePromptsReveal(days: number): Promise<Date> {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const value = until.toISOString();
  await prisma.appSetting.upsert({
    where: { key: IMAGE_PROMPTS_REVEAL_KEY },
    update: { value },
    create: { key: IMAGE_PROMPTS_REVEAL_KEY, value },
  });
  return until;
}

/** Immediately hide user image prompts again. */
export async function clearImagePromptsReveal(): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: IMAGE_PROMPTS_REVEAL_KEY },
    update: { value: null },
    create: { key: IMAGE_PROMPTS_REVEAL_KEY, value: null },
  });
}
