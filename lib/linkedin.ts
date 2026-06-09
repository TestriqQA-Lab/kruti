import { prisma } from "@/lib/prisma";

export interface LinkedInProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email?: string;
  headline?: string;
  summary?: string;
  industry?: string;
  skills?: string[];
}

export async function syncLinkedInProfile(
  userId: string,
  accessToken: string
): Promise<void> {
  try {
    // Fetch basic profile via OpenID userinfo endpoint
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) return;
    const profile = await profileRes.json();

    // Try to fetch extended profile (requires r_basicprofile scope)
    let headline: string | undefined;
    let industry: string | undefined;

    try {
      const meRes = await fetch(
        "https://api.linkedin.com/v2/me?projection=(id,localizedHeadline,industryName)",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (meRes.ok) {
        const me = await meRes.json();
        headline = me.localizedHeadline;
        industry = me.industryName?.localized?.en_US;
      }
    } catch {
      // Extended profile not available with this token scope
    }

    // Check if another user already owns this linkedinId
    const existingWithSub = await prisma.user.findUnique({
      where: { linkedinId: profile.sub },
      select: { id: true },
    });
    const canSetLinkedinId = !existingWithSub || existingWithSub.id === userId;

    // Only overwrite headline/industry if LinkedIn actually returned them.
    // This prevents blanking out user-edited values on every login.
    const profileUpdate: Record<string, unknown> = {
      ...(canSetLinkedinId ? { linkedinId: profile.sub } : {}),
      profileUrl: `https://www.linkedin.com/in/${profile.sub}`,
    };
    if (headline) profileUpdate.headline = headline;
    if (industry) profileUpdate.industry = industry;

    await prisma.user.upsert({
      where: { id: userId },
      update: profileUpdate,
      create: {
        id: userId,
        linkedinId: profile.sub,
        headline: headline || null,
        industry: industry || null,
        profileUrl: `https://www.linkedin.com/in/${profile.sub}`,
      },
    });
  } catch (err) {
    console.error("syncLinkedInProfile error:", err);
  }
}

/** Safe JSON.parse with fallback - prevents crashes from corrupt DB data */
function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json); } catch { return fallback; }
}

export function buildProfileContext(user: {
  name?: string | null;
  headline?: string | null;
  summary?: string | null;
  skills?: string | null;
  industry?: string | null;
  positioning?: string | null;
  contentGoals?: string | null;
  contentStyles?: string | null;
  targetAudience?: string | null;
}): string {
  const skills = safeJsonParse(user.skills, []);
  const goals = safeJsonParse(user.contentGoals, []);
  const styles = safeJsonParse(user.contentStyles, []);

  return `
Name: ${user.name || "Professional"}
Headline: ${user.headline || "Professional"}
Industry: ${user.industry || "Not specified"}
Summary: ${user.summary || "Not provided"}
Skills: ${skills.length > 0 ? skills.join(", ") : "Not specified"}
Content Positioning: ${user.positioning || "Industry Expert"}
LinkedIn Goals: ${goals.length > 0 ? goals.join(", ") : "Brand Awareness, Network Building"}
Preferred Content Styles: ${styles.length > 0 ? styles.join(", ") : "Narrative, How-to"}
Target Audience: ${user.targetAudience || "LinkedIn professionals in my industry"}
  `.trim();
}
