import { generateText, parseJSON } from "@/lib/gemini";
import { buildImageBriefPrompt, buildCarouselPlanPrompt, UserVisualProfile } from "@/lib/prompts";

/**
 * Content-aware image briefs.
 *
 * The text model reads a post's real title + body and, acting as a senior marketing
 * designer, returns a brief for ONE rich, designed INFOGRAPHIC-style image that
 * explains the post at a glance: a named information-design STRUCTURE (roadmap,
 * hub-and-spoke, comparison, staircase, dashboard, pipeline, card grid) built from the
 * post, meaningful icons, organized informative labels (nodes + optional feature
 * cards), a prominent headline + subheadline, and a polished, content-matched look.
 */

export interface ImageBrief {
  style: string; // aesthetic register, content-matched (neon tech-dark w/ glows, OR clean light w/ accent)
  structure: string; // the named information-design layout that maps the post
  headline: string; // prominent bold headline (2-6 words, <=34 chars)
  subheadline: string; // one supporting subheadline line (<=70 chars), "" if none
  visual: string; // art-director brief for the designed graphic (layout + icons + connectors + cards)
  nodes: string[]; // 3-7 short real labels from the post (roadmap steps / spokes / comparison sides)
  cards: string[]; // 0-4 optional short feature/benefit cards from the post
  palette: string; // rich colour + accent + light direction, differs per post
}

export interface CarouselSlide {
  structure: string;
  headline: string;
  subheadline?: string;
  visual: string;
  nodes?: string[];
}

export interface CarouselPlan {
  style: string; // one shared art-direction style, reused by every slide
  palette: string; // one shared palette + light mood, reused by every slide
  slides: CarouselSlide[]; // 2..count entries, in carousel order (hook ... takeaway)
}

const DEFAULT_PALETTE =
  "warm directional light on rich neutral tones, deep charcoal shadows, one confident accent colour drawn from the subject.";

/** Collapse whitespace, strip wrapping quotes, hard-cap length. */
export function clampHeadline(raw: string, max = 40): string {
  return (raw || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, max)
    .trim();
}

/** Subheadline: one clean line, capped so it stays a supporting line. */
export function clampSubhead(raw: unknown): string {
  return clampHeadline(String(raw ?? ""), 70);
}

/** The named aesthetic register. Falls back to a safe marketing-infographic look. */
export function clampStyle(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 90)
    .trim();
  return s || "clean modern marketing infographic";
}

/** The information-design layout. Falls back to a safe, common structure. */
export function clampStructure(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 90)
    .trim();
  return s || "a clean labeled diagram of connected nodes";
}

/**
 * Normalise the on-image label list (nodes or cards): trim, strip quotes, dedupe,
 * hard-cap each label's length and the list length so the graphic stays readable and
 * never a wall of text. Any missing/garbage value safely becomes [].
 */
export function clampLabels(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "")
      .replace(/\s+/g, " ")
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .trim()
      .slice(0, maxLen)
      .trim();
    const key = s.toLowerCase();
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
      if (out.length === maxItems) break;
    }
  }
  return out;
}

/** A 2-6 word headline derived from the post title, used when the model fails. */
function headlineFromTitle(title: string): string {
  const words = (title || "Key insight").trim().split(/\s+/).slice(0, 6).join(" ");
  return clampHeadline(words, 34) || "Key insight";
}

/** Deterministic, still-content-related infographic brief for when the model is down. */
function fallbackBrief(
  post: { title: string; postType: string },
  headline?: string
): ImageBrief {
  const role = (headline || "").trim() || "professional";
  const fallbackStyles: Record<string, string> = {
    "thought-leadership": "bold editorial concept infographic",
    "tips": "clean modern flat-vector infographic",
    "story": "warm editorial illustrated infographic",
    "question": "striking minimal concept infographic",
    "listicle": "clean data-driven marketing infographic",
  };
  const fallbackStructures: Record<string, string> = {
    "thought-leadership": "a central idea with three labeled supporting pillars",
    "tips": "a numbered vertical list of labeled step cards",
    "story": "a left-to-right journey of connected milestone nodes",
    "question": "a central question with two contrasting labeled sides",
    "listicle": "a clean grid of labeled point cards",
  };
  const fallbackPalettes: Record<string, string> = {
    "thought-leadership": "deep navy background, warm amber accent, crisp ivory text, soft glows.",
    "tips": "clean light background, one orange accent, soft shadows, charcoal text.",
    "story": "warm cream background, terracotta accent, soft brown shadow, ivory cards.",
    "question": "moody plum background, soft ivory text, warm sand accent, gentle glow.",
    "listicle": "bright white background, fresh teal accent, soft shadows, deep slate text.",
  };
  const structure = fallbackStructures[post.postType] || "a clean labeled diagram of connected nodes";
  return {
    style: fallbackStyles[post.postType] || "clean modern marketing infographic",
    structure,
    headline: headlineFromTitle(post.title),
    subheadline: "",
    visual: `A designed, premium infographic that explains "${post.title}" at a glance for the world of a ${role}: ${structure} with clean modern icons, connectors, and organized labels, filling the frame as one cohesive marketing graphic.`,
    nodes: [],
    cards: [],
    palette: fallbackPalettes[post.postType] || DEFAULT_PALETTE,
  };
}

/**
 * Build a content-aware brief for a single image. Tries the text model twice, then
 * falls back to a title-derived brief (so the image stays content-related even if the
 * model call fails). Never returns null.
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
      const headline = clampHeadline(parsed.headline || "", 34);
      if (headline && parsed.visual && parsed.palette) {
        return {
          style: clampStyle(parsed.style),
          structure: clampStructure(parsed.structure),
          headline,
          subheadline: clampSubhead(parsed.subheadline),
          visual: String(parsed.visual),
          nodes: clampLabels(parsed.nodes, 7, 28),
          cards: clampLabels(parsed.cards, 4, 22),
          palette: String(parsed.palette),
        };
      }
    } catch (err) {
      console.error(`[ImageBrief] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return fallbackBrief(post, userProfile?.headline ?? undefined);
}

/**
 * Build a cohesive multi-slide carousel plan from a post. Returns null on failure so
 * the caller can fall back to the legacy generic carousel path.
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
              structure: clampStructure((s as { structure?: unknown }).structure),
              headline: clampHeadline(s.headline, 34),
              subheadline: clampSubhead((s as { subheadline?: unknown }).subheadline),
              visual: String(s.visual),
              nodes: clampLabels((s as { nodes?: unknown }).nodes, 6, 28),
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
