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

// ─── Branded Image Prompt (visual-first, renders a short supporting headline) ──

/**
 * Build the final image-model prompt as a confident, positive art-director brief.
 * The VISUAL is the hero (a genuinely different medium/style per post, named in
 * `style`); a short headline sits in the composition as a clean, SUPPORTING overlay.
 * The prompt leads AND ends with the hero visual (not with constraints) and carries
 * only a couple of essential guardrails. Pass `position` per carousel slide.
 */
export function buildBrandedImagePrompt(brief: {
  style: string;
  headline: string;
  label?: string;
  visual: string;
  palette: string;
  position?: string;
}): string {
  const { style, headline, visual, palette, position } = brief;
  const label = (brief.label || "").replace(/\s+/g, " ").trim();
  const labelLine = label
    ? `If - and only if - the visual is a chart, diagram, or data scene, you may place one small callout "${label}" as a single clean figure or label; otherwise add no other text.\n`
    : "";
  const carouselLine = position
    ? `This is ${position} in a set: keep the same ${style}, palette, and headline treatment on every slide so the carousel reads as one cohesive series.\n`
    : "";

  return `Create a ${style} for a premium LinkedIn feed, art-directed with the care of a magazine editorial. The VISUAL is the hero: it fills the frame, holds one clear focal point, and tells the post's story on its own -

${visual}

Compose it with confident visual hierarchy, rich real textures, and deliberate, intentional lighting. ${palette} Render it in high resolution with sharp focus and true, purposeful colour - the polished work of a senior art director, never a generic AI look, a flat gradient wash, or a cheap stock photo.

Set one short headline into the composition's natural negative space as a single compact line that occupies only a small part of the frame: sleek and modern, a clean sans-serif in a tasteful colour drawn from the palette (or crisp white or near-black), with strong contrast so it is effortless to read on a phone, elegantly integrated into the composition rather than covering it, and clearly secondary to the visual - "${headline}". ${labelLine}Show only these exact words and spell every one of them correctly, with no other captions, paragraphs, taglines, or watermarks. Keep the lower 20% and the outer edges clear of text.

${carouselLine}Full-bleed square (1:1): the artwork runs edge to edge with no border, frame, padding, or margin on any side, key elements kept just clear of the very edge. Above all, make the hero visual itself striking and genuinely on-concept - that image is what represents the post.`;
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
  count = 4
): Promise<string[]> {
  const base = basePrompt || "Professional abstract business concept";
  const prompts = Array.from(
    { length: count },
    (_, i) => `${base} - ${CAROUSEL_VARIATIONS[i % CAROUSEL_VARIATIONS.length]}`
  );
  const results = await Promise.all(
    // allowText so the designed labels in the prompt survive (no no-text wrapper).
    prompts.map((p, i) => generatePostImage(p, `${postId}-c${i}`, industry, true))
  );
  return results.filter((u): u is string => !!u);
}

/**
 * Render a cohesive carousel from a content-aware plan: one branded image per
 * slide (hook -> key points -> takeaway), all sharing the plan's palette. Each
 * slide renders its own short headline. Returns the successful Blob URLs.
 */
export async function generateCarouselFromPlan(
  plan: { style: string; palette: string; slides: { headline: string; visual: string; label?: string }[] },
  postId: string,
  industry?: string
): Promise<string[]> {
  const total = plan.slides.length;
  const results = await Promise.all(
    plan.slides.map((slide, i) => {
      const role = i === 0 ? "the hook" : i === total - 1 ? "the takeaway" : "a key point";
      const position = `slide ${i + 1} of ${total} - ${role}`;
      const prompt = buildBrandedImagePrompt({
        style: plan.style,
        headline: slide.headline,
        label: slide.label,
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
  industry: string,
  headline?: string
): string {
  // Carousel fallback (used only when the content-aware plan fails). Keeps the same
  // visual-first intent as the main path: one striking hero image anchored to the
  // person's ROLE - never an industry stereotype, never a text-heavy poster.
  const role = (headline || "").trim() || "professional";
  return `A single striking, premium editorial image that represents "${postTitle}", built from the real, tangible world of a ${role} (broad field: ${industry || "business"} - context only, never a generic stereotype of the field such as chips, wires, or circuit boards). One clear focal subject fills the frame with natural depth, real textures, and deliberate lighting, telling the story on its own. Match the medium, colours, and mood to what THIS topic is genuinely about, and let the visual be the hero rather than any text. Full-bleed square (1:1), edge to edge with no border or margin on any side. Premium, magazine-quality, high resolution, suitable for a LinkedIn feed.`;
}
