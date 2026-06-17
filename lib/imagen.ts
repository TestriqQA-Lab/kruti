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
  textPosition?: string;
  position?: string;
}): string {
  const { headline, visual, palette, position } = brief;

  // Map textPosition to a natural placement description so the headline does not
  // always default to one corner.
  const positionMap: Record<string, string> = {
    "top-center": "across the top portion of the image",
    "bottom-center": "across the bottom portion of the image",
    "bottom-left": "in the lower-left area of the image",
    "center-left": "down the left side of the image",
    "overlay-center": "centered over the image",
  };
  const placement = positionMap[brief.textPosition || ""] || "in whichever area has the most open, uncluttered space";

  return `A rich, vivid, professionally crafted square (1:1) image for a LinkedIn feed.

THE SCENE (the main subject - it fills the entire frame edge to edge): ${visual}
Render this as a real editorial photograph or a polished modern illustration with natural depth, lighting, texture, and genuinely varied, saturated colours that come from the subject itself. It must look like a distinctive, lively image - NOT a flat solid-colour graphic, NOT a plain coloured background with one shape on it, NOT washed-out grey. Each generated image should feel visually different from the last.
Colour mood for the overall tone and the small text area: ${palette} Use this only as a tonal hint - let the scene's own real-world colours carry most of the frame, and never flood the image with a single flat colour.

THE HEADLINE (a small, tasteful caption - NOT the focus): place exactly the words "${headline}" ${placement}, taking up no more than about one fifth of the image. Set it in clean, modern, medium-weight sans-serif type on a subtle semi-transparent panel or a naturally clear part of the scene so it stays readable. Keep the type modest in size so it never dominates or hides the subject - the scene is the hero, the words are just a caption.

ONLY TEXT: the single piece of text anywhere in the image is exactly these words: ${headline}. Spell them exactly (keep a trailing question mark if present) and add no other words, letters, numbers, captions, labels, signage, logos, watermarks, or gibberish lettering; render any incidental screens, papers, or signs as blank.

FRAMING: keep every subject, object, and the headline fully inside the frame with comfortable margins (about 8 percent padding on all sides). Nothing important may be cropped, cut off, or bleed past the edges.
${position ? `CAROUSEL: this is ${position}; keep the same visual style, colour mood, and headline placement as the other slides.\n` : ""}STYLE: premium, modern, editorial, full of colour, depth, and life. Avoid flat monotone fills, washed-out greys, cheesy corporate-handshake stock photos, glossy plastic 3D renders, lens flare, busy clutter, and distorted hands or faces.

Square 1:1, high quality, suitable for a LinkedIn feed. Plain hyphens only, never em-dashes.`;
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
  plan: { palette: string; slides: { headline: string; visual: string; textPosition?: string }[] },
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
