import { generateText, parseJSON } from "@/lib/gemini";
import { buildImageBriefPrompt, buildCarouselPlanPrompt, UserVisualProfile } from "@/lib/prompts";

/**
 * Content-aware image briefs.
 *
 * The text model reads a post's real title + body and, acting as an editorial art
 * director, returns a brief for ONE striking, content-driven image. The VISUAL is
 * the hero (a genuinely different medium/style per post - photo, illustration, data
 * viz, conceptual...) and a short headline only supports it. No house style, no
 * default look, no forced text stack.
 */

export interface ImageBrief {
  style: string; // ONE named art-direction medium/style, chosen from the post's content (varies per post)
  visual: string; // the hero image itself - a rich, concrete art-director scene that represents the post
  headline: string; // short SUPPORTING headline (3-6 words, <=36 chars) stating the post's core point
  label: string; // AT MOST one short callout figure/label, "" unless the visual is a chart/diagram/data scene
  palette: string; // one single-line colour + light direction drawn from the real subject
}

export interface CarouselSlide {
  headline: string;
  visual: string;
  label?: string;
}

export interface CarouselPlan {
  style: string; // one shared art-direction style, reused by every slide
  palette: string; // one shared palette + light mood, reused by every slide
  slides: CarouselSlide[]; // 2..count entries, in carousel order (hook ... takeaway)
}

const DEFAULT_PALETTE =
  "warm directional light on rich neutral tones, deep charcoal shadows, one confident accent colour drawn from the subject.";

/**
 * Normalise a model-produced headline so it always fits on the image as a clean,
 * supporting line: collapse whitespace, strip wrapping quotes, and hard-cap the
 * length. Instructions alone do not guarantee the cap, so we enforce it in code.
 */
export function clampHeadline(raw: string, max = 40): string {
  return (raw || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, max)
    .trim();
}

/**
 * Normalise the model-produced style name into one short, clean art-direction
 * phrase. Falls back to a neutral, non-tech editorial style if empty/garbage so
 * the image prompt always leads with a committed medium.
 */
export function clampStyle(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 80)
    .trim();
  return s || "clean modern editorial illustration";
}

/**
 * Normalise the single optional callout label: collapse whitespace, strip wrapping
 * quotes, hard-cap at 24 chars. Any missing/garbage value safely becomes "" so no
 * stray text is forced onto the image.
 */
export function clampLabel(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 24)
    .trim();
}

/** A 3-5 word headline derived from the post title, used when the model fails. */
function headlineFromTitle(title: string): string {
  const words = (title || "Key insight").trim().split(/\s+/).slice(0, 5).join(" ");
  return clampHeadline(words, 40) || "Key insight";
}

/** Deterministic, still-content-related brief for when the text model is down. */
function fallbackBrief(
  post: { title: string; postType: string },
  industry: string,
  headline?: string
): ImageBrief {
  const role = (headline || "").trim() || "professional";
  // Deterministic per-postType fallbacks (used only when the text model is down, so
  // they can't be content-matched). Each pairs a genuinely different visual-first
  // style with a warm/grounded, non-tech palette so the fallback never collapses to
  // one look or to the cool blue/teal/neon "tech" cliche.
  const fallbackStyles: Record<string, string> = {
    "thought-leadership": "bold editorial concept illustration",
    "tips": "clean modern editorial illustration",
    "story": "warm cinematic documentary photograph",
    "question": "striking minimal conceptual composition",
    "listicle": "clean editorial data visualization",
  };
  const fallbackPalettes: Record<string, string> = {
    "thought-leadership": "deep navy dusk light, warm amber highlights, crisp ivory accents.",
    "tips": "soft daylight on warm paper tones, muted clay accents, charcoal detail.",
    "story": "warm golden-hour terracotta light, creamy ivory base, soft brown shadow.",
    "question": "moody plum twilight, soft ivory key light, warm sand highlights.",
    "listicle": "bright clean daylight, fresh sage greens, deep slate contrast.",
  };
  return {
    style: fallbackStyles[post.postType] || "clean modern editorial illustration",
    visual: `A single striking image that represents "${post.title}" through the real, tangible world of a ${role} (broad field: ${industry} - context only, never a generic stereotype of the field), one clear focal subject filling the frame with natural depth, real textures, and deliberate lighting, telling the post's story on its own.`,
    headline: headlineFromTitle(post.title),
    label: "",
    palette: fallbackPalettes[post.postType] || DEFAULT_PALETTE,
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
      const headline = clampHeadline(parsed.headline || "", 40);
      if (headline && parsed.visual && parsed.palette) {
        return {
          style: clampStyle(parsed.style),
          visual: String(parsed.visual),
          headline,
          label: clampLabel(parsed.label),
          palette: String(parsed.palette),
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
      const slides = Array.isArray(parsed.slides)
        ? parsed.slides
            .filter((s): s is CarouselSlide => !!s && !!s.headline && !!s.visual)
            .map((s) => ({
              headline: clampHeadline(s.headline),
              visual: String(s.visual),
              label: clampLabel((s as { label?: unknown }).label),
            }))
            .filter((s) => !!s.headline)
            .slice(0, count)
        : [];
      if (parsed.style && parsed.palette && slides.length >= 2) {
        return { style: clampStyle(parsed.style), palette: String(parsed.palette), slides };
      }
    } catch (err) {
      console.error(`[CarouselPlan] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return null;
}
