import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return _ai;
}

// Track last generation error for better debugging
export let lastImageGenError: string | null = null;

// ─── Image Generation ────────────────────────────────────────────────────────

export async function generatePostImage(
  imagePrompt: string,
  postId: string,
  industry?: string
): Promise<string | null> {
  lastImageGenError = null;

  // ONLY use the imagePrompt (scene/metaphor description) — never pass post
  // title or body text, as image models will attempt to render any text they see.
  const sceneDescription = imagePrompt || "Professional abstract business concept";

  const prompt = `${sceneDescription}

Art direction:
- Modern, premium editorial photography or a clean 3D render — NOT generic stock-photo, clip-art, or infographic.
- Cinematic composition with a clear focal point, shallow depth of field, and breathing space (negative space) for a polished LinkedIn feel.
- Soft, natural lighting with professional color grading; a cohesive palette with subtle blue accents looks on-brand.
- High detail, crisp and realistic; uncluttered, no busy or distracting backgrounds.
Industry context: ${industry || "business"}.
Hard constraints (do NOT violate):
- ZERO text of any kind — no words, letters, numbers, labels, captions, watermarks, logos, or typography.
- No distorted hands, faces or anatomy; no warped objects; no user-interface screenshots.
Square format (1:1), high resolution, suitable for a LinkedIn post.`;

  console.log(`[Imagen] Scene: ${sceneDescription.slice(0, 80)}...`);

  // Available image generation models (confirmed working via API test):
  // - gemini-3.1-flash-image-preview: confirmed working, returns JPEG images via generateContent
  // - Imagen 4.0 models: only support "predict" (Vertex AI), NOT generateImages via Gemini API

  // Tried in order — primary first, stable fallback second. If the preview
  // model is ever deprecated/unavailable, generation falls back automatically.
  const imageModels = [
    "gemini-3.1-flash-image-preview", // primary — newest, best quality
    "gemini-2.5-flash-image", // stable GA fallback
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
      lastImageGenError = `${model}: ${(err as Error).message}`;
      console.error(`[Imagen] ${model} failed:`, (err as Error).message);
    }
  }

  if (!lastImageGenError) {
    lastImageGenError = "All image generation models returned no image data";
  }
  return null;
}

// ─── Image Prompt Builder ────────────────────────────────────────────────────

export function buildImagePrompt(
  postTitle: string,
  postType: string,
  industry: string
): string {
  // This is a fallback when no imagePrompt exists on the post.
  // Describes a visual concept — no actual post text is included.
  return `Professional abstract visual metaphor representing the concept of ${postType} content in the ${industry} industry.
Clean, modern composition with symbolic imagery. No text, no words, no letters, no numbers anywhere in the image.
Square format (1:1). High quality, suitable for LinkedIn.`;
}
