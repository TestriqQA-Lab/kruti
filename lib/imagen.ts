import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import type { ImageCategory } from "@/lib/image-categories";

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

// ─── Branded Image Prompt (designed infographic that explains the post) ────────

/**
 * Build the final image-model prompt as a confident brief for ONE premium, designed
 * marketing INFOGRAPHIC that explains the post at a glance - built on a named
 * `structure`, with organized informative labels (nodes + optional feature cards), a
 * prominent headline + subheadline, and a polished, content-matched look. NOT a plain
 * photo and NOT a bare 3D object. Pass `position` per carousel slide.
 */
export function buildBrandedImagePrompt(brief: {
  style: string;
  theme?: string;
  structure: string;
  headline: string;
  subheadline?: string;
  visual: string;
  nodes?: string[];
  cards?: string[];
  palette: string;
  position?: string;
  connectsFrom?: string;
  connectsTo?: string;
  format?: string; // genApproach for a non-infographic designed format (text-card, banner, comparison, diagram)
  formatLabel?: string;
  formatGuidance?: string;
  bodyText?: string; // hero words for a quote card / big stat / screenshot
}): string {
  const { style, structure, headline, visual, palette, position } = brief;
  const clean = (s: string) => (s || "").replace(/\s+/g, " ").trim();
  const subheadline = clean(brief.subheadline || "");
  const nodes = (brief.nodes ?? []).map(clean).filter(Boolean).slice(0, 5);
  const cards = (brief.cards ?? []).map(clean).filter(Boolean).slice(0, 4);

  const subLine = subheadline
    ? `Below the headline, set one supporting subheadline at a medium size - clearly smaller than the headline but still comfortably readable on a phone, about half the headline's text height: "${subheadline}".\n`
    : "";
  const nodesLine = nodes.length
    ? `Label the key parts of the structure with these exact words, each as its own clean label on its node, step, or section - set them in a solid weight at a size that stays crisply legible on a phone (never tiny, thin, or faint) with strong contrast against their background (spell every word exactly; add no other invented labels): ${nodes.map((n) => `"${n}"`).join(", ")}.\n`
    : "";
  const cardsLine = cards.length
    ? `Add a tidy row of ${cards.length} small feature cards, each with a clean modern icon and one of these exact short labels: ${cards.map((c) => `"${c}"`).join(", ")}.\n`
    : "";
  const carouselLine = position
    ? `This is ${position} in a set: keep the same ${style}, palette, layout system, and type treatment on every slide so the carousel reads as one cohesive series.\n`
    : "";
  const connectsFrom = clean(brief.connectsFrom || "");
  const connectsTo = clean(brief.connectsTo || "");
  const continuityLine =
    connectsFrom || connectsTo
      ? `CONTINUITY WITH THE SET: ${connectsFrom ? `this slide follows from the previous one - ${connectsFrom}. ` : ""}${connectsTo ? `it then leads into the next slide - ${connectsTo}. ` : ""}Carry a clear visual through-line (a recurring motif, consistent characters or objects, or a progressing element) so this slide obviously belongs to the same series as its neighbours.\n`
      : "";
  const themeLine = brief.theme
    ? `ART DIRECTION (derived from THIS specific post - commit to it, never a generic house look): ${clean(brief.theme)}.\n`
    : "";
  const fmt = brief.format || "designed-infographic";
  const formatNoun =
    fmt === "text-card"
      ? "text-forward card"
      : fmt === "banner"
      ? "promo banner"
      : fmt === "comparison"
      ? "two-panel comparison graphic"
      : fmt === "diagram"
      ? "diagram"
      : "infographic";
  const formatLine = brief.formatLabel
    ? `FORMAT: ${brief.formatLabel}${brief.formatGuidance ? ` - ${clean(brief.formatGuidance)}` : ""}.\n`
    : "";
  const bodyText = clean(brief.bodyText || "");
  const bodyLine = bodyText
    ? `HERO TEXT: set "${bodyText}" as the large, dominant words that ARE the design - big, bold, beautifully set typography filling most of the safe area, perfectly legible on a phone.\n`
    : "";

  return `Design ONE premium, professionally designed square (1:1) marketing ${formatNoun} for a LinkedIn feed - a rich, polished graphic that represents the post at a glance, the way a top design agency would make it. This is a DESIGNED graphic, NOT a plain photo, and NOT a bare 3D object floating on an empty background.

${formatLine}STYLE: ${style}.
${themeLine}STRUCTURE (the backbone - build the whole graphic on this): ${structure}. Lay the content out on this structure with clean modern icons, connectors or flow lines, and neat panels or cards, so the viewer understands the post just by looking.

WHAT TO SHOW: ${visual}

HEADLINE (the largest text on the slide): set "${headline}" as a big, bold headline that dominates and anchors the composition - it should span most of the safe width (roughly 70 percent of the image) and stand about 12 to 18 percent of the image height tall, so it reads instantly on a small phone screen without being oversized. If it is long, wrap it onto at most two lines rather than shrinking it; never render the headline small. ${bodyLine}${subLine}${nodesLine}${cardsLine}All on-image text must be real, correctly spelled, and meaningful - never scrambled, fake, or nonsense lettering, and add no text beyond the headline, subheadline, hero text, node labels, and card labels named above.

TYPE SIZE AND LEGIBILITY (critical - every on-image word must be easily readable on a phone at a glance): use three clear, distinct sizes - a dominant headline, a medium subheadline about half its height, and small-but-legible labels in a solid weight. Keep every word large enough to read without zooming; favour fewer, larger words over many small ones, and never let text become thin, faint, cramped, or squeezed to fit. When space is tight, DROP or shorten a label rather than shrinking the type. Prioritise legible text over filling the frame with fine detail.

COLOUR AND FINISH: ${palette} Render it the way a top human design studio would - premium, modern, and editorial, with believable depth, true-to-life materials and surface texture, and soft natural shadows, so any real object in it looks genuinely real. NO neon glow, NO glowing outlines or light halos, NO drawn border, frame, box, keyline or inset panel around the whole slide, NO heavy sci-fi blue, NO circuit-board or digital-grid cliche, and NO obvious "AI infographic" look. Use tasteful, confident colour (colourful is fine when the topic suits it) on clean, realistic surfaces, so a LinkedIn viewer thinks "what a great graphic" rather than "this was made by AI". Crisp, high-resolution, and genuinely UNIQUE to this post - never a generic stock photo or a flat gradient wash.

REALISM OF REAL THINGS: any real-world object, product, device, screen, or material that appears must read as an authentic, physically accurate version of the real thing - correct proportions, genuine materials and surface texture, natural light - rendered cleanly WITHIN the chosen STYLE above (if that style is flat or illustrated, keep it a faithful, recognizable rendition of the real object, not a literal photo, and never a vague blob or generic AI shape). This stays a designed infographic, not a photograph of a whole scene, but every depicted object should look believably real.

REAL BRANDS AND LOGOS: only ever depict a brand, company, product, tool, or logo that the post text itself names - never add or invent one. When a named brand does appear, render it as its genuine, instantly recognizable real-world form using that brand's TRUE official colours - the real logo or wordmark in its actual brand colours, correctly proportioned and spelled, NOT recoloured to match the slide palette and NOT a made-up mark (the brand's real colours take priority over the palette for that logo only). If a mark cannot be rendered cleanly and accurately, show the product itself or a plain, correctly spelled wordmark in the real brand colour rather than a garbled, distorted, or fake logo.

${carouselLine}${continuityLine}Square 1:1, FULL-BLEED: the background artwork extends all the way to every edge and corner, so the edge of the artwork is the edge of the image. Draw NO border, frame, outline, keyline, rounded-rectangle, box, or inset panel around the whole slide or its outer edge - the slide itself has no drawn edge of any kind (interior cards or panels the layout calls for are fine; just nothing that frames the whole composition). Keep all text (headline, subheadline, and every label) and the key graphics set in a little from each edge, about a tenth of the width, so nothing important is clipped at any edge or corner - but treat that margin as EMPTY background breathing room, never a drawn line, rule, frame, or panel. If a line of text is long, wrap it onto at most two lines rather than shrinking it, and never crop a word. Above all, make it a cohesive, information-rich, on-concept infographic that clearly represents THIS post.`;
}

