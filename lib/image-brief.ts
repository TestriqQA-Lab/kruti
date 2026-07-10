import { generateText, generateProText, parseJSON } from "@/lib/gemini";
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
  style: string; // aesthetic register, content-matched (modern editorial, realistic premium - never neon/glow)
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
  connectsFrom?: string; // how this slide follows from the previous one (narrative continuity)
  connectsTo?: string; // how this slide leads into the next one
}

export interface CarouselPlan {
  theme?: string; // overall theme + modern visual direction, derived from analysing the post
  style: string; // one shared art-direction style, reused by every slide
  palette: string; // one shared palette + light mood, reused by every slide
  slides: CarouselSlide[]; // exactly `count` entries, in carousel order (hook ... takeaway)
  plannerModel?: string; // which text model actually produced the plan (pro tier or flash fallback)
}

const DEFAULT_PALETTE =
  "warm directional light on rich neutral tones, deep charcoal shadows, one confident accent colour drawn from the subject.";

/** Collapse whitespace, strip wrapping quotes, hard-cap length. */
export function clampHeadline(raw: string, max = 40): string {
  const s = (raw || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Trim back to a word boundary so on-image text is never cut mid-word (unless the
  // first word itself is longer than max).
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
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
    "thought-leadership": "deep editorial concept infographic",
    "tips": "bold flat colour-block infographic",
    "story": "warm illustrated editorial infographic",
    "question": "high-contrast mono plus one accent infographic",
    "listicle": "clean cool-crisp data infographic",
  };
  const fallbackStructures: Record<string, string> = {
    "thought-leadership": "a central idea with three labeled supporting pillars",
    "tips": "a numbered vertical list of labeled step cards",
    "story": "a left-to-right journey of connected milestone nodes",
    "question": "a central question with two contrasting labeled sides",
    "listicle": "a clean grid of labeled point cards",
  };
  const fallbackPalettes: Record<string, string> = {
    "thought-leadership": "near-black ink background, one bright amber accent, light text, soft real shadows.",
    "tips": "two bold flat colour blocks, deep teal and warm coral, high contrast, charcoal text.",
    "story": "warm cream background, terracotta accent, soft brown shadow, ivory cards.",
    "question": "cool slate-grey background, one decisive magenta accent, light panels, gentle shadow.",
    "listicle": "crisp off-white background, deep forest-green accent, soft shadows, slate text.",
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
      // The planner is a pro-tier text model (falls back to flash). It reads the full
      // post and returns one "packet" per slide: the slide's text content plus a
      // visual prompt built from that text, with prev/next continuity refs.
      const { text: raw, model: plannerModel } = await generateProText(
        buildCarouselPlanPrompt(post.title, post.body, post.postType, industry, count, userProfile),
        // A deliberate temperature so two similar-tone posts diverge (per-post variety);
        // getCarouselPlan retries twice + clamps, so an occasional off sample is absorbed.
        { temperature: 1.1, topP: 0.95 }
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
              nodes: clampLabels((s as { nodes?: unknown }).nodes, 4, 28),
              connectsFrom: clampHeadline(String((s as { connectsFrom?: unknown }).connectsFrom ?? ""), 100),
              connectsTo: clampHeadline(String((s as { connectsTo?: unknown }).connectsTo ?? ""), 100),
            }))
            .filter((s) => !!s.headline)
            .slice(0, count)
        : [];
      if (parsed.style && parsed.palette && slides.length >= 2) {
        return {
          theme: clampHeadline(String(parsed.theme ?? ""), 120),
          style: clampStyle(parsed.style),
          palette: String(parsed.palette),
          slides,
          plannerModel,
        };
      }
    } catch (err) {
      console.error(`[CarouselPlan] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return null;
}
