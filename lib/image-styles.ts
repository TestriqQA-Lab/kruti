// Single source of truth for image VISUAL STYLES. Kept dependency-free so both the
// prompt builders (lib/prompts.ts) and the image-prompt renderer (lib/imagen.ts) can
// import it without circular imports. Variety across these styles is what stops every
// generated image from looking like the same designed infographic.

export const IMAGE_STYLES = [
  "photo",
  "illustration",
  "infographic",
  "typographic",
  "mockup",
  "minimal",
] as const;

export type ImageStyle = (typeof IMAGE_STYLES)[number];

/**
 * Styles that reliably render real, legible typography on Gemini 3 Pro Image.
 * Only these embed the headline (and other short labels) as rendered text. The
 * remaining styles (photo, illustration, minimal) are kept text-free so the model
 * never produces garbled lettering inside a photo/illustration.
 */
export const TEXT_BEARING_STYLES: ImageStyle[] = ["infographic", "typographic", "mockup"];

export function isTextBearingStyle(style: ImageStyle): boolean {
  return TEXT_BEARING_STYLES.includes(style);
}

/**
 * Deterministic fallback: ordered (best-fit first) style options per post type, used
 * when the model doesn't return a valid style. Ordering + a title-hash seed give
 * variety so a batch of same-type posts doesn't collapse onto one style.
 */
const POSTTYPE_STYLE_FALLBACK: Record<string, ImageStyle[]> = {
  "thought-leadership": ["typographic", "illustration", "photo", "minimal", "infographic"],
  tips: ["minimal", "infographic", "illustration", "mockup", "photo"],
  story: ["photo", "illustration", "typographic", "minimal", "infographic"],
  question: ["typographic", "minimal", "illustration", "photo", "infographic"],
  listicle: ["infographic", "minimal", "illustration", "mockup", "photo"],
  carousel: ["infographic", "illustration", "mockup", "photo", "typographic"],
  poll: ["typographic", "infographic", "minimal", "illustration", "photo"],
  default: ["illustration", "photo", "infographic", "typographic", "minimal", "mockup"],
};

/** Map a loosely-worded model answer to a canonical style id, else null. */
export function normalizeStyle(raw: string | null | undefined): ImageStyle | null {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return null;
  if ((IMAGE_STYLES as readonly string[]).includes(v)) return v as ImageStyle;
  if (/photo|photograph|realistic|cinematic/.test(v)) return "photo";
  if (/illustrat|vector|flat|drawing|isometric/.test(v)) return "illustration";
  if (/info|chart|graph|\bdata\b|diagram|stat/.test(v)) return "infographic";
  if (/typograph|typo|\btext\b|quote|poster|word/.test(v)) return "typographic";
  if (/mockup|mock-up|device|\bapp\b|\bui\b|screen|dashboard|product/.test(v)) return "mockup";
  if (/minimal|icon|negative|simple|clean/.test(v)) return "minimal";
  return null;
}

/** Stable, RNG-free hash of a string -> non-negative int (seeds fallback variety). */
export function styleSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic best-fit-with-variety style for a post type + seed. Never throws. */
export function pickFallbackStyle(postType: string, seed: number): ImageStyle {
  const list = POSTTYPE_STYLE_FALLBACK[postType] ?? POSTTYPE_STYLE_FALLBACK.default;
  return list[((seed % list.length) + list.length) % list.length];
}

/** Resolve a final style: validated model value, else a deterministic fallback. */
export function resolveStyle(rawModelStyle: string | null | undefined, postType: string, seedText: string): ImageStyle {
  return normalizeStyle(rawModelStyle) ?? pickFallbackStyle(postType, styleSeed(seedText));
}

/**
 * Guidance injected into the brief/carousel prompts so the art-director model picks
 * the best style for each post (and varies it across a batch).
 */
export const STYLE_SELECTION_GUIDE = `Choose the ONE visual style that best fits THIS specific post, from exactly this list: photo, illustration, infographic, typographic, mockup, minimal. Pick by the post's topic, never by habit:
- "infographic": real data, numbers, percentages, growth, results, comparisons, or a multi-step process/framework worth charting (use only real figures from the post).
- "mockup": a product, app, software, feature, UI/UX, dashboard, or tool - anything seen on a screen.
- "photo": real people, customers, teams, a workplace, a physical place or object, a human moment, a story or anecdote.
- "illustration": an abstract idea, mindset, metaphor, culture, or concept with no real photographable subject.
- "typographic": a bold one-line claim, a memorable quote, or a provocative question where the WORDS are the point.
- "minimal": a single principle, tip, or mental model best expressed by one clean symbol with lots of space.
Do NOT default to "infographic" for every post - choose it only when the post genuinely has data or multi-part structure. Deliberately VARY the style across posts so the feed never looks uniform.`;
