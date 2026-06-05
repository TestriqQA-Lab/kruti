import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Cookie that stores the user's currently-active workspace.
// Value is either "personal" (or absent) for the user's personal workspace,
// or a CompanyProfile id for a company workspace.
export const ACTIVE_WORKSPACE_COOKIE = "kruti_workspace";

/** All company profiles owned by a user, oldest first. */
export async function getUserCompanyProfiles(userId: string) {
  return prisma.companyProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

/** A single company profile, only if owned by the user (else null). */
export async function getOwnedCompanyProfile(userId: string, companyProfileId: string) {
  return prisma.companyProfile.findFirst({
    where: { id: companyProfileId, userId },
  });
}

/**
 * Resolve the active workspace for the current request from the cookie.
 * Returns the owned CompanyProfile id, or null for the personal workspace.
 * Always verifies ownership so a stale/forged cookie can't leak another
 * user's workspace.
 */
export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
  const raw = cookies().get(ACTIVE_WORKSPACE_COOKIE)?.value;
  if (!raw || raw === "personal") return null;
  const owned = await prisma.companyProfile.findFirst({
    where: { id: raw, userId },
    select: { id: true },
  });
  return owned?.id ?? null;
}

/**
 * The content-preference context for a workspace. For the personal workspace
 * this is the User; for a company workspace this is the CompanyProfile mapped
 * into the same shape the prompt builders expect.
 */
export interface WorkspaceContext {
  kind: "personal" | "company";
  companyProfileId: string | null;
  name?: string | null;
  headline?: string | null;
  summary?: string | null;
  skills?: string | null;
  industry?: string | null;
  positioning?: string | null;
  contentGoals?: string | null;
  contentStyles?: string | null;
  targetAudience?: string | null;
  tonePrefs?: string | null;
  humanMode: boolean;
  postingSchedule?: string | null;
  postSignature?: string | null;
  timezone: string;
}

/** Map a CompanyProfile row into the shared WorkspaceContext shape. */
export function companyToWorkspaceContext(c: {
  id: string;
  name: string;
  tagline: string | null;
  about: string | null;
  industry: string | null;
  positioning: string | null;
  contentGoals: string | null;
  contentStyles: string | null;
  targetAudience: string | null;
  tonePrefs: string | null;
  humanMode: boolean;
  postingSchedule: string | null;
  postSignature: string | null;
  timezone: string;
}): WorkspaceContext {
  return {
    kind: "company",
    companyProfileId: c.id,
    name: c.name,
    headline: c.tagline,
    summary: c.about,
    skills: null,
    industry: c.industry,
    positioning: c.positioning,
    contentGoals: c.contentGoals,
    contentStyles: c.contentStyles,
    targetAudience: c.targetAudience,
    tonePrefs: c.tonePrefs,
    humanMode: c.humanMode,
    postingSchedule: c.postingSchedule,
    postSignature: c.postSignature,
    timezone: c.timezone,
  };
}
