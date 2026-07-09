import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";

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
}): string {
  const { style, structure, headline, visual, palette, position } = brief;
  const clean = (s: string) => (s || "").replace(/\s+/g, " ").trim();
  const subheadline = clean(brief.subheadline || "");
  const nodes = (brief.nodes ?? []).map(clean).filter(Boolean).slice(0, 7);
  const cards = (brief.cards ?? []).map(clean).filter(Boolean).slice(0, 4);

  const subLine = subheadline
    ? `Below the headline, set one supporting subheadline in smaller, clean type: "${subheadline}".\n`
    : "";
  const nodesLine = nodes.length
    ? `Label the key parts of the structure with these exact words, each as a clean, readable label on its own node, step, or section (spell every word exactly; add no other invented labels): ${nodes.map((n) => `"${n}"`).join(", ")}.\n`
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

  return `Design ONE premium, professionally designed square (1:1) marketing INFOGRAPHIC for a LinkedIn feed - a rich, polished graphic that EXPLAINS the post at a glance, the way a top design agency would make it. This is a DESIGNED infographic, NOT a plain photo, and NOT a bare 3D object floating on an empty background.

STYLE: ${style}.
STRUCTURE (the backbone - build the whole graphic on this): ${structure}. Lay the content out on this structure with clean modern icons, connectors or flow lines, and neat panels or cards, so the viewer understands the post just by looking.

WHAT TO SHOW: ${visual}

HEADLINE (prominent): set "${headline}" as a bold, confident headline that anchors the composition. ${subLine}${nodesLine}${cardsLine}All on-image text must be real, correctly spelled, and meaningful - never scrambled, fake, or nonsense lettering, and add no text beyond the headline, subheadline, node labels, and card labels named above.

COLOUR AND FINISH: ${palette} Render it rich and premium with intentional depth - tasteful glows and soft gradients on a dark background, or clean surfaces with an accent colour and soft shadows on a light background. Crisp, high-resolution, modern, and genuinely UNIQUE to this post - never a generic stock photo, a bare object on emptiness, or a flat gradient wash.

${carouselLine}${continuityLine}Full-bleed square (1:1): the design runs edge to edge with no outer border, frame, or margin, key elements kept clear of the very edge. Above all, make it a cohesive, information-rich, on-concept infographic that clearly represents THIS post.`;
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
      const url = await generatePostImage(prompt, `${postId}-c${i}`, industry, true);
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
      const url = await generatePostImage(prompt, `${postId}-c${i}`, industry, true);
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
