import { generateText, parseJSON } from "@/lib/gemini";
import { buildImageBriefPrompt, buildCarouselPlanPrompt } from "@/lib/prompts";

/**
 * Content-aware image briefs.
 *
 * The text model reads a post's real title + body and returns a brief that ties
 * the generated image to the post's actual content, plus a short headline to
 * render on the image. This replaces the old generic "scene or metaphor" prompt
 * that produced images unrelated to the post.
 */

export interface ImageBrief {
  headline: string; // 2-5 words, <=28 chars, the exact text rendered on the image
  visual: string; // one single-line concrete scene from the post (no text/colors)
  palette: string; // one single-line color direction (blue accents on a neutral base)
}

export interface CarouselSlide {
  headline: string;
  visual: string;
}

export interface CarouselPlan {
  palette: string; // one shared palette + register, reused by every slide
  slides: CarouselSlide[]; // 2..count entries, in carousel order (hook ... takeaway)
}

const DEFAULT_PALETTE =
  "Clean near-white #F4F6F8 base with brand blue #0A66C2 and deep blue #004182 as accents on one anchor area; keep the headline zone high-contrast.";

/**
 * Normalise a model-produced headline so it always fits on the image: collapse
 * whitespace, strip wrapping quotes, and hard-cap at 28 characters. Instructions
 * alone do not guarantee the cap, so we enforce it in code.
 */
export function clampHeadline(raw: string): string {
  return (raw || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 28)
    .trim();
}

/** A 2-5 word headline derived from the post title, used when the model fails. */
function headlineFromTitle(title: string): string {
  const words = (title || "Key insight").trim().split(/\s+/).slice(0, 5).join(" ");
  return clampHeadline(words) || "Key insight";
}

/** Deterministic, still-content-related brief for when the text model is down. */
function fallbackBrief(
  post: { title: string; postType: string },
  industry: string
): ImageBrief {
  return {
    headline: headlineFromTitle(post.title),
    visual: `A clean, modern editorial scene representing ${post.postType} content for ${industry}, with clear, uncluttered negative space in the top third for the headline.`,
    palette: DEFAULT_PALETTE,
  };
}

/**
 * Build a content-aware brief for a single image. Tries the text model twice,
 * then falls back to a title-derived brief (so the image stays content-related
 * even if the model call fails). Never returns null.
 */
export async function getImageBrief(
  post: { title: string; body: string; postType: string },
  industry: string
): Promise<ImageBrief> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateText(
        buildImageBriefPrompt(post.title, post.body, post.postType, industry)
      );
      const parsed = parseJSON<Partial<ImageBrief>>(raw);
      const headline = clampHeadline(parsed.headline || "");
      if (headline && parsed.visual && parsed.palette) {
        return {
          headline,
          visual: String(parsed.visual),
          palette: String(parsed.palette),
        };
      }
    } catch (err) {
      console.error(`[ImageBrief] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return fallbackBrief(post, industry);
}

/**
 * Build a cohesive multi-slide carousel plan from a post. Returns null on
 * failure so the caller can fall back to the legacy generic carousel path.
 */
export async function getCarouselPlan(
  post: { title: string; body: string; postType: string },
  industry: string,
  count: number
): Promise<CarouselPlan | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateText(
        buildCarouselPlanPrompt(post.title, post.body, post.postType, industry, count)
      );
      const parsed = parseJSON<Partial<CarouselPlan>>(raw);
      const slides = Array.isArray(parsed.slides)
        ? parsed.slides
            .filter((s): s is CarouselSlide => !!s && !!s.headline && !!s.visual)
            .map((s) => ({ headline: clampHeadline(s.headline), visual: String(s.visual) }))
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
