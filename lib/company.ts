import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Cookie that stores the user's currently-active workspace.
// Value is either "personal" (or absent) for the user's personal workspace,
// or a CompanyProfile id for a company workspace.
export const ACTIVE_WORKSPACE_COOKIE = "kruti_workspace";

/**
 * FUTURE / DORMANT — auto-enable the Company Profiles feature for users who
 * administer one or more LinkedIn Company Pages.
 *
 * Requires the `r_organization_admin` scope, which is part of LinkedIn's
 * "Community Management API" and needs LinkedIn's approval. It is intentionally
 * NOT wired into the sign-in flow yet, because adding an unapproved scope to the
 * OAuth request would break login for everyone.
 *
 * To activate once the app is approved:
 *   1. Add `r_organization_admin` to the LinkedIn scope in lib/auth.ts.
 *   2. In the `signIn` callback, call this with the user's access token.
 * Until then, eligibility is granted manually via the admin toggle.
 */
export async function syncCompanyProfilesEligibility(
  userId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const res = await fetch(
      "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
      }
    );
    if (!res.ok) return false; // 403 until the scope/approval is in place
    const data = await res.json();
    const hasPages = Array.isArray(data?.elements) && data.elements.length > 0;
    if (hasPages) {
      await prisma.user.update({
        where: { id: userId },
        data: { companyProfilesEnabled: true },
      });
    }
    return hasPages;
  } catch {
    return false;
  }
}

/** Whether the Company Profiles feature is enabled for this user. */
export async function isCompanyProfilesEnabled(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyProfilesEnabled: true },
  });
  return !!u?.companyProfilesEnabled;
}

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
    // Gate by the feature flag too — a stale cookie can't scope to a company
    // if the user is no longer eligible.
    where: { id: raw, userId, user: { companyProfilesEnabled: true } },
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
