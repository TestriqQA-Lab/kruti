import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// Separate client for the newer unified SDK, used for Google Search grounding.
let _groundedAI: GoogleGenAI | null = null;
function getGroundedClient(): GoogleGenAI {
  if (!_groundedAI) {
    _groundedAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return _groundedAI;
}

export function getGeminiModel(modelName = "gemini-2.5-flash") {
  return genAI.getGenerativeModel({ model: modelName });
}

export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateTextWithConfig(
  prompt: string,
  config: { temperature?: number } = {}
): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: config.temperature ?? 1.0 },
  });
  return result.response.text();
}

// Pro-tier text model for higher-quality structured planning (e.g. the carousel
// packet plan). We use Gemini 2.5 Pro - a genuinely capable, reliably-available pro
// model - and fall back to flash. We deliberately avoid gemini-3-pro-* here: it may
// not be enabled on the key, and each miss adds a wasted round-trip that slows the
// carousel down. Add it back to the front of this list once confirmed available.
const PRO_TEXT_MODELS = ["gemini-2.5-pro"];
const PRO_TEXT_FALLBACK = "gemini-2.5-flash";

let _genai: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI {
  if (!_genai) {
    _genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return _genai;
}

/**
 * Generate text with a pro-tier model, falling through the list and finally to
 * gemini-2.5-flash. Returns the text AND which model actually produced it (so the
 * caller can surface it). Throws only if every model, including the flash fallback,
 * fails.
 */
export async function generateProText(
  prompt: string,
  generationConfig?: { temperature?: number; topP?: number }
): Promise<{ text: string; model: string }> {
  const client = getGenAIClient();
  let lastErr: Error | null = null;
  for (const model of [...PRO_TEXT_MODELS, PRO_TEXT_FALLBACK]) {
    try {
      const response = await client.models.generateContent({ model, contents: prompt, config: generationConfig });
      const text = response.text ?? "";
      if (text.trim()) return { text, model };
      console.warn(`[ProText] ${model} returned empty text, trying next model`);
    } catch (err) {
      lastErr = err as Error;
      console.error(`[ProText] ${model} failed:`, (err as Error).message);
    }
  }
  throw lastErr ?? new Error("Pro text generation returned no text from any model");
}

export function parseJSON<T>(text: string): T {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Generate text grounded in live Google Search results (Gemini grounding tool).
 * Used for the research step before writing posts so content is based on real,
 * current information. Returns FREE-FORM text (not JSON) - do NOT pass it to
 * parseJSON. Callers should wrap this in try/catch and degrade gracefully.
 */
export async function generateGroundedText(prompt: string): Promise<string> {
  const ai = getGroundedClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });
  return response.text ?? "";
}
