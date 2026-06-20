import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { ImageStyle, IMAGE_STYLES, isTextBearingStyle } from "./image-styles";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return _ai;
}

// Track last generation error (user-facing message). The raw technical error is
// always logged separately via console.error for debugging.
export let lastImageGenError: string | null = null;

/** Map a raw image-model error into a short, clear, user-facing message. */
function friendlyImageError(rawMessage: string): string {
  const m = (rawMessage || "").toLowerCase();
  if (
    m.includes("spending cap") ||
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("exceeded") ||
    m.includes("429")
  ) {
    return "AI image generation is temporarily unavailable - the monthly image quota has been reached. Please try again later.";
  }
  if (m.includes("safety") || m.includes("blocked") || m.includes("prohibited")) {
    return "The image couldn't be generated for this content. Try editing the post text and generating again.";
  }
  if (
    m.includes("api key") ||
    m.includes("api_key") ||
    m.includes("permission") ||
    m.includes("unauthenticated") ||
    m.includes("401") ||
    m.includes("403")
  ) {
    return "The AI image service is temporarily unavailable. Please try again later or contact support.";
  }
  return "Image generation failed. Please try again in a moment.";
}

// ─── Branded Image Prompt (content-aware, renders a headline) ─────────────────

// Per-style art direction. {visual} + {palette} are substituted in; the headline,
// full-bleed/quality footer, and carousel cohesion are appended by the builder. Only
// text-bearing styles (infographic/typographic/mockup) render the headline as text;
// photo/illustration/minimal stay text-free so the model never garbles lettering.
const STYLE_PROMPT: Record<ImageStyle, (visual: string, palette: string) => string> = {
  photo: (visual, palette) =>
    `Create a single premium, photo-realistic editorial photograph for a LinkedIn feed, square 1:1. SUBJECT: ${visual}. Shoot it like a senior brand photographer - one clear hero subject, intentional cinematic composition, natural directional lighting, realistic depth of field, true-to-life materials and skin tones, professional colour grading. MOOD AND LIGHT: ${palette} - express this through the lighting and the scene's own natural colours, not flat colour fills. It must look like a real captured photograph, not a render or collage; anatomy must be correct (natural hands, faces and posture, no extra fingers or warped features). Avoid cheap stock-photo cliches, glossy plastic 3D, lens flare, HDR over-processing, busy clutter, and any caption bar pasted on top.`,
  illustration: (visual, palette) =>
    `Create a single premium editorial illustration for a LinkedIn feed, square 1:1, in a cohesive modern flat / semi-flat vector style with clean shapes, confident linework, subtle texture and depth, and a strong central visual metaphor. CONCEPT TO ILLUSTRATE: ${visual}. Treat it like a top-studio conceptual illustration - one clear idea, balanced negative space, intentional shapes, no clutter. COLOUR: ${palette} - a cohesive, harmonious, limited palette of 3-5 rich on-brand colours (not washed out or monotone), with one coherent illustration style across the whole frame. Avoid photo-realism, 3D plastic renders, gaudy gradients, AI-soup detail, and distorted hands or faces.`,
  infographic: (visual, palette) =>
    `Design a single premium, professionally designed infographic-style square (1:1) graphic for a LinkedIn feed, in the polished style of a high-end report or marketing carousel slide. This is a DESIGNED graphic, not a photo with text on top. WHAT TO SHOW: ${visual}. Render the data or structure as a clean designed element - a tidy bar or line chart, a before-and-after comparison, a numbered step framework, clean icons, or a clear diagram - with realistic axis values, labels and short captions drawn from the post (use only real figures from the post, never invent statistics). COLOUR: ${palette} - cohesive, rich, on-brand, with clear visual hierarchy and purposeful spacing that fills the frame. Avoid stock-photo-with-a-banner looks, gaudy gradients, glossy 3D, and clutter.`,
  typographic: (visual, palette) =>
    `Design a single premium typographic poster for a LinkedIn feed, square 1:1, where bold typography is the hero and the entire visual. STATEMENT / DIRECTION: ${visual}. Set the type in confident, beautifully kerned modern sans-serif (or an intentional editorial pairing) with strong scale contrast and a balanced grid that fills the frame. Background: a rich solid colour, subtle gradient, or minimal geometric/textured field derived from the palette - clean, not busy. COLOUR: ${palette} - cohesive, with high contrast between text and background for crisp legibility. Optionally one small simple supporting shape or icon, never competing with the type. Avoid cheap quote-card templates, drop-shadow soup, gaudy gradients, and clip-art.`,
  mockup: (visual, palette) =>
    `Create a single premium product mockup for a LinkedIn feed, square 1:1 - a sleek, realistic device or app/dashboard shot (phone, laptop, or screen) showing a believable, cleanly-designed interface relevant to the topic. WHAT TO SHOW: ${visual}. Studio-grade composition with one hero device, tasteful soft shadows and reflections, a clean uncluttered backdrop, and realistic on-screen UI with correctly-spelled labels. COLOUR: ${palette} - cohesive, rich, on-brand, expressed through the scene and the UI, not flat fills. Avoid garbled UI text, gaudy gradients, glossy plastic, lens flare, and clutter.`,
  minimal: (visual, palette) =>
    `Create a single premium minimalist composition for a LinkedIn feed, square 1:1, built around generous negative space and one small, deliberate focal element. MOTIF: ${visual} - rendered as a single simple, refined shape, object, or icon, small within a calm uncluttered field. COLOUR: ${palette} - a restrained, cohesive, mostly-quiet palette with one intentional accent, premium and on-brand. Precise alignment, intentional asymmetry, lots of breathing room. Avoid clutter, multiple competing elements, gaudy colour, and textures for their own sake.`,
};

