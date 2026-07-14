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
    // Refresh the avatar URL on every login - LinkedIn picture URLs are signed and
    // expire, so re-storing the fresh one keeps avatars from breaking over time.
    if (profile.picture) profileUpdate.image = profile.picture;

    await prisma.user.upsert({
      where: { id: userId },
      update: profileUpdate,
      create: {
        id: userId,
        linkedinId: profile.sub,
        headline: headline || null,
        industry: industry || null,
        image: profile.picture || null,
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

// ─── Tone direction (turns the stored tone preference into voice guidance) ─────

const TONE_DIRECTION: Record<string, string> = {
  professional: "Professional and credible - precise, expert, substantive. Confident without hype. Plain professional language; contractions are fine, slang and corporate filler are not.",
  conversational: "Friendly, approachable, and relatable. Write like talking to a respected peer over coffee. Warm and direct, lightly informal.",
  inspirational: "Motivating, story-driven, and uplifting. Lead with meaning and momentum. Confident and energizing, but earned, never cheesy.",
  educational: "Teaching-first and clear. Explain step by step, break down the why, make the complex feel simple. Patient, structured, generous with insight.",
  formal: "Polished, precise, and reserved. Measured sentences, professional distance, zero slang.",
  casual: "Relaxed and human. Contractions, plain words, an easy rhythm like a quick note to a colleague.",
};

/**
 * Resolves tonePrefs (a JSON string of either a bare string or an object) into a
 * readable tone label plus concrete voice direction. Safe against bad data and
 * double-encoded rows (e.g. a value that parses to a still-quoted string).
 */
function resolveTone(tonePrefs: string | null | undefined): { label: string; direction: string } {
  const parsed = safeJsonParse<unknown>(tonePrefs, tonePrefs ?? null);

  let key = "";
  let extra = "";

  if (typeof parsed === "string") {
    key = parsed.trim().toLowerCase();
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    key = String(obj.tone ?? obj.voice ?? obj.style ?? obj.value ?? "").trim().toLowerCase();
    const notes = [obj.voice, obj.style, obj.notes, obj.description]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (notes.length > 0) extra = notes.join("; ");
  }

  // Guard against double-encoded rows whose value parses to a still-quoted string.
  key = key.replace(/^"+|"+$/g, "").trim();

  const direction =
    TONE_DIRECTION[key] ||
    extra ||
    "Professional, clear, and authentic - the natural voice of a real expert in this field.";
  const label = key
    ? key.charAt(0).toUpperCase() + key.slice(1)
    : extra
    ? "Custom"
    : "Professional";
  return { label, direction };
}

// Turns the user's chosen positioning into a binding WRITING stance (not just an
// image direction). This is what makes a Contrarian actually sound contrarian and an
// Educator teach - it augments the tone direction, it never replaces it.
const POSITIONING_VOICE: Record<string, string> = {
  "thought leader": "lead with a clear point of view and a stance worth following",
  "industry expert": "argue from credibility, proof, and precise analysis",
  storyteller: "teach through a narrative arc and concrete moments",
  educator: "teach step by step, break down the why, make the complex simple",
  entertainer: "be vivid and memorable; land the insight with personality and a light touch",
  contrarian: "challenge the consensus; lead with the counter-take and defend it",
  practitioner: "speak from hands-on, in-the-trenches experience and tactical detail",
  "community builder": "write to convene and invite participation; frame ideas as shared conversation",
};

export function buildProfileContext(user: {
  name?: string | null;
  headline?: string | null;
  summary?: string | null;
  skills?: string | null;
  industry?: string | null;
  tonePrefs?: string | null;
  positioning?: string | null;
  contentGoals?: string | null;
  contentStyles?: string | null;
  targetAudience?: string | null;
}): string {
  const skills = safeJsonParse(user.skills, []);
  const goals = safeJsonParse(user.contentGoals, []);
  const styles = safeJsonParse(user.contentStyles, []);
  const tone = resolveTone(user.tonePrefs);
  const posKey = (user.positioning || "").trim().toLowerCase();
  const posStance = POSITIONING_VOICE[posKey] || "";

  return `
WHO THIS PERSON IS
Name: ${user.name || "Professional"}
Headline: ${user.headline || "Professional"}
Industry: ${user.industry || "Not specified"}
About / Summary: ${user.summary || "Not provided"}
Core expertise and skills: ${skills.length > 0 ? skills.join(", ") : "Not specified"}

HOW THEY SHOW UP ON LINKEDIN
Content positioning: ${user.positioning || "Industry Expert"}
LinkedIn goals: ${goals.length > 0 ? goals.join(", ") : "Brand Awareness, Network Building"}
Preferred content styles: ${styles.length > 0 ? styles.join(", ") : "Narrative, How-to"}

VOICE AND TONE (write every post in this voice - this is non-negotiable)
Tone preference: ${tone.label}
Voice direction: ${tone.direction}${posStance ? `\nPositioning stance (how this person must come across): ${posStance}.` : ""}

WHO THEY ARE WRITING FOR
Target audience: ${user.targetAudience || "LinkedIn professionals in my industry"}

Write as THIS person, in THIS voice, for THIS audience. The reader should believe a real expert in ${user.industry || "this field"} wrote it personally.
  `.trim();
}
