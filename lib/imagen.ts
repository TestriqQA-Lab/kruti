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

// ─── Branded Image Prompt (content-aware, renders a headline) ─────────────────

/**
 * Build the final image-model prompt for a content-aware, text-bearing graphic.
 * The headline leads (image models weight early tokens for what to render),
 * there is no other text, and industry is NOT injected (it is already baked into
 * the visual/palette by the text-model brief). Pass `position` per carousel slide.
 */
export function buildBrandedImagePrompt(brief: {
  headline: string;
  visual: string;
  palette: string;
  position?: string;
}): string {
  const { headline, visual, palette, position } = brief;

  return `The image must display exactly this text and NO other text anywhere:
${headline}
Render only those words (keep a trailing question mark if present) as large, bold, clean sans-serif typography, high contrast, in the top third of the frame with generous margins. Do not render any brackets, quotation marks, or surrounding punctuation - only the words themselves. Spell every word exactly; do not translate, paraphrase, add, or drop a single letter. No other words, letters, numbers, captions, labels, signage, UI, logos, watermarks, or gibberish lettering may appear anywhere. Render all screens, papers, charts, signs, books, and surfaces as completely blank or with abstract non-textual shapes only.

SCENE (what the image depicts): ${visual}
${position ? `POSITION: This is ${position} in a cohesive LinkedIn carousel - all slides share ONE identical look, palette, and headline placement.\n` : ""}COLOR PALETTE (follow exactly): ${palette} Use brand blue #0A66C2 and deep blue #004182 as accents on a clean neutral base - never a full-frame saturated blue fill. Keep the headline area high-contrast.

TYPOGRAPHY: Render the headline in a modern geometric sans-serif in the spirit of Inter, Soehne, or Helvetica Neue, heavy weight, tight tracking, against a clean solid or subtly toned panel. Editorial magazine quality, not decorative or handwritten.

STYLE: Modern, clean, premium, professional, on-brand. Avoid glossy 3D-render looks, plastic textures, lens flare, excessive bokeh, posed corporate-handshake stock photos, oversaturated colors, busy backgrounds, and any distorted hands or faces. Favor a restrained editorial style, consistent within the image.

Square format (1:1). High quality, suitable for a LinkedIn feed. No emojis. Use plain hyphens only, never em-dashes.`;
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
Square format (1:1). High quality, suitable for LinkedIn.`;
  }

  console.log(`[Imagen] Prompt: ${prompt.slice(0, 80)}...`);

  // Available image generation models (confirmed working via API test):
  // - gemini-3.1-flash-image-preview: confirmed working, returns JPEG images via generateContent
  // - Imagen 4.0 models: only support "predict" (Vertex AI), NOT generateImages via Gemini API

  const imageModels = [
    "gemini-3.1-flash-image-preview",
  ];

  for (const model of imageModels) {
    try {
      console.log(`[Imagen] Trying ${model}...`);
      const response = await getAI().models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ["IMAGE", "TEXT"] },
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
  plan: { palette: string; slides: { headline: string; visual: string }[] },
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
        position,
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
Square format (1:1). High quality, suitable for LinkedIn.`;
}