/**
 * Build the final image-model prompt for a content-aware image. Branches on the
 * brief's `style` (photo / illustration / infographic / typographic / mockup /
 * minimal) so images vary by topic instead of all looking like the same designed
 * graphic. Text-bearing styles render the headline as real typography; the rest stay
 * text-free to avoid garbled lettering. Full-bleed, 1:1 and the quality bar are
 * enforced on every style. Pass `position` per carousel slide.
 */
export function buildBrandedImagePrompt(brief: {
  headline: string;
  visual: string;
  palette: string;
  textPosition?: string;
  position?: string;
  style?: ImageStyle;
}): string {
  const { headline, visual, palette, textPosition, position } = brief;
  const style: ImageStyle =
    brief.style && (IMAGE_STYLES as readonly string[]).includes(brief.style) ? brief.style : "infographic";

  const core = STYLE_PROMPT[style](visual, palette);

  let headlineBlock: string;
  if (isTextBearingStyle(style)) {
    const where = textPosition ? ` Place it ${textPosition.replace(/-/g, " ")}, in clear negative space.` : "";
    const extras =
      style === "infographic"
        ? " and the chart's own short, real labels and numbers"
        : style === "mockup"
        ? " and the interface's own short, real labels"
        : "";
    headlineBlock = `HEADLINE (render as clean, correctly-spelled typography that is part of the design): "${headline}".${where} Every letter must be spelled correctly - never produce scrambled or nonsense lettering. Do not add any paragraphs or captions beyond this headline${extras}.`;
  } else {
    headlineBlock = `Render NO text anywhere in the image - no words, letters, numbers, labels, captions, or watermarks of any kind. Let the visual alone carry the message; the post caption provides the words.`;
  }

  const carousel = position
    ? `CAROUSEL: this is ${position} - keep the SAME ${style} style, colour palette, composition grid and headline placement across every slide so the set is cohesive.\n`
    : "";

  const footer = `FULL-BLEED: the artwork fills the entire square and extends to all four edges - NO white, blank, or empty border, frame, padding, or outer margin on any side; keep key elements just clear of the edge so nothing is cut off. Square 1:1, high resolution, crisp, modern and premium, suitable for a LinkedIn feed. Plain hyphens only, never em-dashes.`;

  return `${core}\n\n${headlineBlock}\n\n${carousel}${footer}`;
}

// ─── Image Generation ────────────────────────────────────────────────────────

