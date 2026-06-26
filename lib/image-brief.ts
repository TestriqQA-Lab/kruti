import { generateText, parseJSON } from "@/lib/gemini";
import { buildImageBriefPrompt, buildCarouselPlanPrompt, UserVisualProfile } from "@/lib/prompts";

/**
 * Content-aware image briefs.
 *
 * The text model reads a post's real title + body and returns a brief that ties
 * the generated image to the post's actual content. The image is a DESIGNED graphic
 * (infographic / chart / diagram preferred) driven by the person's ROLE, with a short
 * supporting headline caption and minimal meaningful text.
 */

export interface ImageBrief {
  headline: string; // hero message (3-7 words, <=42 chars) stating the post's core point, prominently rendered
  subpoints: string[]; // 0-3 short supporting key points (<=32 chars each) rendered as legible on-image labels
  visual: string; // one single-line graphic concept (style varies by content) that EXPLAINS the post + the person's role
  palette: string; // one single-line color direction with specific hex colors
  textPosition: string; // where the headline sits: top-center, bottom-center, bottom-left, center-left, overlay-center
}

export interface CarouselSlide {
  headline: string;
  visual: string;
  textPosition?: string;
}

export interface CarouselPlan {
  palette: string; // one shared palette + register, reused by every slide
  slides: CarouselSlide[]; // 2..count entries, in carousel order (hook ... takeaway)
}

const DEFAULT_PALETTE =
  "Rich, warm neutrals with a bold accent - deep charcoal #1E293B background, warm ivory #FEFCE8 headline text, and a vibrant accent color for key elements.";

/**
 * Normalise a model-produced headline so it always fits on the image: collapse
 * whitespace, strip wrapping quotes, and hard-cap at 28 characters. Instructions
 * alone do not guarantee the cap, so we enforce it in code.
 */
export function clampHeadline(raw: string, max = 42): string {
  return (raw || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, max)
    .trim();
}

/**
 * Normalise the model-produced supporting points so they render as tight, legible
 * on-image text: collapse whitespace, strip wrapping quotes, dedupe, hard-cap each
 * at 32 chars and the list at 3. Optional field - any missing/garbage value safely
 * becomes [] so the headline text-floor still governs.
 */
export function clampSubpoints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "")
      .replace(/\s+/g, " ")
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim()
      .slice(0, 32)
      .trim();
    const key = s.toLowerCase();
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
      if (out.length === 3) break;
    }
  }
  return out;
}

/** A 3-7 word headline derived from the post title, used when the model fails. */
function headlineFromTitle(title: string): string {
  const words = (title || "Key insight").trim().split(/\s+/).slice(0, 7).join(" ");
  return clampHeadline(words, 42) || "Key insight";
}

/** Deterministic, still-content-related brief for when the text model is down. */
function fallbackBrief(
  post: { title: string; postType: string },
  industry: string,
  headline?: string
): ImageBrief {
  const role = (headline || "").trim() || "professional";
  // Deterministic per-postType fallbacks (used only when the text model is down, so
  // they can't be content-matched). Kept warm/grounded and non-tech so the fallback
  // never lands on the cool blue/teal/neon look the prompts now forbid.
  const fallbackPalettes: Record<string, string> = {
    "thought-leadership": "Deep navy #1E3A5F background, crisp ivory text, warm amber #F59E0B accent.",
    "tips": "Warm paper #FAF7F0 background, muted clay #B45309 accent elements, dark charcoal #1E293B text.",
    "story": "Warm terracotta #C2410C tones, creamy ivory #FFFBEB base, soft brown accents.",
    "question": "Muted plum #6B2D5C background, soft ivory text, warm sand highlights.",
    "listicle": "Fresh sage #4D7C0F accents, clean white base, dark slate #334155 text.",
  };
  const textPositions = ["top-center", "bottom-center", "center-left", "bottom-left"];
  // Use title length as a simple deterministic seed for position variety
  const posIdx = (post.title || "").length % textPositions.length;
  return {
    headline: headlineFromTitle(post.title),
    subpoints: [],
    visual: `A clean infographic-style graphic about "${post.title}" anchored to what a ${role} actually does (broad field: ${industry} - context only, never a generic stereotype of the field), with a simple chart or diagram, a few short real labels, and clear space for the headline plus two or three short supporting points.`,
    palette: fallbackPalettes[post.postType] || DEFAULT_PALETTE,
    textPosition: textPositions[posIdx],
  };
}

/**
 * Build a content-aware brief for a single image. Tries the text model twice,
 * then falls back to a title-derived brief (so the image stays content-related
 * even if the model call fails). Never returns null.
 */
export async function getImageBrief(
  post: { title: string; body: string; postType: string },
  industry: string,
  userProfile?: UserVisualProfile
): Promise<ImageBrief> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateText(
        buildImageBriefPrompt(post.title, post.body, post.postType, industry, userProfile)
      );
      const parsed = parseJSON<Partial<ImageBrief>>(raw);
      const headline = clampHeadline(parsed.headline || "", 42);
      if (headline && parsed.visual && parsed.palette) {
        const validPositions = ["top-center", "bottom-center", "bottom-left", "center-left", "overlay-center"];
        const textPosition = validPositions.includes(parsed.textPosition || "") ? parsed.textPosition! : "top-center";
        return {
          headline,
          subpoints: clampSubpoints(parsed.subpoints),
          visual: String(parsed.visual),
          palette: String(parsed.palette),
          textPosition,
        };
      }
    } catch (err) {
      console.error(`[ImageBrief] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return fallbackBrief(post, industry, userProfile?.headline ?? undefined);
}

/**
 * Build a cohesive multi-slide carousel plan from a post. Returns null on
 * failure so the caller can fall back to the legacy generic carousel path.
 */
export async function getCarouselPlan(
  post: { title: string; body: string; postType: string },
  industry: string,
  count: number,
  userProfile?: UserVisualProfile
): Promise<CarouselPlan | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateText(
        buildCarouselPlanPrompt(post.title, post.body, post.postType, industry, count, userProfile)
      );
      const parsed = parseJSON<Partial<CarouselPlan>>(raw);
      const validPositions = ["top-center", "bottom-center", "bottom-left", "center-left", "overlay-center"];
      const slides = Array.isArray(parsed.slides)
        ? parsed.slides
            .filter((s): s is CarouselSlide => !!s && !!s.headline && !!s.visual)
            .map((s) => ({
              headline: clampHeadline(s.headline),
              visual: String(s.visual),
              textPosition: validPositions.includes(s.textPosition || "") ? s.textPosition : undefined,
            }))
            .filter((s) => !!s.headline)
            .slice(0, count)
        : [];
      if (parsed.palette && slides.length >= 2) {
        return { palette: String(parsed.palette), slides };
      }
    } catch (err) {
      console.error(`[CarouselPlan] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return null;
}