/**
 * Build a photoreal / editorial SCENE prompt for the realistic-scene and meme
 * categories (a believable real photograph, not a designed infographic). Personal
 * categories render a tasteful REPRESENTATIVE person, never a fabricated portrait.
 */
export function buildRealisticImagePrompt(
  brief: { style?: string; visual: string; headline?: string; caption?: string; palette: string; theme?: string },
  category: ImageCategory
): string {
  const clean = (s?: string) => (s || "").replace(/\s+/g, " ").trim();
  const caption = clean(brief.caption);
  const headline = clean(brief.headline);
  const theme = clean(brief.theme);
  const captionLine =
    category.genApproach === "meme" && caption
      ? `Add ONE short meme caption in clean, bold, perfectly-spelled type, large enough to read on a phone: "${caption}".\n`
      : headline
      ? `If a short label genuinely helps, set it small, clean, and perfectly spelled: "${headline}".\n`
      : "";
  const personalLine = category.personal
    ? `Show a tasteful REPRESENTATIVE person (over-the-shoulder, hands-only, a side or back angle, or no face) or just the real objects and workspace - NEVER a fabricated portrait of a specific real individual.\n`
    : "";
  const themeLine = theme ? `ART DIRECTION: ${theme}.\n` : "";

  return `Create ONE premium, believable, photoREAL square (1:1) image for a LinkedIn feed in this format: ${category.label} - ${category.briefGuidance}. It should look like a real, professionally shot photograph or editorial scene - NOT a designed infographic and NOT an obvious AI render.

${themeLine}WHAT TO SHOW: ${brief.visual}
${personalLine}${captionLine}REALISM: correct proportions, genuine materials and surface texture, natural believable light and real depth, true-to-life colour, so every object looks authentically real. NO neon glow, NO plastic AI sheen, NO garbled text, NO warped hands or extra limbs.
REAL BRANDS: only ever show a brand, product, or logo the post actually names, in its genuine form and true official colours; never invent or recolour one.
COLOUR AND LIGHT: ${brief.palette}

Keep any on-image words minimal, real, and correctly spelled, and add no text beyond the caption or label named above. Square 1:1, FULL-BLEED: the photo fills the whole frame to every edge with NO drawn border, frame, or panel; keep the key subject and any text a comfortable margin in from the edges so nothing important is clipped. Crisp, high-resolution, genuinely premium, and unique to THIS post.`;
}

