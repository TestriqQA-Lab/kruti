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
 * Build the final image-model prompt for a content-aware, branded graphic.
 * Produces a cohesive DESIGNED graphic (infographic / product visual) with the
 * headline integrated as a real title and any data or labels rendered as real,
 * correctly-spelled text - leveraging the Pro image model's strong text and
 * composition. Pass `position` per carousel slide.
 */
export function buildBrandedImagePrompt(brief: {
  headline: string;
  visual: string;
  palette: string;
  textPosition?: string;
  position?: string;
}): string {
  const { headline, visual, palette, position } = brief;

  return `Design a single, clean, professionally designed square (1:1) graphic for a LinkedIn feed, in a REALISTIC, grounded style that genuinely fits the topic. This is a DESIGNED graphic, NOT a stock photo with a caption bar pasted on top, and NOT a text-heavy poster.

MAIN VISUAL - the hero, it must carry the meaning on its own: ${visual}
- Whenever the topic involves data, numbers, growth, results, steps, stages, a comparison, a process, a product, a UI, or a workflow, make a clean infographic, chart, graph, or diagram the main subject - with realistic labels and numbers, tidy icons, a clear flow, or a believable device or dashboard mockup. Render it cleanly and realistically, not as a glowing futuristic dashboard. Let the visual do the talking.

REALISTIC, ON-TOPIC LOOK (important):
- Match the theme, style, and colours to what THIS post is actually about, and vary them from post to post. Do NOT default to a futuristic, sci-fi, neon, holographic, or generic hi-tech aesthetic, and do NOT default to a cool blue or teal "tech" palette. A futuristic or high-tech look is allowed ONLY when the post is genuinely about the future or technology; otherwise keep it realistic, professional, and on-topic.

HEADLINE: "${headline}"
Place this as ONE small, restrained caption that supports the visual - clean, well-set, legible type, clearly SECONDARY to the imagery but ALWAYS present and readable, never hidden, tiny, or faded out. It is not a big banner and must not dominate the frame.

KEEP TEXT MINIMAL BUT IMPACTFUL:
- The image MUST contain this short headline as real, readable text, plus at most one or two short key points or the few real labels, numbers, or axis values a chart, diagram, or mockup genuinely needs - displayed cleanly and legibly, and nothing more. This is a DESIGNED graphic with minimal meaningful text, never a blank or text-free illustration and never a text-heavy poster. No paragraphs, sub-headlines, body copy, taglines, descriptions, watermarks, or decorative lettering anywhere.
- Every word that does appear must be real, correctly spelled, and meaningful to this topic. Never produce scrambled, fake, or nonsense lettering.

DESIGN IT LIKE A SENIOR DESIGNER WOULD:
- One cohesive, intentional composition with clear visual hierarchy, balanced layout, and purposeful spacing that fills the whole frame.
- FULL-BLEED: the background and the whole design must extend completely to all four edges of the square - NO white, blank, or empty border, frame, padding, or outer margin. Keep key elements just clear of the very edge so nothing is cut off, but the design must fill the entire canvas edge to edge.

COLOR: ${palette} Use realistic colours drawn from the subject; keep it cohesive, rich, and on-brand - intentional, not washed-out, monotone, flooded with one flat colour, or a default cool blue, teal, or neon tech palette.

QUALITY BAR: it must look like a senior designer made it - crisp, clean, professional, and realistic. Avoid cheap stock-photo-with-a-text-banner looks, walls of text, sci-fi or neon glow, holographic and futuristic-tech cliches, gaudy gradients, glossy plastic 3D, lens flare, busy clutter, and distorted hands, faces, or text.
${position ? `CAROUSEL: this is ${position} - use the SAME design system, colour palette, type, and layout across every slide so the set is cohesive.\n` : ""}Square 1:1, filling the entire frame edge to edge with no blank border or margin on any side. High quality, suitable for a LinkedIn feed. Plain hyphens only, never em-dashes.`;
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

// Distinct DESIGNED layouts so each carousel slide looks visually different while
// staying an infographic-style graphic (not a photo and not a blank illustration).
const CAROUSEL_VARIATIONS = [
  "laid out as a bold single big-number stat card",
  "laid out as a clean bar or line chart with short real labels",
  "laid out as a numbered step-by-step flow diagram",
  "laid out as a side-by-side before-and-after comparison",
  "laid out as an icon-driven concept grid",
  "laid out as a simple labeled device or dashboard mockup, rendered realistically",
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
  industry: string,
  headline?: string
): string {
  // Carousel fallback (used only when the content-aware plan fails). Keeps the same
  // intent as the main path: a DESIGNED graphic anchored to the person's ROLE, with
  // minimal meaningful labels - never an industry-stereotype, never a blank text-free
  // illustration.
  const role = (headline || "").trim() || "professional";
  return `A clean, professional, REALISTIC DESIGNED infographic-style graphic about "${postTitle}", anchored to the real work of a ${role} (broad field: ${industry || "business"} - context only, do NOT default to a generic stereotype of the field such as chips, wires, or circuit boards).
Match the theme, style, and colours to what THIS post is actually about; do NOT default to a futuristic, sci-fi, neon, or cool blue/teal "tech" aesthetic unless the post is genuinely about the future or technology - otherwise keep it realistic and on-topic.
Build it as a simple chart, diagram, labeled mockup, or icon-driven concept layout with only a few short, real, correctly-spelled labels - a designed graphic with minimal meaningful text, never a blank text-free illustration and never a text-heavy poster.
Square format (1:1), full-bleed edge to edge with no blank border or margin on any side. High quality, suitable for LinkedIn.`;
}