export async function generatePostImage(
  imagePrompt: string,
  postId: string,
  industry?: string,
  allowText = false
): Promise<string | null> {
  lastImageGenError = null;

  let prompt: string;
  if (allowText) {
    // The caller passed a complete, branded prompt (built by buildBrandedImagePrompt)
    // that intentionally renders a short headline. Send it as-is - do NOT append the
    // no-text wrapper or it would forbid the headline we want.
    prompt = imagePrompt || "Professional abstract business concept";
  } else {
    // Legacy path: ONLY use the imagePrompt (scene/metaphor description) - never pass
    // post title or body text, as image models will attempt to render any text they see.
    const sceneDescription = imagePrompt || "Professional abstract business concept";
    prompt = `${sceneDescription}

Style: Professional, polished, visually compelling. Cinematic composition, natural lighting, professional color grading.
Industry context: ${industry || "business"}.
The image must contain ZERO text - no words, letters, numbers, labels, captions, watermarks, or typography of any kind.
Square format (1:1), filling the entire frame edge to edge with no blank border, frame, or margin on any side. High quality, suitable for LinkedIn.`;
  }

  console.log(`[Imagen] Prompt: ${prompt.slice(0, 80)}...`);

  // Nano Banana Pro - Google's premium image model (much stronger at text
  // rendering, charts and complex composition than the older flash-image preview;
  // this is the quality tier the Gemini app itself uses). Try the preview id first,
  // then the GA id. No flash fallback on purpose, so a Pro access or billing
  // problem surfaces clearly instead of silently returning low-quality images.
  const imageModels = [
    "gemini-3-pro-image-preview",
    "gemini-3-pro-image",
  ];

  for (const model of imageModels) {
    try {
      console.log(`[Imagen] Trying ${model}...`);
      const response = await getAI().models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          // Square LinkedIn format at high resolution so text and detail stay crisp.
          imageConfig: { aspectRatio: "1:1", imageSize: "2K" },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/") && part.inlineData.data) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          const ext = part.inlineData.mimeType === "image/jpeg" ? "jpg" : "png";
          const contentType = part.inlineData.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
          const filename = `post-${postId}-${Date.now()}.${ext}`;
          const blob = await put(`generated/${filename}`, buffer, {
            access: "public",
            contentType,
          });
          console.log(`[Imagen] Generated via ${model}:`, blob.url);
          return blob.url;
        }
      }
      console.warn(`[Imagen] ${model} returned no image data, trying next model`);
    } catch (err) {
      const raw = (err as Error).message;
      lastImageGenError = friendlyImageError(raw);
      // Keep the full technical reason in the server logs for debugging.
      console.error(`[Imagen] ${model} failed:`, raw);
    }
  }

  if (!lastImageGenError) {
    lastImageGenError = "Image generation didn't return an image. Please try again in a moment.";
  }
  return null;
}

// ─── Carousel (multiple images) ───────────────────────────────────────────────

// Distinct framings so each carousel slide looks visually different.
const CAROUSEL_VARIATIONS = [
  "wide cinematic establishing shot",
  "close-up detail with shallow depth of field",
  "overhead top-down flat-lay perspective",
  "dramatic side angle with bold directional lighting",
  "minimalist composition with generous negative space",
  "vibrant dynamic three-quarter perspective",
];

/**
 * Generate `count` visually-distinct images for a carousel post, in parallel.
 * Returns the successfully-generated Blob URLs (may be fewer than `count` if
 * some generations fail).
 */
export async function generateCarouselImages(
  basePrompt: string,
  postId: string,
  industry?: string,
  count = 4
): Promise<string[]> {
  const base = basePrompt || "Professional abstract business concept";
  const prompts = Array.from(
    { length: count },
    (_, i) => `${base} - ${CAROUSEL_VARIATIONS[i % CAROUSEL_VARIATIONS.length]}`
  );
  const results = await Promise.all(
    prompts.map((p, i) => generatePostImage(p, `${postId}-c${i}`, industry))
  );
  return results.filter((u): u is string => !!u);
}

/**
 * Render a cohesive carousel from a content-aware plan: one branded image per
 * slide (hook -> key points -> takeaway), all sharing the plan's palette. Each
 * slide renders its own short headline. Returns the successful Blob URLs.
 */
export async function generateCarouselFromPlan(
  plan: { palette: string; style?: ImageStyle; slides: { headline: string; visual: string; textPosition?: string }[] },
  postId: string,
  industry?: string
): Promise<string[]> {
  const total = plan.slides.length;
  const results = await Promise.all(
    plan.slides.map((slide, i) => {
      const role = i === 0 ? "the hook" : i === total - 1 ? "the takeaway" : "a key point";
      const position = `slide ${i + 1} of ${total} - ${role}`;
      const prompt = buildBrandedImagePrompt({
        headline: slide.headline,
        visual: slide.visual,
        palette: plan.palette,
        textPosition: slide.textPosition,
        position,
        style: plan.style,
      });
      return generatePostImage(prompt, `${postId}-c${i}`, industry, true);
    })
  );
  return results.filter((u): u is string => !!u);
}

// ─── Image Prompt Builder ────────────────────────────────────────────────────

export function buildImagePrompt(
  postTitle: string,
  postType: string,
  industry: string
): string {
  // This is a fallback when no imagePrompt exists on the post.
  // Describes a visual concept - no actual post text is included.
  return `Professional abstract visual metaphor representing the concept of ${postType} content in the ${industry} industry.
Clean, modern composition with symbolic imagery. No text, no words, no letters, no numbers anywhere in the image.
Square format (1:1), filling the entire frame edge to edge with no blank border or margin on any side. High quality, suitable for LinkedIn.`;
}