/**
 * Dispatch to the right prompt builder for a post's chosen image category:
 * designed formats (infographic, diagram, comparison, text-card, banner) use the
 * branded builder; realistic-scene and meme use the photoreal builder.
 */
export function buildCategoryImagePrompt(
  category: ImageCategory,
  brief: {
    style: string;
    structure: string;
    headline: string;
    subheadline?: string;
    visual: string;
    nodes?: string[];
    cards?: string[];
    palette: string;
    theme?: string;
    bodyText?: string;
    caption?: string;
  }
): string {
  if (category.genApproach === "realistic-scene" || category.genApproach === "meme") {
    return buildRealisticImagePrompt(
      {
        style: brief.style,
        visual: brief.visual,
        headline: brief.headline,
        caption: brief.caption,
        palette: brief.palette,
        theme: brief.theme,
      },
      category
    );
  }
  return buildBrandedImagePrompt({
    style: brief.style,
    theme: brief.theme,
    structure: brief.structure,
    headline: brief.headline,
    subheadline: brief.subheadline,
    visual: brief.visual,
    nodes: brief.nodes,
    cards: brief.cards,
    palette: brief.palette,
    bodyText: brief.bodyText,
    format: category.genApproach,
    formatLabel: category.label,
    formatGuidance: category.briefGuidance,
  });
}

// ─── Image Generation ────────────────────────────────────────────────────────

export async function generatePostImage(
  imagePrompt: string,
  postId: string,
  industry?: string,
  allowText = false,
  imageSize: "1K" | "2K" = "2K"
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

  // Nano Banana 2 (Gemini 3.1 Flash Image) - Google's high-efficiency image model:
  // strong at on-image text rendering, optimized for speed and high-volume use, at a
  // much lower per-image cost than Nano Banana Pro. Single stable model id (no
  // preview/GA split); if it is unavailable, generation returns no image rather than
  // silently degrading to a different model.
  const imageModels = [
    "gemini-3.1-flash-image",
  ];

  for (const model of imageModels) {
    try {
      console.log(`[Imagen] Trying ${model}...`);
      const response = await getAI().models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          // Square LinkedIn format. Single images default to 2K; carousels pass 1K (still
          // crisp at LinkedIn's ~1080px display). 1K stays legible because the prompt sizes
          // the headline at ~12-18% of image height and caps labels per slide - do NOT raise
          // carousels to 2K to "fix" small text (2K timed out the 60s limit); text size is
          // prompt-controlled, not pixel-controlled.
          imageConfig: { aspectRatio: "1:1", imageSize },
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

// Distinct VISUAL-FIRST treatments so each fallback carousel slide is a genuinely
// different hero image (not all infographics, not all photos), used only when the
// content-aware plan is unavailable.
const CAROUSEL_VARIATIONS = [
  "as a bold hero composition built around one striking focal subject",
  "as a clean editorial data visualization anchored by one real figure",
  "as a warm, natural documentary-style scene",
  "as a bold flat illustration with strong shapes and confident colour",
  "as a minimal conceptual composition around a single clear metaphor",
  "as an elegant, richly-lit close-up of the key object or detail",
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
  count = 4,
  onSlideEvent?: (e: CarouselSlideEvent) => void
): Promise<string[]> {
  const base = basePrompt || "Professional abstract business concept";
  const results = await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const prompt = `${base} - ${CAROUSEL_VARIATIONS[i % CAROUSEL_VARIATIONS.length]}`;
      onSlideEvent?.({ index: i, status: "start" });
      // allowText so the designed labels in the prompt survive (no no-text wrapper).
      const url = await generatePostImage(prompt, `${postId}-c${i}`, industry, true, "1K");
      if (url) {
        onSlideEvent?.({ index: i, status: "done", url });
      } else {
        onSlideEvent?.({ index: i, status: "error", message: lastImageGenError || "No image returned" });
      }
      return url;
    })
  );
  return results.filter((u): u is string => !!u);
}

/**
 * Render a cohesive carousel from a content-aware plan: one branded image per
 * slide (hook -> key points -> takeaway), all sharing the plan's palette. Each
 * slide renders its own short headline. Returns the successful Blob URLs.
 */
export type CarouselSlideEvent = {
  index: number;
  status: "start" | "done" | "error";
  url?: string;
  message?: string;
};

export async function generateCarouselFromPlan(
  plan: {
    style: string;
    palette: string;
    theme?: string;
    slides: {
      structure: string;
      headline: string;
      subheadline?: string;
      visual: string;
      nodes?: string[];
      connectsFrom?: string;
      connectsTo?: string;
    }[];
  },
  postId: string,
  industry?: string,
  onSlideEvent?: (e: CarouselSlideEvent) => void
): Promise<string[]> {
  const total = plan.slides.length;
  const results = await Promise.all(
    plan.slides.map(async (slide, i) => {
      const role = i === 0 ? "the hook" : i === total - 1 ? "the takeaway" : "a key point";
      const position = `slide ${i + 1} of ${total} - ${role}`;
      const prompt = buildBrandedImagePrompt({
        style: plan.style,
        theme: plan.theme,
        structure: slide.structure,
        headline: slide.headline,
        subheadline: slide.subheadline,
        visual: slide.visual,
        nodes: slide.nodes,
        palette: plan.palette,
        position,
        connectsFrom: slide.connectsFrom,
        connectsTo: slide.connectsTo,
      });
      onSlideEvent?.({ index: i, status: "start" });
      const url = await generatePostImage(prompt, `${postId}-c${i}`, industry, true, "1K");
      if (url) {
        onSlideEvent?.({ index: i, status: "done", url });
      } else {
        onSlideEvent?.({ index: i, status: "error", message: lastImageGenError || "No image returned" });
      }
      return url;
    })
  );
  return results.filter((u): u is string => !!u);
}

// ─── Image Prompt Builder ────────────────────────────────────────────────────

export function buildImagePrompt(
  postTitle: string,
  postType: string,
  industry: string,
  headline?: string
): string {
  // Carousel fallback (used only when the content-aware plan fails). Keeps the same
  // visual-first intent as the main path: one striking hero image anchored to the
  // person's ROLE - never an industry stereotype, never a text-heavy poster.
  const role = (headline || "").trim() || "professional";
  return `A single striking, premium editorial image that represents "${postTitle}", built from the real, tangible world of a ${role} (broad field: ${industry || "business"} - context only, never a generic stereotype of the field such as chips, wires, or circuit boards). One clear focal subject fills the frame with natural depth, real textures, and deliberate lighting, telling the story on its own. Match the medium, colours, and mood to what THIS topic is genuinely about, and let the visual be the hero rather than any text. Full-bleed square (1:1), edge to edge with no border or margin on any side. Premium, magazine-quality, high resolution, suitable for a LinkedIn feed.`;
}
